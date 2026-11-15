import { test, expect } from "@playwright/test";
import fs from "node:fs";

/** Navigate, then wait for the boot loader to leave (as a visitor does before using the page). */
async function open(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => !document.getElementById("boot"), null, { timeout: 45_000 });
}

const dataset = JSON.parse(fs.readFileSync(new URL("../../src/data/generated/games.json", import.meta.url), "utf8"));

const ROUTES = [
  "/",
  "/shelf",
  "/genre/action",
  "/mood/fear",
  "/platform/ps5",
  "/game/ghost-of-tsushima",
  "/moments",
  "/journey",
  "/about",
  "/does-not-exist",
];

/** Fail on any page error or console error (ignoring third-party network noise). */
function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/Failed to load resource|ERR_|youtube|ytimg|net::/i.test(t)) return;
    errors.push(`console: ${t}`);
  });
  return errors;
}

for (const route of ROUTES) {
  test(`renders ${route} without errors`, async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, route);
    await expect(page.locator("h1").first()).toBeVisible();
    await page.waitForTimeout(2000);
    expect(errors).toEqual([]);
  });
}

test("home hero: tiles switch the featured game", async ({ page }) => {
  await open(page, "/");
  const rail = page.getByRole("listbox", { name: "Games" });
  const second = rail.getByRole("option").nth(1);
  const name = await second.getAttribute("aria-label");
  await second.click();
  await expect(rail.locator('[aria-selected="true"]')).toHaveAttribute("aria-label", name);
});

test("worlds flight: the rail jumps between genres and modes switch", async ({ page }) => {
  const errors = watchErrors(page);
  await open(page, "/");
  const rail = page.getByRole("navigation", { name: "Jump to a genre" });
  await rail.scrollIntoViewIfNeeded();
  await expect(rail.locator('[aria-current="true"]')).toHaveText(/Action/);
  await rail.getByRole("button", { name: "Horror" }).click();
  await expect(rail.locator('[aria-current="true"]')).toHaveText(/Horror/, { timeout: 8000 });
  // a case near the camera is a working link
  await expect(page.locator("#archive a[href^='/game/']")).toHaveCount(dataset.games.length);
  await page.getByRole("button", { name: "Moods" }).click();
  await expect(page.getByRole("navigation", { name: "Jump to a mood" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("shelf: scrolling the page moves the camera down the cabinet", async ({ page }) => {
  await open(page, "/shelf");
  // more than one row → the page grows a scroll track once the 3D scene has measured itself
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight), { timeout: 15000 })
    .toBeGreaterThan(300);
});

test("game page: open case and take out the disc", async ({ page }) => {
  const errors = watchErrors(page);
  await open(page, "/game/red-dead-redemption-2");
  await page.getByRole("button", { name: "Open the case" }).click();
  await page.getByRole("button", { name: "Take out the disc" }).click();
  await expect(page.getByRole("button", { name: "Flip the disc" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Take out the disc" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("shelf: keyboard pull-out, open, put back", async ({ page }) => {
  const errors = watchErrors(page);
  await open(page, "/shelf");
  await page.waitForTimeout(1500);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Open the case" })).toBeVisible();
  await page.getByRole("button", { name: "Open the case" }).click();
  await expect(page.getByRole("button", { name: "Take out the disc" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open the case" })).toHaveCount(0, { timeout: 5000 });
  expect(errors).toEqual([]);
});

test("command palette finds a game", async ({ page }) => {
  await open(page, "/about");
  await expect(page.locator("h1")).toBeVisible(); // app mounted
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Search games, genres, moods").fill("ragnar");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/god-of-war-ragnarok/);
});

test("list view shows every game", async ({ page }) => {
  await open(page, "/shelf");
  await page.getByRole("button", { name: "List" }).click();
  await expect(page.locator("main a[href^='/game/']")).toHaveCount(dataset.games.length);
});

test("deep link loads directly (SPA fallback)", async ({ page }) => {
  await open(page, "/game/the-witcher-3-wild-hunt");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page).toHaveTitle(/Witcher/);
});

test("navigating to a new page starts at the top", async ({ page }) => {
  await open(page, "/about");
  await expect(page.locator("h1")).toBeVisible();
  await page.locator("footer").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.locator("footer").getByRole("link", { name: "The shelf" }).click();
  await expect(page).toHaveURL(/\/shelf$/);
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(40);
});

test("boot loader: shows progress, then hands over to the page", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  const loader = page.locator("#boot");
  await expect(loader).toBeVisible();
  await expect(loader).toHaveAttribute("role", "progressbar");
  await expect(loader).toBeHidden({ timeout: 45_000 }); // removed once the page is ready
  await expect(page.locator("html")).not.toHaveClass(/is-booting/); // page scrolls again
  await expect(page.locator("header [data-logo-mark]")).toBeVisible(); // the logo landed
  await expect(page.locator("h1").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("shelf: browse to the next case without putting the first one back", async ({ page }) => {
  const errors = watchErrors(page);
  await open(page, "/shelf");
  await page.waitForTimeout(1500);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  const panel = page.getByRole("complementary");
  await expect(panel).toBeVisible();
  const first = await panel.getByRole("heading", { level: 2 }).textContent();
  await page.getByRole("button", { name: /^Next: / }).click();
  await expect(panel.getByRole("heading", { level: 2 })).not.toHaveText(first ?? "");
  // stepper jumps straight to the disc
  await page.getByRole("button", { name: "Hold the disc" }).click();
  await expect(page.getByRole("button", { name: "Flip the disc" })).toBeVisible();
  // close button puts it back from any stage
  await page.getByRole("button", { name: "Put the case back on the shelf" }).click();
  await expect(panel).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("shelf: a tap between two spines still pulls out a case", async ({ page }) => {
  await open(page, "/shelf");
  await page.waitForTimeout(2000);
  const stage = page.locator("[data-selected]");
  const box = await stage.boundingBox();
  // the middle of the row: with an even number of cases this lands in the gap between two spines
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.45);
  await expect(page.getByRole("complementary")).toBeVisible({ timeout: 8000 });
});

test("no page scrolls sideways on a phone", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout only");
  for (const route of ["/", "/shelf", "/game/ghost-of-tsushima", "/moments", "/journey", "/about"]) {
    await open(page, route);
    await page.waitForTimeout(800);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, route).toBeLessThanOrEqual(1);
  }
});
