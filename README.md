# WrapedReality

The game library of the **WrapedReality** YouTube channel. Every game is shown as its **real PS5 / PS4 / PC case**. Visitors pull a case off a 3D shelf, read what the game left the player, and **jump straight to any moment inside the playthrough videos**.

**Stack:** React 19 (JSX) + Vite + React Router · three.js + React Three Fiber · GSAP + Lenis · Gemini (free tier, build time) · Transformers.js MiniLM (in the browser). Fully static: no server and no database. Keys are used only at build time.

---

## What a visitor can do

| Feature | Where | What it's for |
|---|---|---|
| **The shelf** | `/shelf` | Browse every game as its real case: pull one out, open it, take the disc out. Previous/next lets you flip through cases without putting each one back. |
| **Find any moment** | `/moments`, home page | Search *inside* every playthrough: "Valkyrie boss", "how to solve the bridge puzzle", "the ending". You land on the exact second of the video. Spoilers stay blurred until you choose to see them. |
| **Jump to a moment** | each game page | Chapters for every video (from the creator and the AI index). Click one to seek the player. |
| **Continue watching** | home, `/moments`, game pages | The site remembers where *you* stopped in each video ("Resume at 23:10"). This is stored only in your browser. |
| **Search by feeling** | home page | "something calm and lonely" → games that feel like that. |
| **Journey** | `/journey` | The games in the order they were played (from video dates). |

## Why YouTube and an LLM, and what each one does

**YouTube Data API: the source of truth for the videos.** It provides:

- Which videos belong to which game (playlists, then titles).
- When each was published (this orders the Journey).
- Each video's length and description (chapters).
- With the owner's permission, the captions.

**An LLM (Gemini's free tier by default): turns hours of footage into a searchable index.** A 3-hour playthrough is unsearchable: YouTube finds *a video*, not the 40 seconds inside it where a boss is beaten. At build time, the model reads each video's transcript and chapters and returns the moments a viewer would look for (bosses, story beats, areas, puzzles, collectibles, tips, funny and emotional bits, the ending). Each moment has:

- an exact timestamp taken from the transcript (never invented)
- a concrete title and description
- a spoiler flag
- search tags (character, place and item names)

Nobody can do that by hand for hundreds of hours of video; a language model does it well.

**MiniLM in the visitor's browser** turns their query into a vector and ranks moments by meaning. "The part where the kid gets sick" finds the moment without those exact words. It runs locally: nothing typed leaves the page.

**What is not AI:** the takeaways. "What it left me" is the creator's own writing in `content/<slug>.md`. The AI never writes in the creator's voice. When the creator writes moments by hand, they take priority over the AI's.

**Cost: $0 on Gemini's free tier, and very few tokens either way.** Each video is indexed once (cached by content hash in `cache/moments.json`, which you should commit; switching model never re-indexes). The transcript is compressed before sending: 30-second windows, filler words and [Music] tags removed, repeated lines dropped. The answer is one compact line per moment instead of JSON, with about one moment per 4 minutes of video, a capped answer size, and no "thinking" tokens. Measured: a 30-minute sample took 446 input + 268 output tokens. At most 25 videos are indexed per run (`LLM_MAX_VIDEOS`), so the free daily limit is never used up in one go.

---

## Quick start

```bash
npm install
npm run data      # fetch art + videos, index moments, sort games → src/data/generated + public/data
npm run dev       # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run data` | Build pipeline. It runs, in order: validate games, YouTube, transcripts, cover art, IGDB, Steam hours, embeddings, scores, AI moment index, UMAP layout, then writes the data files. Every step is optional and falls back gracefully. |
| `npm run data:offline` | Same, without network calls for art |
| `npm run youtube:auth` | One-time Google sign-in so the build can download your videos' captions (see API keys) |
| `npm run models` | Download and optimise the console 3D models (needs `SKETCHFAB_TOKEN`) |
| `npm run dev` / `build` / `preview` | Dev server / production build to `dist/` / serve `dist/` on :4173 |
| `npm run lint` / `format` / `test` | ESLint / Prettier / unit tests (Vitest) |
| `npm run test:e2e` | Playwright tests against the build (`npm run build` first; the first time, `npx playwright install chromium`) |
| `npm run check` | lint + format check + unit tests + build |

---

## API keys: exactly how to get each one

Put keys in **`.env.local`** (copy `.env.example`). Every key is optional. Keys are read only by `scripts/` at build time and never reach the browser. For the weekly automatic refresh, add the same values as GitHub repository secrets (see *Weekly refresh*).

### 1. YouTube Data API key → videos, playlists, chapters (`YT_API_KEY`, `YT_CHANNEL_ID`)

1. Go to <https://console.cloud.google.com/>, sign in, and click **Select a project → New project**. Name it (e.g. `wrapedreality-site`), then click **Create**.
2. With the project selected, open **APIs & Services → Library**, search **YouTube Data API v3**, and click **Enable**.
3. Open **APIs & Services → Credentials → + Create credentials → API key**. Copy the key.
4. Click the new key, and under **API restrictions** choose **Restrict key → YouTube Data API v3**, then **Save**.
5. Find your channel ID: open <https://www.youtube.com/account_advanced> (signed in as the channel). It starts with `UC`.
6. In `.env.local`:
   ```
   YT_API_KEY=AIza...
   YT_CHANNEL_ID=UCxxxxxxxxxxxxxxxxxxxxxx
   VITE_YT_CHANNEL_URL=https://www.youtube.com/@WrapedReality
   ```
   Tip: one playlist per game, named after the game, gives perfect matching. The free quota (10,000 units a day) is far more than this site uses.

### 2. YouTube captions (owner only) → full transcripts for the moment index (`YT_OAUTH_*`)

YouTube only gives caption files to the channel owner, so this uses a one-time Google sign-in rather than the API key.

1. In the same Google Cloud project, open **APIs & Services → OAuth consent screen** (called **Google Auth Platform** in newer consoles). Choose **External** and fill in the app name and your email. Under **Audience → Test users**, add the Google account that owns the channel. Leave it in *Testing*.
2. Open **APIs & Services → Credentials → + Create credentials → OAuth client ID**. Choose **Application type: Desktop app**, then **Create**. Copy the **Client ID** and **Client secret** into `.env.local`:
   ```
   YT_OAUTH_CLIENT_ID=....apps.googleusercontent.com
   YT_OAUTH_CLIENT_SECRET=GOCSPX-...
   ```
3. Run `npm run youtube:auth`, open the printed link, sign in as the channel owner, and allow access. If Google warns that the app isn't verified, click **Continue** (it is your own app). The script saves `YT_OAUTH_REFRESH_TOKEN` to `.env.local` for you.
4. Run `npm run data`. Captions download once each and are cached in `cache/transcripts/`. Each video costs about 250 quota units, so a big channel is fetched over a few days automatically.

No OAuth? Two alternatives:

- Download captions from **YouTube Studio → Subtitles → ⋮ → Download (.srt)** and save them as `content/transcripts/<videoId>.srt`.
- Put chapters (`12:34 Boss fight`) in your video descriptions; those work with just the API key.

> Apps left in *Testing* get refresh tokens that expire after 7 days. For the weekly GitHub refresh, either publish the consent screen (**Publish app**; Google may ask for verification because the scope is sensitive), or re-run `npm run youtube:auth` when the build reports an expired token. Cached captions are never re-downloaded, so this only matters for new videos.

### 3. Gemini API key (free) → the AI moment index (`GEMINI_API_KEY`)

1. Go to <https://aistudio.google.com/apikey> and sign in with any Google account.
2. Click **Create API key** (pick or create a project). Don't create it in the Cloud Console "Credentials" page; that one needs a service account for Gemini.
3. Keep the project on the **Free** tier (no billing account) and Google cannot charge you: when the daily limit is reached, requests simply stop until the next day.
4. In `.env.local`: `GEMINI_API_KEY=...`, then run `npm run data`.

Free tier content may be used by Google to improve its products; the input here is your own public video captions. Backups (optional): `OPENROUTER_API_KEY` for OpenRouter's `:free` models (50 requests/day), or `ANTHROPIC_API_KEY` for Claude (paid). Force one with `LLM_PROVIDER=gemini|openrouter|anthropic`.

### 4. IGDB → art for games Steam and Wikipedia don't cover, plus genres (`IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`)

1. Turn on **two-factor authentication** on your Twitch account (required).
2. Go to <https://dev.twitch.tv/console/apps> and click **Register Your Application**. Use OAuth Redirect URL `http://localhost`, category *Website Integration*, and client type *Confidential*.
3. Click **Manage**, copy the **Client ID**, then click **New Secret** and copy that too.

### 5. Steam Web API → hours for PC games (`STEAM_API_KEY`, `STEAM_ID`)

1. Get a key at <https://steamcommunity.com/dev/apikey>, plus your 17-digit SteamID64.
2. Set your profile's **Game details** to **Public**, and add `steamAppId` to the PC games in `src/data/games.js`.

### 6. Sketchfab → console 3D models (`SKETCHFAB_TOKEN`)

Go to <https://sketchfab.com/settings/password>, copy the **API Token**, then run `npm run models`.

### Weekly refresh

Add the keys above as **GitHub → repo → Settings → Secrets and variables → Actions → New repository secret**, using the same names. `.github/workflows/refresh-data.yml` re-runs the pipeline every Monday, indexes new videos, verifies everything, and commits the new data. Your host redeploys on the push.

---

## Project structure

```
src/
  main.jsx · router.jsx · Layout.jsx      app shell; routes are code-split, the game page loads its data in a route loader
  pages/                                  Home · Shelf (also genre/mood/platform) · Game · Moments · Journey · About · NotFound
  components/
    home/          hero, console turntable, marquee, Feel-search
    shelf/         ShelfExperience (state + gestures), CasePanel (stepper, prev/next), ShelfListView
    game/          GameStage, VideoPlayer (deep links, resume), MomentList (chapters, spoilers), takeaway, genre DNA
    moments/       MomentSearch, ContinueWatching, useMomentIndex
    worlds/        WorldsFlight (scroll-driven genre fly-through)
    space/         SpaceField (site-wide star field)
    ui/            header, footer, logo (+ logoMark.js, shared with the boot loader), command palette, scroll effects
    three/
      canvas/      SceneCanvas (shared renderer setup), entries/ (one lazy chunk per scene), CompileGate, Effects, StudioLights
      scenes/      shelf/ (ShelfScene, ShelfCases, CaseFlyer, Cabinet, Room, RowLamp) · case/ · consoles/
      objects/     GameCase, Disc, RealConsole, CodeConsoles
      art/         canvas-drawn print (covers, spines, labels) + caseTextureCache
      materials/   materials, wood, localLights
      geometry/    caseGeometry
  hooks/           useSwipe, useSearchStatus
  workers/         semanticSearch.worker.js (MiniLM in the browser)
  lib/             pure logic, unit-tested: layout, shelfMachine, momentIndex, watchProgress, semanticSearch, scoring, math…
  data/            games.js (you edit), taxonomy.js, generated/ (built)
  theme/           the whole look, in one place
scripts/           build pipeline: youtube, transcripts, moments + llm (Gemini / OpenRouter / Claude), covers, igdb, steam, embed, models
content/           your takeaways (<slug>.md) and optional caption files (transcripts/<videoId>.srt)
public/data/       per-game records, search vectors, moment index (all written by `npm run data`)
tests/unit         Vitest (113 tests)   ·   tests/e2e   Playwright (desktop + phone)
```

## Performance: what keeps it fast

- **Shaders compile off the main thread.** Each 3D canvas compiles its shaders in the background (`compileAsync`) before drawing its first frame. Content that appears later (spine labels, brass plates, the detailed case) is mounted hidden in a `CompileGate` and shown once ready. Shaders are compiled for the variant the post-processing composer actually draws (`compileForScene`). Before this, the shelf froze the page for several seconds while loading and again on the first click.
- **Fewer lights per shader.** The room's RGB wash and neon tubes sit behind the cases, so only the wall and timber evaluate them (`materials/localLights.js`). Row lamps use two light sets that follow the camera instead of one set per row. Case shaders went from 14 point + 4 area lights to 5 + 2, with an identical image.
- **Stable shader variants.** Shadows use PCF from the start (three converts the old soft type on the first shadow frame, which recompiled everything). Low-quality mode keeps the composer and drops only bloom (removing it used to recompile every material).
- **Canvases measure layout size, not transformed size**, so scaling the hero on scroll no longer resizes and reallocates the canvas each frame.
- **Shadows re-render only when something moves.**
- **Pulling a case is cheap.** Its five print textures are drawn one per frame, prefetched on hover or press and for prev/next neighbours, and reused from a small cache. Picking is gap-free arithmetic instead of raycasting 83 cases.
- **Small downloads.** One lazy chunk per 3D scene (the shelf's area-light tables load only on the shelf). The game page fetches a ~4 KB record instead of bundling every game. The 3D chunk dropped from 1.40 MB to 1.10 MB by building the reflection studio without drei's HDR loaders.
- **Phones:** no MSAA pass on dense screens, a lower pixel ratio when frames drop, and a bottom-sheet panel the case frames itself around.

Rule of thumb for new 3D work: reuse existing materials, don't add scene lights that only light the background (make them local), and gate anything that appears after load.

---

## Adding games

1. Add an entry to `src/data/games.js`:
   ```js
   { title: "Gran Turismo 7", platform: "PS5", category: "Racing", tags: ["racing", "sports"],
     palette: ["#1A3A8A", "#E8E8E8"], year: 2022, aliases: ["GT7"],
     summary: "Car-culture racing sim with a café full of history." },
   ```
   - `platform`: `PS5` | `PS4` | `PS2` | `PC`. New platform shelves appear automatically.
   - `tags`: genre keys from `src/data/taxonomy.js`. The first tag is the strongest.
   - Optional art pins, used only if the automatic match is wrong: `artSteamId`, `wikiTitle`, `cropTop`.
2. Run `npm run data`.

Same game on two shelves: give the second copy an `id` (e.g. `id: "watch-dogs-2-pc"`).

## Writing takeaways and moments

Copy `content/_template.md` to `content/<slug>.md` (the slug is the URL part of `/game/<slug>`):

```md
---
mood: peace            # optional: peace | fear | adrenaline | grief | wonder
playlistId: PLxxxx     # optional: the YouTube playlist for this game
moments:               # optional: your own moments (they win over the AI's)
  - { t: "12:34", label: "Sunrise ride, the moment the peace hit" }
---
Playing RDR2 taught me how much calm lives in slow moments...
```

## Theming (one place)

| File | Controls |
|---|---|
| `src/theme/themes/eclipse.js` | Every colour, platform case colours, genre/mood colours, star field, 3D lighting and materials, radii, shadows, motion |
| `src/theme/index.js` | `ACTIVE_THEME`: switch themes here |
| `src/main.jsx` | Font files (`@fontsource` imports) |

The theme becomes CSS variables injected into `index.html` at build time, and the 3D scenes read the same object. Tests fail if a hex colour appears in `src` outside `src/theme` and `src/data`.

## Name and logo

The site name lives in `src/lib/site.js` (`SITE.name`, `SITE.wordmark`, tagline, description). The mark, a game disc with a W printed on its label, is defined once in `src/components/ui/logoMark.js` and used by both the header and the boot loader. `public/brand/favicon.svg` is the matching icon.

## Deploy

- **Vercel**: import the repo, framework preset *Vite*, output `dist`. `vercel.json` already rewrites deep links.
- **Netlify / Cloudflare Pages**: build `npm run build`, publish `dist`. `public/_redirects` handles deep links.
- **GitHub Pages**: `dist/404.html` serves deep links.

Cover art and logos belong to their publishers and are shown only to identify each game. PlayStation names and logos are Sony trademarks. This is a personal, non-commercial fan site.
