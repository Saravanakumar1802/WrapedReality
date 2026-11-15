import consoleModels from "@/data/generated/models.json";
import { pageTitle } from "@/lib/site.js";
import { Link } from "react-router";
import { meta } from "@/lib/data.js";
import styles from "./About.module.css";

const CHANNEL = import.meta.env.VITE_YT_CHANNEL_URL || "";

export default function About() {
  return (
    <div className={`container ${styles.page}`}>
      <title>{pageTitle("About and credits")}</title>
      <span className="hud">About</span>
      <h1 className={styles.h1} data-fx="lines">
        Why this exists
      </h1>
      <div className={styles.cols}>
        <div className={styles.prose}>
          <p className="lede">
            I play a lot, and I record a lot. This is the WrapedReality library: every game from the channel, the one thing each game left
            me with, and the videos where it happened.
          </p>
          <p>
            Playthroughs are long, so every video is indexed scene by scene. An AI model reads each video&apos;s captions and chapters and
            marks the moments worth finding (bosses, story beats, puzzles, tips, the ending), each with its exact timestamp and a spoiler
            flag. Search for a moment and the video opens at that second. The takeaways are always written by me, never by the AI.
          </p>
          <p>
            Nobody sorted these games by hand. Each one is described in words: its genres, a short summary, and my takeaway once I write it.
            An AI model turns that description into numbers and compares it with short descriptions of every genre and mood. The closest
            match decides which shelf a game sits on, and the Genre DNA on every page shows the full match.
          </p>
          <p>
            The archive on the home page lays every game out as a map you can explore. Feel-search runs the same model inside your browser,
            so you can type a feeling and find games without anything leaving the page.
          </p>
          {CHANNEL && (
            <p>
              <a className="btn btn-primary" href={CHANNEL} target="_blank" rel="noreferrer">
                Watch on YouTube
              </a>
            </p>
          )}
        </div>
        <dl className={`panel ${styles.facts}`}>
          <div>
            <dt>Games</dt>
            <dd>{meta.count}</dd>
          </div>
          <div>
            <dt>Real cover art</dt>
            <dd>
              {meta.coverCount ?? 0}/{meta.count}
            </dd>
          </div>
          {meta.momentCount > 0 && (
            <div>
              <dt>Moments indexed</dt>
              <dd>{meta.momentCount}</dd>
            </div>
          )}
          <div>
            <dt>Sorting</dt>
            <dd>{meta.embeddings ? "AI embeddings + tags" : "Tags (AI offline)"}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{new Date(meta.generatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</dd>
          </div>
        </dl>
      </div>

      <section className={styles.credits} aria-labelledby="credits-title">
        <h2 id="credits-title" data-fx="lines">
          Credits
        </h2>
        <ul>
          <li>
            Cover art, key art and logos come from each game&apos;s public store listing (Steam), Wikipedia, or IGDB, and belong to their
            publishers. They are shown only to identify the games.
          </li>
          <li>
            PlayStation, PS5, PS4 and the PlayStation logos are trademarks of Sony Interactive Entertainment. Blu-ray Disc is a trademark of
            the Blu-ray Disc Association. This is a personal, non-commercial fan site, not affiliated with either.
          </li>
          <li>Videos play through the YouTube player and stay on YouTube.</li>
          <li>
            Sorting, Feel-search and moment search use the open all-MiniLM-L6-v2 sentence model, run in your browser with Transformers.js.
          </li>
          <li>The moment index is built from the videos&apos; captions with Google Gemini.</li>
          {Object.entries(consoleModels).map(([key, m]) => (
            <li key={key}>
              {key} 3D model:{" "}
              <a href={m.credit.sourceUrl} target="_blank" rel="noreferrer">
                “{m.credit.title}”
              </a>{" "}
              by{" "}
              <a href={m.credit.authorUrl} target="_blank" rel="noreferrer">
                {m.credit.author}
              </a>
              , licensed under{" "}
              <a href={m.credit.licenseUrl} target="_blank" rel="noreferrer">
                {m.credit.license}
              </a>
              . Compressed for the web; otherwise unchanged.
            </li>
          ))}
        </ul>
        <p>
          <Link to="/shelf">Back to the shelf</Link>
        </p>
      </section>
    </div>
  );
}
