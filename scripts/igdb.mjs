/**
 * IGDB v4 (Twitch OAuth) — official cover art + genres/themes.
 * Optional: skipped unless IGDB_CLIENT_ID and IGDB_CLIENT_SECRET are set.
 * Rate limit is 4 req/s → 260 ms between calls. Results are cached forever.
 */
import fs from "node:fs/promises";
import { env, exists, fetchJson, log, p, readJson, sleep, writeJson } from "./util.mjs";
import { tokens } from "../src/lib/math.js";

const CACHE = p("cache", "igdb.json");
const COVER_DIR = p("public", "covers");

function similarity(a, b) {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  const inter = [...A].filter((t) => B.has(t)).length;
  return inter / Math.max(1, new Set([...A, ...B]).size);
}

async function downloadCover(slug, imageId) {
  const file = `${COVER_DIR}/${slug}.webp`;
  if (await exists(file)) return `/covers/${slug}.webp`;
  const res = await fetch(`https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${imageId}.jpg`);
  if (!res.ok) throw new Error(`cover HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const sharp = (await import("sharp")).default;
  await fs.mkdir(COVER_DIR, { recursive: true });
  await sharp(buf).resize(512, 640, { fit: "cover" }).webp({ quality: 82 }).toFile(file);
  return `/covers/${slug}.webp`;
}

/**
 * @param {{ slug: string, title: string, igdbId?: number }[]} games
 * @returns {Promise<Record<string, { igdbId?: number, genres: string[], themes: string[], cover: string | null }>>}
 */
export async function fetchIgdb(games) {
  /** @type {Record<string, any>} */
  const cache = await readJson(CACHE, {});
  const id = env("IGDB_CLIENT_ID");
  const secret = env("IGDB_CLIENT_SECRET");

  const result = {};
  const fromCache = async (g) => {
    const c = cache[g.slug];
    if (!c) return null;
    const coverPath = `${COVER_DIR}/${g.slug}.webp`;
    return { ...c, cover: (await exists(coverPath)) ? `/covers/${g.slug}.webp` : null };
  };

  if (!id || !secret) {
    log.warn("IGDB: IGDB_CLIENT_ID / IGDB_CLIENT_SECRET not set — using procedural covers.");
    for (const g of games) result[g.slug] = (await fromCache(g)) ?? { genres: [], themes: [], cover: null };
    return result;
  }

  let token;
  try {
    const tok = await fetchJson(
      `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(id)}&client_secret=${encodeURIComponent(secret)}&grant_type=client_credentials`,
      { method: "POST" },
    );
    token = tok.access_token;
  } catch (err) {
    log.warn(`IGDB auth failed (${err.message}) — using cache / procedural covers.`);
    for (const g of games) result[g.slug] = (await fromCache(g)) ?? { genres: [], themes: [], cover: null };
    return result;
  }

  const query = (body) =>
    fetchJson("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: { "Client-ID": id, Authorization: `Bearer ${token}`, Accept: "application/json" },
      body,
    });

  const FIELDS = "fields name,genres.name,themes.name,cover.image_id;";
  let fetched = 0;
  for (const g of games) {
    try {
      let entry = cache[g.slug];
      if (!entry) {
        const safe = g.title.replace(/"/g, "");
        const rows = g.igdbId
          ? await query(`${FIELDS} where id = ${g.igdbId};`)
          : await query(`search "${safe}"; ${FIELDS} where version_parent = null; limit 8;`);
        await sleep(260);
        const best = [...rows].sort((a, b) => similarity(b.name, g.title) - similarity(a.name, g.title))[0];
        entry = best
          ? {
              igdbId: best.id,
              name: best.name,
              imageId: best.cover?.image_id ?? null,
              genres: (best.genres ?? []).map((x) => x.name),
              themes: (best.themes ?? []).map((x) => x.name),
            }
          : { igdbId: null, imageId: null, genres: [], themes: [] };
        cache[g.slug] = entry;
        fetched++;
      }
      let cover = null;
      if (entry.imageId) {
        try {
          cover = await downloadCover(g.slug, entry.imageId);
        } catch (err) {
          log.warn(`IGDB cover for ${g.slug}: ${err.message}`);
        }
      }
      result[g.slug] = { igdbId: entry.igdbId ?? undefined, genres: entry.genres, themes: entry.themes, cover };
    } catch (err) {
      log.warn(`IGDB ${g.slug}: ${err.message}`);
      result[g.slug] = { genres: [], themes: [], cover: null };
    }
  }
  await writeJson(CACHE, cache);
  log.ok(`IGDB: ${fetched} new lookups, ${Object.values(result).filter((r) => r.cover).length} covers`);
  return result;
}
