/** Runtime validation for curated data, content files and API responses. */
import { z } from "zod";
import { GENRE_KEYS, MOOD_KEYS, PLATFORMS } from "../src/data/taxonomy.js";

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "expected #RRGGBB");
const platform = z.enum(PLATFORMS);

export const GameSeedSchema = z.object({
  title: z.string().min(1),
  id: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase-with-dashes")
    .optional(),
  platform,
  platforms: z.array(platform).optional(),
  category: z.string().min(1),
  tags: z.array(z.enum(GENRE_KEYS)).min(1),
  summary: z.string().min(1),
  palette: z.tuple([hex, hex]),
  aliases: z.array(z.string()).optional(),
  steamAppId: z.number().int().positive().optional(),
  igdbId: z.number().int().positive().optional(),
  artSteamId: z.number().int().positive().optional(),
  wikiTitle: z.string().optional(),
  artFrom: z.enum(["steam", "wikipedia"]).optional(),
  logoTone: z.enum(["white", "original"]).optional(),
  cropTop: z.number().min(0).max(0.3).optional(),
  note: z.string().optional(),
  year: z.number().int().min(1980).max(2100).optional(),
});

export const ContentSchema = z.object({
  mood: z.enum(MOOD_KEYS).optional(),
  playlistId: z.string().optional(),
  videoIds: z.array(z.string()).optional(),
  playedOrder: z.number().int().optional(),
  hours: z.number().nonnegative().optional(),
  trophies: z.number().int().nonnegative().optional(),
  moments: z
    .array(
      z.object({
        t: z.union([z.number().nonnegative(), z.string()]),
        label: z.string().min(1),
        videoId: z.string().optional(),
      }),
    )
    .optional(),
});

export const YtItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  publishedAt: z.string().nullable().optional(),
  description: z.string().optional(),
  duration: z.number().nonnegative().nullable().optional(),
});
