import { test, expect } from "@playwright/test";
import fs from "node:fs";

/**
 * The moment search, end to end, with a fixture index (the real one only exists
 * once YouTube and the AI step are connected). The semantic model is blocked, so
 * this also proves the instant keyword path works on its own.
 */
const SLUG = "god-of-war";
const VIDEO = "abcdefghijk";
const game = JSON.parse(fs.readFileSync(new URL(`../../public/data/games/${SLUG}.json`, import.meta.url), "utf8"));

const momentIndex = {
  model: null,
  dim: 0,
  games: [SLUG],
  items: [
    {
      g: 0,
      v: VIDEO,
      t: 600,
      label: "Boss: Valkyrie in the hidden chamber",
      kind: "boss",
      spoiler: false,
      text: "Boss: Valkyrie in the hidden chamber. valkyrie, boss. God of War",
    },
    { g: 0, v: VIDEO, t: 1800, label: "Atreus collapses", kind: "story", spoiler: true, text: "Atreus collapses. atreus. God of War" },
  ],
};

const gameWithVideo = {
  ...game,
  videos: [{ id: VIDEO, title: "God of War, part 3", publishedAt: null, duration: 3600, summary: "Into the mountain." }],
  moments: [
    {
      t: 600,
      label: "Boss: Valkyrie in the hidden chamber",
      kind: "boss",
      spoiler: false,
      videoId: VIDEO,
      source: "ai",
      detail: "A tough fight.",
    },
    { t: 1800, label: "Atreus collapses", kind: "story", spoiler: true, videoId: VIDEO, source: "ai", detail: "He falls ill." },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.route("**/data/moments.json", (r) => r.fulfill({ json: momentIndex }));
  await page.route(`**/data/games/${SLUG}.json`, (r) => r.fulfill({ json: gameWithVideo }));
  await page.route("https://cdn.jsdelivr.net/**", (r) => r.abort());
  await page.route("https://i.ytimg.com/**", (r) => r.fulfill({ status: 204 }));
  await page.route("https://www.youtube.com/**", (r) => r.abort());
});

test("moment search finds a scene and opens the video at that second", async ({ page }) => {
  await page.goto("/moments");
  await page.waitForFunction(() => !document.getElementById("boot"), null, { timeout: 45_000 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Find any moment");

  await page.locator("#moment-input").fill("valkyrie");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const hit = page.locator(`a[href="/game/${SLUG}?v=${VIDEO}&t=600#videos"]`);
  await expect(hit).toBeVisible();
  await expect(hit).toContainText("Valkyrie");

  await hit.click();
  await expect(page).toHaveURL(new RegExp(`/game/${SLUG}\\?v=${VIDEO}&t=600`));
  await expect(page.getByRole("button", { name: /Play video: .*Play from 10:00/ })).toBeVisible();
  await expect(page.getByText("Into the mountain.")).toBeVisible();
});

test("spoilers stay blurred until asked for", async ({ page }) => {
  await page.goto(`/game/${SLUG}`);
  await page.waitForFunction(() => !document.getElementById("boot"), null, { timeout: 45_000 });
  const spoiler = page.getByRole("button", { name: /Spoiler at 30:00/ });
  await expect(spoiler).toBeVisible();
  await page.getByLabel("Show spoilers").check();
  await expect(page.getByRole("button", { name: /Play from 30:00: Atreus collapses/ })).toBeVisible();
});

test("search on a spoiler result reveals it before opening it", async ({ page }) => {
  await page.goto("/moments");
  await page.waitForFunction(() => !document.getElementById("boot"), null, { timeout: 45_000 });
  await page.locator("#moment-input").fill("atreus");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const hit = page.locator(`a[href*="t=1800"]`);
  await hit.click(); // first tap reveals
  await expect(page).toHaveURL(/\/moments$/);
  await hit.click(); // second tap opens
  await expect(page).toHaveURL(/t=1800/);
});
