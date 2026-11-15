import consoleModels from "@/data/generated/models.json";
import { meta } from "@/lib/data.js";
import styles from "./SiteNotes.module.css";

/** How this site works (honestly, including what the AI does and doesn't do), and the credits. */
export default function SiteNotes() {
  const updated = new Date(meta.generatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return (
    <section className={`container ${styles.section}`} aria-labelledby="notes-title">
      <div className={styles.grid}>
        <div className={styles.prose}>
          <span className={`hud ${styles.eyebrow}`}>About this site</span>
          <h2 id="notes-title" className={styles.h2}>
            The channel&apos;s library
          </h2>
          <p>
            Every game from the channel, shown as its real case, with the videos where it was played. Playthroughs are long, so each video
            is indexed scene by scene: an AI model reads the captions and marks the moments worth finding (bosses, story beats, puzzles,
            tips, the ending), each with its exact timestamp and a spoiler flag. Search for one and the video opens at that second.
          </p>
          <p>The takeaways on each game page are always written by me, never by the AI.</p>
        </div>
        <dl className={styles.facts}>
          <div>
            <dt>Games</dt>
            <dd>{meta.count}</dd>
          </div>
          <div>
            <dt>Videos linked</dt>
            <dd>{meta.videoCount ?? 0}</dd>
          </div>
          {meta.momentCount > 0 && (
            <div>
              <dt>Moments indexed</dt>
              <dd>{meta.momentCount}</dd>
            </div>
          )}
          <div>
            <dt>Updated</dt>
            <dd>{updated}</dd>
          </div>
        </dl>
      </div>

      <details className={styles.credits}>
        <summary>Credits and legal</summary>
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
      </details>
    </section>
  );
}
