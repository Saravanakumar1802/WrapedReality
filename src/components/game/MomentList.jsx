import { useState } from "react";
import { formatTime } from "@/lib/math.js";
import styles from "./MomentList.module.css";

export const KIND_LABEL = {
  boss: "Boss",
  story: "Story",
  combat: "Fight",
  exploration: "Area",
  puzzle: "Puzzle",
  collectible: "Collectible",
  tip: "Tip",
  funny: "Funny",
  emotional: "Moment",
  ending: "Ending",
  other: "",
};

/**
 * Chapters for the current video: the creator's moments and the AI index's.
 * Spoilers stay blurred until tapped (or "Show spoilers" for all).
 * @param {{ moments: any[], time: number, onSeek: (m: any) => void }} props time = current position, -1 before playing
 */
export default function MomentList({ moments, time, onSeek }) {
  const [revealAll, setRevealAll] = useState(false);
  const [revealed, setRevealed] = useState(() => new Set());
  const spoilers = moments.some((m) => m.spoiler);
  const fromAi = moments.some((m) => m.source === "ai");
  let active = -1;
  if (time >= 0) moments.forEach((m, i) => m.t <= time + 0.5 && (active = i));

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h3 className={styles.title}>Jump to a moment</h3>
        {spoilers && (
          <label className={styles.toggle}>
            <input type="checkbox" checked={revealAll} onChange={(e) => setRevealAll(e.target.checked)} />
            Show spoilers
          </label>
        )}
      </div>
      <ol className={styles.list}>
        {moments.map((m, i) => {
          const hidden = m.spoiler && !revealAll && !revealed.has(i);
          return (
            <li key={`${m.videoId}-${m.t}-${i}`}>
              <button
                type="button"
                className={styles.moment}
                data-active={i === active}
                onClick={() => {
                  if (hidden) setRevealed((s) => new Set(s).add(i));
                  else onSeek(m);
                }}
                aria-label={hidden ? `Spoiler at ${formatTime(m.t)}: tap to reveal` : `Play from ${formatTime(m.t)}: ${m.label}`}
              >
                <span className={`mono ${styles.time}`}>{formatTime(m.t)}</span>
                <span className={styles.body} data-spoiler={hidden || undefined}>
                  <span className={styles.label}>
                    {m.kind && KIND_LABEL[m.kind] && (
                      <span className={styles.kind} data-kind={m.kind}>
                        {KIND_LABEL[m.kind]}
                      </span>
                    )}
                    {m.label}
                  </span>
                  {m.detail && <span className={styles.detail}>{m.detail}</span>}
                </span>
                {hidden && <span className={styles.reveal}>Spoiler · tap to show</span>}
              </button>
            </li>
          );
        })}
      </ol>
      {fromAi && <p className={styles.note}>Moments marked by type were found by AI from the video&apos;s captions.</p>}
    </div>
  );
}
