/** Reads hand-written content/<slug>.md files (takeaway body + frontmatter). */
import fs from "node:fs/promises";
import matter from "gray-matter";
import { ContentSchema } from "./schema.mjs";
import { parseTimestamp } from "../src/lib/match.js";
import { log, p } from "./util.mjs";

/**
 * @param {Set<string>} slugs known game slugs
 * @returns {Promise<Record<string, any>>}
 */
export async function readContent(slugs) {
  const dir = p("content");
  let files = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md") && !f.startsWith("_"));
  } catch {
    return {};
  }
  const out = {};
  for (const file of files) {
    const slug = file.replace(/\.md$/, "");
    if (!slugs.has(slug)) {
      log.warn(`content/${file}: no game with slug "${slug}" — skipped (see README for slugs).`);
      continue;
    }
    const raw = await fs.readFile(`${dir}/${file}`, "utf8");
    const { data, content } = matter(raw);
    const parsed = ContentSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(`content/${file}: invalid frontmatter\n${parsed.error.message}`);
    }
    const fm = parsed.data;
    const moments = (fm.moments ?? []).map((m) => {
      const t = parseTimestamp(m.t);
      if (!Number.isFinite(t)) throw new Error(`content/${file}: bad moment time "${m.t}"`);
      return { t, label: m.label, ...(m.videoId ? { videoId: m.videoId } : {}) };
    });
    const takeaway = content
      .split(/\r?\n\s*\r?\n/)
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    out[slug] = { ...fm, moments: moments.sort((a, b) => a.t - b.t), takeaway };
  }
  log.ok(`Content: ${Object.keys(out).length} takeaway file(s)`);
  return out;
}
