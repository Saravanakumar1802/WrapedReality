/**
 * Flight plan for the home page's fly-through archive ("Worlds").
 * Games are grouped (by genre or mood) and laid out along one depth axis: each
 * group opens with a gate, then its games stream past on alternating sides.
 * Pure + deterministic, so the route is identical on every visit.
 */
import { hashString, mulberry32 } from "./math.js";

export const FLIGHT = Object.freeze({
  start: 1.5, // depth of the first gate when the flight begins
  titleLead: 1.5, // gap between a gate and its first game (the title needs clear space behind it)
  step: 0.42, // gap between games
  groupGap: 1.3, // gap between the last game of a group and the next gate
  tail: 0.9, // extra depth after the last game so it can fly past
  unit: 1000, // CSS px per depth unit (translateZ)
  scrollPerDepth: 210, // scrolled px per depth unit
  near: -0.25, // items closer than this are behind the camera
  far: 5.2, // items further than this are not drawn
});

/**
 * @template {{ slug: string }} G
 * @param {G[]} games
 * @param {(g: G) => string} keyOf group key for a game
 * @param {string[]} order group keys in flight order (empty groups are skipped)
 * @returns {{ groups: { key: string, depth: number, count: number }[],
 *   items: { slug: string, key: string, depth: number, x: number, y: number }[], length: number }}
 */
export function flightPlan(games, keyOf, order) {
  const groups = [];
  const items = [];
  let depth = FLIGHT.start;
  for (const key of order) {
    const members = games.filter((g) => keyOf(g) === key);
    if (!members.length) continue;
    groups.push({ key, depth: round(depth), count: members.length });
    depth += FLIGHT.titleLead;
    members.forEach((g, i) => {
      const rnd = mulberry32(hashString(g.slug));
      const side = i % 2 === 0 ? -1 : 1;
      items.push({
        slug: g.slug,
        key,
        depth: round(depth),
        x: round(side * (0.5 + rnd() * 0.45)), // -1..1, never dead centre
        y: round((rnd() * 2 - 1) * 0.72),
      });
      depth += FLIGHT.step;
    });
    depth += FLIGHT.groupGap - FLIGHT.step;
  }
  return { groups, items, length: round(depth - FLIGHT.groupGap + FLIGHT.tail) };
}

/** Opacity of something at relative depth r (0 = at the camera): fades in from far, out when passing. */
export function depthOpacity(r, passAt = FLIGHT.near, passFade = 0.3) {
  const fadeIn = (FLIGHT.far - 0.6 - r) / 1.4;
  const fadeOut = (r - passAt) / passFade;
  return Math.max(0, Math.min(1, fadeIn, fadeOut));
}

/** The group the camera is currently inside (its gate is at or just ahead of the camera). */
export function activeGroup(groups, camera, lookAhead = 0.8) {
  let active = groups[0]?.key ?? null;
  for (const g of groups) if (g.depth - lookAhead <= camera) active = g.key;
  return active;
}

const round = (v) => Math.round(v * 1000) / 1000;
