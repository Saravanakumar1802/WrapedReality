/**
 * The YouTube channel, as fetched at build time (scripts/channel.mjs), plus
 * small pure formatting helpers for the About page.
 */
import data from "@/data/generated/channel.json";

/** @type {{ title: string | null, handle?: string | null, url?: string, since?: string | null, country?: string | null,
 *   description?: string, stats?: { subscribers: number | null, views: number, videos: number }, hours?: number,
 *   avatar?: string | null, banner?: string | null,
 *   latest?: { id: string, title: string, publishedAt: string | null, duration: number | null, slug: string | null }[] }} */
export const channel = data;

const FALLBACK_URL = import.meta.env.VITE_YT_CHANNEL_URL || "https://www.youtube.com/@wrapedreality";
export const channelUrl = channel.url ?? FALLBACK_URL;
/** Opens YouTube's "subscribe?" confirmation for visitors who are signed in. */
export const subscribeUrl = `${channelUrl}?sub_confirmation=1`;

/** 63689 → "63.7K", 1250000 → "1.3M", 218 → "218". */
export function formatCompact(n) {
  if (!Number.isFinite(n)) return "–";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** Whole years between a date and now (at least 1). */
export function yearsSince(iso, now = new Date()) {
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return null;
  const years = (now.getTime() - start.getTime()) / (365.25 * 24 * 3600 * 1000);
  return Math.max(1, Math.floor(years));
}

/** "3 days ago", "2 weeks ago", "5 months ago". */
export function timeAgo(iso, now = new Date()) {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const days = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 86_400_000));
  const unit = (n, word) => `${n} ${word}${n === 1 ? "" : "s"} ago`;
  if (days < 1) return "today";
  if (days < 7) return unit(days, "day");
  if (days < 31) return unit(Math.floor(days / 7), "week");
  if (days < 365) return unit(Math.floor(days / 30), "month");
  return unit(Math.floor(days / 365), "year");
}

/** 754 → "12:34", 3723 → "1:02:03". */
export function durationLabel(seconds) {
  if (!Number.isFinite(seconds)) return "";
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
