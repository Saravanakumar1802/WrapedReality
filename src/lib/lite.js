/**
 * The "lite" view of a game: just what lists, shelves, rails, search and the 3D
 * scenes need. The build writes these to games.lite.json, which ships with the
 * app; the full records (scores, videos, takeaways, moments) stay in games.json
 * and load only with the game page.
 *
 * Plain module (no "@/" imports) so the Node build script can use it too.
 */

/** @param {any} g a full game record from games.json */
export function toLite(g) {
  return {
    slug: g.slug,
    title: g.title,
    platform: g.platform,
    category: g.category,
    summary: g.summary,
    palette: g.palette,
    cover: g.cover,
    thumb: g.thumb ?? g.cover,
    hero: g.hero,
    logo: g.logo,
    logoDark: g.logoDark ?? false,
    year: g.year,
    note: g.note,
    primaryGenre: g.primaryGenre,
    primaryMood: g.primaryMood,
    shelves: g.shelves,
    hasTakeaway: g.takeaway.length > 0,
    videoCount: g.videos.length,
    firstVideoAt: g.firstVideoAt,
  };
}

/** The whole lite dataset: meta + journey order + lite games (same order as games.json). */
export const toLiteDataset = (data) => ({ meta: data.meta, journey: data.journey, games: data.games.map(toLite) });
