/**
 * The channel itself, for the About page: name, handle, description, stats,
 * avatar and banner (downloaded and optimised once), total hours of video, and
 * the latest uploads. Written to src/data/generated/channel.json.
 *
 * Needs YT_API_KEY + YT_CHANNEL_ID; without them the last saved data is kept.
 * Costs 1 quota unit (uploads and lengths come from the YouTube step's cache).
 */
import fs from "node:fs/promises";
import sharp from "sharp";
import { env, exists, fetchJson, log, p, readJson, writeJson } from "./util.mjs";

const OUT = p("src", "data", "generated", "channel.json");
const AVATAR = "/brand/channel-avatar.webp";
const BANNER = "/brand/channel-banner.webp";
/** Shorts (vertical, under a minute or so) are left out of "latest videos". */
const MIN_LENGTH = 90;

async function saveImage(url, file, resize) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await sharp(buf)
    .resize(resize)
    .webp({ quality: 82 })
    .toFile(p("public", file.slice(1)));
}

/** Pure: totals and the latest long videos from the cached uploads. */
export function summariseUploads(uploads, bySlug = {}) {
  const slugOf = new Map(Object.entries(bySlug).flatMap(([slug, vids]) => vids.map((v) => [v.id, slug])));
  const seconds = uploads.reduce((n, v) => n + (v.duration ?? 0), 0);
  const latest = uploads
    .filter((v) => (v.duration ?? 0) >= MIN_LENGTH)
    .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))
    .slice(0, 12)
    .map((v) => ({ id: v.id, title: v.title, publishedAt: v.publishedAt, duration: v.duration, slug: slugOf.get(v.id) ?? null }));
  return { hours: Math.round(seconds / 3600), latest };
}

export async function buildChannel() {
  const previous = await readJson(OUT, null);
  const key = env("YT_API_KEY");
  const id = env("YT_CHANNEL_ID");
  if (!key || !id) {
    log.warn("Channel: YT_API_KEY / YT_CHANNEL_ID not set; keeping the saved channel info.");
    if (!previous) await writeJson(OUT, { title: null });
    return;
  }
  try {
    const data = await fetchJson(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&id=${id}&key=${key}`,
    );
    const c = data.items?.[0];
    if (!c) throw new Error("channel not found");
    const s = c.snippet;
    await fs.mkdir(p("public", "brand"), { recursive: true });
    const avatarUrl = s.thumbnails?.high?.url ?? s.thumbnails?.medium?.url;
    const bannerUrl = c.brandingSettings?.image?.bannerExternalUrl;
    if (avatarUrl)
      await saveImage(avatarUrl, AVATAR, { width: 320, height: 320, fit: "cover" }).catch((e) => log.warn(`Channel avatar: ${e.message}`));
    if (bannerUrl)
      await saveImage(`${bannerUrl}=w2120`, BANNER, { width: 1920, withoutEnlargement: true }).catch((e) =>
        log.warn(`Channel banner: ${e.message}`),
      );

    const yt = await readJson(p("cache", "youtube.json"), { uploads: [], bySlug: {} });
    const { hours, latest } = summariseUploads(yt.uploads ?? [], yt.bySlug ?? {});
    const st = c.statistics ?? {};
    await writeJson(OUT, {
      title: s.title,
      handle: s.customUrl ?? null,
      url: s.customUrl ? `https://www.youtube.com/${s.customUrl}` : `https://www.youtube.com/channel/${id}`,
      since: s.publishedAt ?? null,
      country: s.country ?? null,
      description: s.description ?? "",
      stats: {
        subscribers: st.hiddenSubscriberCount ? null : Number(st.subscriberCount ?? 0),
        views: Number(st.viewCount ?? 0),
        videos: Number(st.videoCount ?? 0),
      },
      hours,
      avatar: (await exists(p("public", AVATAR.slice(1)))) ? AVATAR : null,
      banner: (await exists(p("public", BANNER.slice(1)))) ? BANNER : null,
      latest,
    });
    log.ok(`Channel: ${s.title}, ${st.videoCount} videos, ${hours} h of video, ${latest.length} latest`);
  } catch (err) {
    log.warn(`Channel: ${err.message}; keeping the saved channel info.`);
    if (!previous) await writeJson(OUT, { title: null });
  }
}
