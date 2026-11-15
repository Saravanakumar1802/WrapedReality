/**
 * YouTube Data API v3: uploads, playlists, descriptions (for chapters) and
 * lengths. About 1 quota unit per 50 items; never search.list (100 units).
 * Optional: skipped unless YT_API_KEY and YT_CHANNEL_ID are set.
 *
 * What the site uses it for: which videos belong to which game (playlists,
 * then titles), the order they were played (publish dates → Journey), and the
 * raw material for the moment index (descriptions → chapters, ids → captions).
 */
import { YtItemSchema } from "./schema.mjs";
import { bestGameForTitle } from "../src/lib/match.js";
import { parseIsoDuration } from "./transcripts.mjs";
import { env, fetchJson, log, p, readJson, writeJson } from "./util.mjs";

const API = "https://www.googleapis.com/youtube/v3";
const CACHE = p("cache", "youtube.json");

async function pages(endpoint, params) {
  const out = [];
  let pageToken = "";
  let guard = 0;
  do {
    const url = new URL(`${API}/${endpoint}`);
    url.search = new URLSearchParams({
      ...params,
      maxResults: "50",
      key: env("YT_API_KEY"),
      ...(pageToken ? { pageToken } : {}),
    }).toString();
    const data = await fetchJson(url);
    out.push(...(data.items ?? []));
    pageToken = data.nextPageToken ?? "";
  } while (pageToken && ++guard < 40);
  return out;
}

const toVideo = (it) =>
  YtItemSchema.parse({
    id: it.contentDetails?.videoId ?? it.snippet?.resourceId?.videoId,
    title: it.snippet?.title ?? "",
    publishedAt: it.contentDetails?.videoPublishedAt ?? it.snippet?.publishedAt ?? null,
    description: it.snippet?.description ?? "",
  });

/** Video lengths, 50 ids per request (1 quota unit each). */
async function durations(ids) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const url = new URL(`${API}/videos`);
    url.search = new URLSearchParams({ part: "contentDetails", id: ids.slice(i, i + 50).join(","), key: env("YT_API_KEY") }).toString();
    const data = await fetchJson(url);
    for (const it of data.items ?? []) out.set(it.id, parseIsoDuration(it.contentDetails?.duration));
  }
  return out;
}

const isPublic = (v) => v.title !== "Private video" && v.title !== "Deleted video";

/**
 * @param {{ slug: string, title: string, aliases?: string[] }[]} games
 * @param {Record<string, { playlistId?: string, videoIds?: string[] }>} content
 * @returns {Promise<Record<string, { id: string, title: string, publishedAt: string | null }[]>>}
 */
export async function fetchYouTube(games, content) {
  const key = env("YT_API_KEY");
  const channel = env("YT_CHANNEL_ID");
  if (!key || !channel) {
    log.warn("YouTube: YT_API_KEY / YT_CHANNEL_ID not set — using cached videos (if any).");
    return (await readJson(CACHE, { bySlug: {} })).bySlug;
  }
  if (!/^UC[\w-]{22}$/.test(channel)) {
    log.warn(`YouTube: YT_CHANNEL_ID "${channel}" doesn't look like a channel id (UC… 24 chars).`);
  }

  try {
    const uploadsId = channel.replace(/^UC/, "UU");
    const uploads = (await pages("playlistItems", { part: "snippet,contentDetails", playlistId: uploadsId })).map(toVideo).filter(isPublic);
    log.ok(`YouTube: ${uploads.length} uploads`);

    const playlists = await pages("playlists", { part: "snippet", channelId: channel });
    log.ok(`YouTube: ${playlists.length} playlists`);

    /** @type {Record<string, Map<string, any>>} */
    const bySlug = Object.fromEntries(games.map((g) => [g.slug, new Map()]));
    const add = (slug, v) => slug && bySlug[slug] && !bySlug[slug].has(v.id) && bySlug[slug].set(v.id, v);

    // 1) explicit playlist ids from content files
    const explicit = new Map(Object.entries(content).flatMap(([slug, c]) => (c.playlistId ? [[c.playlistId, slug]] : [])));
    // 2) playlists whose title names a game
    for (const pl of playlists) {
      const slug = explicit.get(pl.id) ?? bestGameForTitle(pl.snippet?.title ?? "", games);
      if (slug) explicit.set(pl.id, slug);
    }
    for (const [playlistId, slug] of explicit) {
      const items = (await pages("playlistItems", { part: "snippet,contentDetails", playlistId })).map(toVideo).filter(isPublic);
      items.forEach((v) => add(slug, v));
    }
    // 3) uploads whose title names a game
    for (const v of uploads) add(bestGameForTitle(v.title, games), v);
    // 4) explicit video ids (pinned)
    const uploadById = new Map(uploads.map((v) => [v.id, v]));
    for (const [slug, c] of Object.entries(content)) {
      for (const id of c.videoIds ?? []) add(slug, uploadById.get(id) ?? { id, title: "", publishedAt: null });
    }

    // every upload (not only matched ones): the About page shows total hours and the latest videos
    const allIds = [...new Set([...uploads.map((v) => v.id), ...Object.values(bySlug).flatMap((m) => [...m.keys()])])];
    const lengths = await durations(allIds);
    const result = Object.fromEntries(
      Object.entries(bySlug).map(([slug, m]) => [
        slug,
        [...m.values()]
          .map((v) => ({ ...v, duration: lengths.get(v.id) ?? null }))
          .sort((a, b) => String(a.publishedAt).localeCompare(String(b.publishedAt))),
      ]),
    );
    const channelUploads = uploads.map((v) => ({
      id: v.id,
      title: v.title,
      publishedAt: v.publishedAt ?? null,
      duration: lengths.get(v.id) ?? null,
    }));
    await writeJson(CACHE, { fetchedAt: new Date().toISOString(), bySlug: result, uploads: channelUploads });
    const matched = Object.values(result).filter((v) => v.length).length;
    log.ok(`YouTube: matched videos to ${matched}/${games.length} games`);
    return result;
  } catch (err) {
    log.warn(`YouTube failed (${err.message}) — falling back to cache.`);
    return (await readJson(CACHE, { bySlug: {} })).bySlug;
  }
}
