/** Steam Web API — hours played for games with a steamAppId. Optional. */
import { env, fetchJson, log } from "./util.mjs";

/** @returns {Promise<Record<number, number>>} appId → hours */
export async function fetchSteamHours(games) {
  const key = env("STEAM_API_KEY");
  const steamId = env("STEAM_ID");
  const wanted = games.filter((g) => g.steamAppId);
  if (!wanted.length) return {};
  if (!key || !steamId) {
    log.warn("Steam: STEAM_API_KEY / STEAM_ID not set — skipping hours.");
    return {};
  }
  try {
    const url = new URL("https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/");
    url.search = new URLSearchParams({ key, steamid: steamId, include_appinfo: "1", format: "json" }).toString();
    const data = await fetchJson(url);
    const out = {};
    for (const g of data.response?.games ?? []) out[g.appid] = Math.round((g.playtime_forever / 60) * 10) / 10;
    log.ok(`Steam: ${Object.keys(out).length} owned games`);
    return out;
  } catch (err) {
    log.warn(`Steam failed (${err.message}) — skipping hours.`);
    return {};
  }
}
