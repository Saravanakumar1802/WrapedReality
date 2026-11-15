/**
 * Build pipeline → src/data/generated/games.json (+ games.lite.json),
 * public/data/games/<slug>.json (one per game page), public/data/vectors.bin,
 * public/data/moments.json + moments.bin (the moment search index)
 *
 *   npm run data
 *
 * Every external step is optional and degrades gracefully, so this always
 * succeeds offline / without keys. Output is deterministic (seeded UMAP).
 */
import fs from "node:fs/promises";
import { config as loadEnv } from "dotenv";
import { UMAP } from "umap-js";

import { GAMES } from "../src/data/games.js";
import { GENRES, MOODS, PLATFORMS } from "../src/data/taxonomy.js";
import { centroid, fitToRadius, mulberry32, nearestNeighbors, slugify } from "../src/lib/math.js";
import { centerMoodScores, pickGenres, pickMood, relativeMatch, scoreGenres, scoreMoods } from "../src/lib/scoring.js";
import { clusterPositions } from "../src/lib/layout.js";
import { toLiteDataset } from "../src/lib/lite.js";
import { mergeMoments, momentText, quantize } from "../src/lib/momentIndex.js";
import { GameSeedSchema } from "./schema.mjs";
import { readContent } from "./content.mjs";
import { fetchYouTube } from "./youtube.mjs";
import { buildChannel } from "./channel.mjs";
import { fetchTranscripts } from "./transcripts.mjs";
import { indexMoments } from "./moments.mjs";
import { fetchIgdb } from "./igdb.mjs";
import { fetchSteamHours } from "./steam.mjs";
import { fetchCovers } from "./covers.mjs";
import { DIM, MODEL, embedAll } from "./embed.mjs";
import { log, p, writeJson } from "./util.mjs";

loadEnv({ path: p(".env.local"), override: true, quiet: true });

async function main() {
  const t0 = performance.now();
  log.step("Validating games");
  const seeds = GAMES.map((g, i) => {
    const r = GameSeedSchema.safeParse(g);
    if (!r.success) throw new Error(`games.js entry #${i} (${g.title}): ${r.error.message}`);
    return r.data;
  });
  const games = seeds.map((g, i) => ({
    ...g,
    slug: g.id ?? slugify(g.title),
    platforms: g.platforms?.length ? g.platforms : [g.platform],
    order: i,
  }));
  const slugs = new Set();
  for (const g of games) {
    if (slugs.has(g.slug)) throw new Error(`Duplicate slug "${g.slug}": give one of them an \`id\` (e.g. "${g.slug}-pc").`);
    slugs.add(g.slug);
  }
  log.ok(`${games.length} games`);

  log.step("Content");
  const content = await readContent(slugs);

  log.step("YouTube");
  const videos = await fetchYouTube(games, content);

  log.step("Channel");
  await buildChannel();

  log.step("Transcripts");
  const allVideos = [
    ...new Map(
      Object.values(videos)
        .flat()
        .map((v) => [v.id, v]),
    ).values(),
  ];
  const transcripts = await fetchTranscripts(allVideos);

  log.step("Cover art (Steam / Wikipedia)");
  const art = await fetchCovers(games, { offline: process.argv.includes("--offline") });

  log.step("IGDB");
  const igdb = await fetchIgdb(games);

  log.step("Steam");
  const steamHours = await fetchSteamHours(games);

  log.step("Embeddings");
  const gameTexts = games.map((g) => {
    const meta = igdb[g.slug] ?? { genres: [], themes: [] };
    const tk = (content[g.slug]?.takeaway ?? []).join(" ");
    return [
      `${g.title}.`,
      `Genres: ${[...g.tags.map((t) => GENRES[t].label), ...meta.genres].join(", ")}.`,
      meta.themes.length ? `Themes: ${meta.themes.join(", ")}.` : "",
      g.summary,
      tk ? `My takeaway: ${tk}` : "",
    ]
      .filter(Boolean)
      .join(" ");
  });
  const genreEntries = Object.entries(GENRES);
  const moodEntries = Object.entries(MOODS);
  const protoTexts = [...genreEntries, ...moodEntries].flatMap(([, d]) => d.prototypes);
  const all = await embedAll([...gameTexts, ...protoTexts]);

  let gameVecs = null;
  let genreProto = null;
  let moodProto = null;
  if (all) {
    gameVecs = all.slice(0, games.length);
    let cursor = games.length;
    const take = (n) => all.slice(cursor, (cursor += n));
    genreProto = Object.fromEntries(genreEntries.map(([k, d]) => [k, centroid(take(d.prototypes.length))]));
    moodProto = Object.fromEntries(moodEntries.map(([k, d]) => [k, centroid(take(d.prototypes.length))]));
  }

  log.step("Scoring");
  const rawMoods = games.map((g, i) => scoreMoods(g, gameVecs?.[i] ?? null, moodProto));
  const moodRows = gameVecs
    ? centerMoodScores(
        rawMoods,
        games.map((g) => g.tags),
      )
    : rawMoods;
  const scored = games.map((g, i) => {
    const vec = gameVecs?.[i] ?? null;
    const genre = scoreGenres(g, vec, genreProto);
    const mood = moodRows[i];
    const { primary, shelves } = pickGenres(g, genre);
    const c = content[g.slug] ?? {};
    return {
      ...g,
      scores: { genre, mood },
      match: { genre: relativeMatch(genre), mood: relativeMatch(mood) },
      primaryGenre: primary,
      shelves,
      primaryMood: pickMood(c.mood, mood),
      moodIsManual: Boolean(c.mood),
    };
  });

  log.step("AI moment index");
  const aiMoments = await indexMoments(
    games.flatMap((g) => (videos[g.slug] ?? []).map((video) => ({ game: g, video }))),
    transcripts,
  );

  log.step("3D layout");
  let positions;
  if (gameVecs && games.length >= 12) {
    const umap = new UMAP({
      nComponents: 3,
      nNeighbors: Math.min(15, games.length - 1),
      minDist: 0.35,
      spread: 1.2,
      random: mulberry32(42),
    });
    positions = fitToRadius(umap.fit(gameVecs), 9);
    log.ok("UMAP 3D layout");
  } else {
    positions = clusterPositions(scored, 8);
    log.ok("Genre-cluster layout (fallback)");
  }

  // Neighbours: by meaning when we have vectors, otherwise by 3D distance.
  const neighborBasis =
    gameVecs ??
    positions.map((pos) => {
      const n = Math.hypot(...pos) || 1;
      return pos.map((x) => x / n);
    });

  log.step("Writing output");
  const output = scored.map((g, i) => {
    const c = content[g.slug] ?? {};
    const vids = (videos[g.slug] ?? []).map((v) => ({
      id: v.id,
      title: v.title,
      publishedAt: v.publishedAt ?? null,
      duration: v.duration ?? null,
      summary: aiMoments[v.id]?.summary ?? null,
    }));
    const meta = igdb[g.slug] ?? {};
    const hours = c.hours ?? (g.steamAppId ? steamHours[g.steamAppId] : undefined);
    const firstVideo = vids.find((v) => v.publishedAt)?.publishedAt ?? null;
    return {
      slug: g.slug,
      title: g.title,
      platform: g.platform,
      platforms: g.platforms,
      category: g.category,
      tags: g.tags,
      year: g.year ?? null,
      note: g.note ?? null,
      summary: g.summary,
      palette: art[g.slug]?.palette ?? g.palette,
      cover: art[g.slug]?.cover ?? meta.cover ?? null,
      thumb: art[g.slug]?.thumb ?? null,
      hero: art[g.slug]?.hero ?? null,
      logo: art[g.slug]?.logo ?? null,
      logoDark: art[g.slug]?.logoDark ?? false,
      artSource: art[g.slug]?.source ?? (meta.cover ? "igdb" : null),
      igdbId: meta.igdbId ?? null,
      igdbGenres: meta.genres ?? [],
      igdbThemes: meta.themes ?? [],
      takeaway: c.takeaway ?? [],
      moments: mergeMoments(c.moments ?? [], vids, aiMoments),
      videos: vids,
      firstVideoAt: firstVideo,
      playedOrder: c.playedOrder ?? null,
      stats: { ...(hours != null ? { hours } : {}), ...(c.trophies != null ? { trophies: c.trophies } : {}) },
      scores: g.scores,
      match: g.match,
      primaryGenre: g.primaryGenre,
      shelves: g.shelves,
      primaryMood: g.primaryMood,
      moodIsManual: g.moodIsManual,
      pos3d: positions[i],
      neighbors: nearestNeighbors(neighborBasis, i, 3).map((j) => games[j].slug),
      order: g.order,
    };
  });

  // Journey order: explicit playedOrder → first video date → list order
  const journey = [...output]
    .sort((a, b) => {
      if (a.playedOrder != null || b.playedOrder != null) return (a.playedOrder ?? 1e9) - (b.playedOrder ?? 1e9);
      if (a.firstVideoAt && b.firstVideoAt) return a.firstVideoAt.localeCompare(b.firstVideoAt);
      if (a.firstVideoAt || b.firstVideoAt) return a.firstVideoAt ? -1 : 1;
      return a.order - b.order;
    })
    .map((g) => g.slug);

  const data = {
    meta: {
      generatedAt: new Date().toISOString(),
      count: output.length,
      embeddings: Boolean(gameVecs),
      model: gameVecs ? MODEL : null,
      dim: gameVecs ? DIM : 0,
      platforms: PLATFORMS,
      hasVideos: output.some((g) => g.videos.length),
      hasCovers: output.some((g) => g.cover),
      coverCount: output.filter((g) => g.cover).length,
      videoCount: output.reduce((n, g) => n + g.videos.length, 0),
      momentCount: output.reduce((n, g) => n + g.moments.length, 0),
    },
    journey,
    games: output,
  };

  await writeJson(p("src", "data", "generated", "games.json"), data);
  // what ships with the app: lists, shelves and scenes only (the game page loads the full file)
  await writeJson(p("src", "data", "generated", "games.lite.json"), toLiteDataset(data), false);

  // one small file per game page (the app ships only the lite file)
  const perGame = p("public", "data", "games");
  await fs.rm(perGame, { recursive: true, force: true });
  await fs.mkdir(perGame, { recursive: true });
  await Promise.all(output.map((g) => writeJson(p("public", "data", "games", `${g.slug}.json`), g, false)));
  log.ok(`Per-game data: ${output.length} files`);

  await writeMomentIndex(output);

  await fs.mkdir(p("public", "data"), { recursive: true });
  if (gameVecs) {
    const flat = new Float32Array(gameVecs.length * DIM);
    gameVecs.forEach((v, i) => flat.set(v, i * DIM));
    await fs.writeFile(p("public", "data", "vectors.bin"), Buffer.from(flat.buffer));
    log.ok(`vectors.bin (${(flat.byteLength / 1024).toFixed(0)} KB)`);
  } else {
    await fs.rm(p("public", "data", "vectors.bin"), { force: true });
  }

  const byGenre = {};
  for (const g of output) byGenre[g.primaryGenre] = (byGenre[g.primaryGenre] ?? 0) + 1;
  log.ok(
    `Genres: ${Object.entries(byGenre)
      .map(([k, n]) => `${k} ${n}`)
      .join(", ")}`,
  );
  log.ok(`Done in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
}

/**
 * The moment search index: compact metadata (moments.json) plus one int8 vector
 * per moment (moments.bin), searched in the browser by the same small model as
 * Feel-search. Only loaded when a visitor searches.
 */
async function writeMomentIndex(output) {
  const rows = output.flatMap((g, gi) => g.moments.filter((m) => m.videoId).map((m) => ({ gi, m, text: momentText(m, g.title) })));
  const json = p("public", "data", "moments.json");
  const bin = p("public", "data", "moments.bin");
  if (!rows.length) {
    await Promise.all([fs.rm(json, { force: true }), fs.rm(bin, { force: true })]);
    log.info("Moment index: no moments yet (connect YouTube, add GEMINI_API_KEY, or write moments in content/).");
    return;
  }
  const vectors = await embedAll(rows.map((r) => r.text));
  await writeJson(
    json,
    {
      model: vectors ? MODEL : null,
      dim: vectors ? DIM : 0,
      games: output.map((g) => g.slug),
      items: rows.map(({ gi, m, text }) => ({
        g: gi,
        v: m.videoId,
        t: m.t,
        label: m.label,
        kind: m.kind ?? null,
        spoiler: Boolean(m.spoiler),
        text,
      })),
    },
    false,
  );
  if (vectors) await fs.writeFile(bin, Buffer.from(quantize(vectors).buffer));
  else await fs.rm(bin, { force: true });
  log.ok(`Moment index: ${rows.length} moments${vectors ? " (with vectors)" : " (keyword only)"}`);
}

main().catch((err) => {
  console.error(`\n✗ build-data failed:\n${err.stack ?? err}`);
  process.exit(1);
});
