/**
 * Real game art without API keys.
 *  1. Steam (store search → name-verified app id): portrait key art, hero backdrop, transparent logo
 *  2. Wikipedia infobox cover (for console exclusives): retail box art, with any printed
 *     PS4/PS5 band detected and cropped so our 3D case can draw the real band uniformly
 * Results are cached (cache/covers.json) and files are only downloaded once.
 * Outputs: public/covers/<slug>.webp (768×1152) · public/thumbs/<slug>.webp (240×360)
 *          public/heroes/<slug>.webp (1920w)    · public/logos/<slug>.webp (≤640w, alpha)
 */
import fs from "node:fs/promises";
import { exists, log, p, readJson, sleep, writeJson } from "./util.mjs";

const UA = "TakeawaysBuild/1.0 (personal non-commercial fan site build script)";
const CACHE = p("cache", "covers.json");
const DIRS = { covers: p("public", "covers"), thumbs: p("public", "thumbs"), heroes: p("public", "heroes"), logos: p("public", "logos") };

// Words that differ between store listings and the plain game name.
const STRIP = new Set([
  "the",
  "of",
  "a",
  "and",
  "edition",
  "remastered",
  "remaster",
  "directors",
  "cut",
  "complete",
  "goty",
  "game",
  "year",
  "definitive",
  "standard",
  "ultimate",
  "enhanced",
  "legacy",
  "deluxe",
  "tom",
  "clancys",
  "marvels",
  "collection",
  "digital",
]);
const norm = (s) =>
  s
    .replace(/[™®©]/g, "") // before NFKD, which would turn ™ into the letters "TM"
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[_:\-–—!.,&]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STRIP.has(t));

/** All of our name's tokens must appear in the store name, which may add at most one extra token. */
export function storeNameMatches(ours, theirs) {
  const a = norm(ours);
  const b = norm(theirs);
  if (!a.length) return false;
  const bs = new Set(b);
  if (!a.every((t) => bs.has(t))) return false;
  const as = new Set(a);
  return b.filter((t) => !as.has(t)).length <= 1;
}

async function get(url, { json = false, tries = 4 } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) return null;
      if (json) {
        const text = await res.text();
        if (text.startsWith("You are making too many")) throw new Error("rate limited");
        return JSON.parse(text);
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (i === tries - 1) throw err;
      await sleep(4000 * (i + 1));
    }
  }
  return null;
}

async function steamAppId(game) {
  if (game.artSteamId) return game.artSteamId;
  const r = await get(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(game.title)}&l=english&cc=US`, {
    json: true,
  });
  // Closest name wins: "Marvel's Spider-Man" must not pick "Marvel's Spider-Man 2".
  const extra = (name) => norm(name).length - norm(game.title).length;
  const hit = (r?.items ?? []).filter((it) => storeNameMatches(game.title, it.name)).sort((a, b) => extra(a.name) - extra(b.name))[0];
  return hit?.id ?? null;
}

const steamAsset = (id, file) => [
  `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${id}/${file}`,
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/${file}`,
];

/**
 * Newer (and recently updated) Steam apps keep their art under hashed paths
 * ("<hash>/library_600x900_2x.jpg"). The public store API lists the exact files;
 * this returns full URLs for the cover and hero, best quality first.
 */
async function steamListedAssets(id) {
  const input = { ids: [{ appid: id }], context: { language: "english", country_code: "US" }, data_request: { include_assets: true } };
  const r = await get(
    `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`,
    { json: true },
  ).catch(() => null);
  const a = r?.response?.store_items?.[0]?.assets;
  if (!a?.asset_url_format) return { cover: [], hero: [] };
  const url = (file) =>
    file
      ? `https://shared.cloudflare.steamstatic.com/store_item_assets/${a.asset_url_format.replace("${FILENAME}", file).replace(/\?.*$/, "")}`
      : null;
  const pick = (...files) => files.map(url).filter(Boolean);
  // "library_capsule" is the 600×900 portrait; older apps point it at a small legacy file, which firstOk rejects
  return { cover: pick(a.library_capsule_2x, a.library_capsule), hero: pick(a.library_hero_2x, a.library_hero) };
}

async function firstOk(urls) {
  for (const u of urls) {
    const buf = await get(u).catch(() => null);
    if (buf && buf.length > 2000) return buf;
  }
  return null;
}

async function wikipediaCover(game) {
  const pages = [game.wikiTitle, `${game.title} (video game)`, game.title].filter(Boolean);
  for (const page of pages) {
    const j = await get(
      `https://en.wikipedia.org/w/api.php?action=parse&format=json&redirects=1&prop=wikitext&section=0&page=${encodeURIComponent(page)}`,
      { json: true },
    ).catch(() => null);
    await sleep(1500);
    const wt = j?.parse?.wikitext?.["*"] ?? "";
    if (!/\{\{\s*Infobox video game/i.test(wt)) continue;
    const m = wt.match(/\|\s*image\s*=\s*(?:\[\[(?:File|Image):)?([^|\]\n]+?\.(?:jpe?g|png|webp))/i);
    if (!m) continue;
    const file = m[1].trim();
    const info = await get(
      `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&titles=File:${encodeURIComponent(file)}`,
      { json: true },
    ).catch(() => null);
    await sleep(1500);
    const url = Object.values(info?.query?.pages ?? {})[0]?.imageinfo?.[0]?.url;
    if (!url) continue;
    const buf = await get(url.split("?")[0]).catch(() => null);
    if (buf) return { buf, file };
  }
  return null;
}

/** Finds a uniform printed band at the top (PS4 blue / PS5 white) and returns its height in px. */
export async function detectTopBand(sharp, buf) {
  const { data, info } = await sharp(buf).resize(120, null).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const rowStats = (y) => {
    let r = 0,
      g = 0,
      b = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    r /= width;
    g /= width;
    b /= width;
    let v = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      v += Math.abs(data[i] - r) + Math.abs(data[i + 1] - g) + Math.abs(data[i + 2] - b);
    }
    return { r, g, b, dev: v / width };
  };
  const top = rowStats(1);
  const isBlue = top.b > 110 && top.b > top.r + 40;
  const isWhite = top.r > 215 && top.g > 215 && top.b > 215;
  if (!isBlue && !isWhite) return 0;
  // The band holds a logo, so allow some deviation; stop when the colour changes.
  let y = 1;
  while (y < height * 0.2) {
    const s = rowStats(y);
    const dc = Math.abs(s.r - top.r) + Math.abs(s.g - top.g) + Math.abs(s.b - top.b);
    if (dc > 70 && s.dev > 25) break;
    y++;
  }
  const frac = y / height;
  return frac > 0.04 && frac < 0.16 ? Math.round((y / height) * (await sharp(buf).metadata()).height) + 2 : 0;
}

/**
 * Is a transparent logo mostly dark? Dark logos vanish on our dark backdrops, so
 * the UI renders those in white (as console and streaming UIs do).
 *
 * A logo that carries its own light content is never "dark", even when most of
 * it is black: Red Dead Redemption 2's white letters sit on a black plate, and
 * whitening it would turn the whole thing into a blank white block.
 */
export const LOGO_CHECK_VERSION = 2; // bump when this rule changes, so cached results are re-checked
export async function logoIsDark(sharp, file) {
  const { data } = await sharp(file).resize(160, null).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let dark = 0;
  let light = 0;
  let n = 0;
  let sat = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 150) continue;
    n++;
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    sat += mx === 0 ? 0 : (mx - mn) / mx;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (luma < 0.3) dark++;
    if (luma > 0.6) light++;
  }
  if (!n) return false;
  if (light / n > 0.12) return false; // it has its own light lettering or highlights: show it as designed
  const darkFrac = dark / n;
  // mostly dark, or fairly dark and colourless (colourful logos keep their colours)
  return darkFrac > 0.6 || (darkFrac > 0.4 && sat / n < 0.3);
}

/** Accent + deep colour sampled from the art (most saturated mid-tone cluster). */
export async function samplePalette(sharp, buf) {
  const { data } = await sharp(buf).resize(24, 36, { fit: "cover" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = [];
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    const l = (max + min) / 510;
    const s = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
    px.push({ r, g, b, l, s });
  }
  const vivid = px
    .filter((c) => c.l > 0.22 && c.l < 0.78)
    .sort((a, b) => b.s - a.s)
    .slice(0, Math.max(6, px.length / 10));
  const dark = [...px].sort((a, b) => a.l - b.l).slice(0, px.length / 5);
  const avg = (arr) => {
    const n = arr.length || 1;
    const c = arr.reduce((a, x) => [a[0] + x.r, a[1] + x.g, a[2] + x.b], [0, 0, 0]).map((v) => Math.round(v / n));
    return `#${c
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()}`;
  };
  return [avg(vivid.length ? vivid : px), avg(dark)];
}

async function writeImages(sharp, slug, coverBuf, heroBuf, logoBuf, cropTop) {
  const meta = await sharp(coverBuf).metadata();
  let src = coverBuf;
  if (cropTop) {
    src = await sharp(coverBuf)
      .extract({ left: 0, top: cropTop, width: meta.width, height: meta.height - cropTop })
      .toBuffer();
  }
  const m = await sharp(src).metadata();
  let cover;
  if (m.width / m.height > 0.85) {
    // Landscape / square art: fit it whole over a blurred fill instead of cropping the logo away.
    const bg = await sharp(src).resize(768, 1152, { fit: "cover" }).blur(28).modulate({ brightness: 0.55 }).toBuffer();
    const fg = await sharp(src).resize(728, null).toBuffer();
    const fh = (await sharp(fg).metadata()).height;
    cover = await sharp(bg)
      .composite([{ input: fg, left: 20, top: Math.max(0, Math.round((1152 - fh) / 2)) }])
      .toBuffer();
  } else {
    cover = await sharp(src).resize(768, 1152, { fit: "cover", position: "attention" }).toBuffer();
  }
  await sharp(cover).webp({ quality: 82 }).toFile(`${DIRS.covers}/${slug}.webp`);
  await sharp(cover).resize(240, 360).webp({ quality: 78 }).toFile(`${DIRS.thumbs}/${slug}.webp`);
  if (heroBuf)
    await sharp(heroBuf).resize(1920, null, { withoutEnlargement: true }).webp({ quality: 74 }).toFile(`${DIRS.heroes}/${slug}.webp`);
  if (logoBuf)
    await sharp(logoBuf)
      .resize(640, null, { withoutEnlargement: true })
      .webp({ quality: 90, alphaQuality: 100 })
      .toFile(`${DIRS.logos}/${slug}.webp`);
  return cover;
}

/**
 * @param {{ slug: string, title: string, steamAppId?: number, wikiTitle?: string }[]} games
 * @returns {Promise<Record<string, { cover: string|null, thumb: string|null, hero: string|null, logo: string|null, palette: string[]|null, source: string|null }>>}
 */
export async function fetchCovers(games, { offline = false } = {}) {
  const sharp = (await import("sharp")).default;
  await Promise.all(Object.values(DIRS).map((d) => fs.mkdir(d, { recursive: true })));
  /** @type {Record<string, any>} */
  const cache = await readJson(CACHE, {});
  const out = {};
  let fetched = 0;

  for (const g of games) {
    const have = cache[g.slug];
    const coverFile = `${DIRS.covers}/${g.slug}.webp`;
    const recentMiss = have && !have.source && have.checkedAt && Date.now() - Date.parse(have.checkedAt) < 7 * 864e5;
    if (!(have?.source && (await exists(coverFile))) && !recentMiss && !offline) {
      try {
        let entry = { source: null };
        const id = g.artFrom === "wikipedia" ? null : await steamAppId(g);
        if (id) {
          const listed = await steamListedAssets(id);
          const cover = await firstOk([
            ...listed.cover,
            ...steamAsset(id, "library_600x900_2x.jpg"),
            ...steamAsset(id, "library_600x900.jpg"),
          ]);
          if (cover) {
            const hero = await firstOk([...listed.hero, ...steamAsset(id, "library_hero.jpg")]);
            const logo = await firstOk(steamAsset(id, "logo.png"));
            const resized = await writeImages(sharp, g.slug, cover, hero, logo, 0);
            entry = {
              source: "steam",
              steamAppId: id,
              hero: Boolean(hero),
              logo: Boolean(logo),
              palette: await samplePalette(sharp, resized),
            };
          }
        }
        if (!entry.source) {
          const wiki = await wikipediaCover(g);
          if (wiki) {
            const h = (await sharp(wiki.buf).metadata()).height;
            const band = g.cropTop ? Math.round(h * g.cropTop) : await detectTopBand(sharp, wiki.buf);
            const resized = await writeImages(sharp, g.slug, wiki.buf, null, null, band);
            entry = {
              source: "wikipedia",
              file: wiki.file,
              croppedBand: band > 0,
              hero: false,
              logo: false,
              palette: await samplePalette(sharp, resized),
            };
          }
        }
        cache[g.slug] = { ...entry, checkedAt: new Date().toISOString() };
        fetched++;
        await writeJson(CACHE, cache); // save progress after every game
        log.info(`${g.slug}: ${entry.source ?? "no art found"}`);
        await sleep(350);
      } catch (err) {
        log.warn(`covers ${g.slug}: ${err.message}`);
      }
    }
    const e = cache[g.slug] ?? {};
    const ok = e.source && (await exists(coverFile));
    const logoFile = `${DIRS.logos}/${g.slug}.webp`;
    if (e.logo && e.logoCheck !== LOGO_CHECK_VERSION && (await exists(logoFile))) {
      const was = e.logoDark;
      e.logoDark = await logoIsDark(sharp, logoFile);
      e.logoCheck = LOGO_CHECK_VERSION;
      if (was !== undefined && was !== e.logoDark)
        log.info(`${g.slug}: logo ${e.logoDark ? "will be shown in white" : "keeps its own colours"}`);
      cache[g.slug] = e;
      await writeJson(CACHE, cache);
    }
    out[g.slug] = {
      cover: ok ? `/covers/${g.slug}.webp` : null,
      thumb: ok && (await exists(`${DIRS.thumbs}/${g.slug}.webp`)) ? `/thumbs/${g.slug}.webp` : null,
      hero: e.hero && (await exists(`${DIRS.heroes}/${g.slug}.webp`)) ? `/heroes/${g.slug}.webp` : null,
      logo: e.logo && (await exists(`${DIRS.logos}/${g.slug}.webp`)) ? `/logos/${g.slug}.webp` : null,
      palette: e.palette ?? null,
      // a game's own logoTone (games.js) beats the automatic check
      logoDark: g.logoTone ? g.logoTone === "white" : Boolean(e.logoDark),
      source: ok ? e.source : null,
    };
  }
  const n = Object.values(out).filter((x) => x.cover).length;
  log.ok(`Covers: ${n}/${games.length} with real art (${fetched} fetched this run)`);
  return out;
}
