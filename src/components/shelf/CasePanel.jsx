import { forwardRef } from "react";
import { Link } from "react-router";
import { GENRES, MOODS } from "@/data/taxonomy.js";
import styles from "./CasePanel.module.css";

const STEPS = [
  { stage: "out", label: "Case", aria: "Show the closed case" },
  { stage: "open", label: "Open", aria: "Show the open case" },
  { stage: "inspect", label: "Disc", aria: "Hold the disc" },
];

const HINTS = {
  out: { fine: "Click the case to open it.", coarse: "Tap the case to open it. Swipe sideways for the next one." },
  open: { fine: "Click the disc to lift it out.", coarse: "Tap the disc to lift it out." },
  inspect: { fine: "Drag to turn the disc. Double-click to flip it.", coarse: "Drag to turn the disc. Double-tap to flip it." },
};

const BACK_LABEL = { inspect: "Put the disc back", open: "Close the case", out: "Put it back on the shelf" };

/**
 * Details + controls for the case that is out. Every step is one tap away
 * (the stepper jumps straight to any stage), neighbours are one tap away
 * (prev / next), and putting it back is always visible.
 *
 * @param {{ game: any, stage: "out" | "open" | "inspect", position: { index: number, total: number },
 *   prev: any | null, next: any | null, onStage: (s: string) => void, onStep: (dir: 1 | -1) => void,
 *   onBack: () => void, onClose: () => void, onFlip: () => void, onReset: () => void }} props
 */
const CasePanel = forwardRef(function CasePanel(
  { game, stage, position, prev, next, onStage, onStep, onBack, onClose, onFlip, onReset },
  ref,
) {
  const current = STEPS.findIndex((s) => s.stage === stage);
  return (
    <aside ref={ref} className={`panel ${styles.panel}`} aria-label={`${game.title} details`} data-lenis-prevent>
      <div className={styles.head}>
        <p className={styles.meta}>
          <span className={styles.badge} data-platform={game.platform}>
            {game.platform}
          </span>
          <span style={{ color: `var(--genre-${game.primaryGenre})` }}>{GENRES[game.primaryGenre]?.label}</span>
          <span className={styles.mood} style={{ color: `var(--mood-${game.primaryMood})` }}>
            {MOODS[game.primaryMood]?.label}
          </span>
        </p>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Put the case back on the shelf">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <h2 className={styles.title}>{game.title}</h2>
      <p className={styles.summary}>{game.summary}</p>

      <div className={styles.steps} role="group" aria-label="Case view">
        <span className={styles.stepTrack} style={{ "--step": current }} aria-hidden="true" />
        {STEPS.map((s, i) => (
          <button
            key={s.stage}
            type="button"
            className={styles.step}
            aria-pressed={stage === s.stage}
            aria-label={s.aria}
            data-done={i < current || undefined}
            onClick={() => onStage(s.stage)}
          >
            <span className={styles.stepNum} aria-hidden="true">
              {i + 1}
            </span>
            {s.label}
          </button>
        ))}
      </div>

      <p className={styles.hint}>
        <span className={styles.fine}>{HINTS[stage].fine}</span>
        <span className={styles.coarse}>{HINTS[stage].coarse}</span>
      </p>

      <div className={styles.actions}>
        {stage === "out" && (
          <button type="button" className="btn btn-primary" onClick={() => onStage("open")}>
            Open the case
          </button>
        )}
        {stage === "open" && (
          <button type="button" className="btn btn-primary" onClick={() => onStage("inspect")}>
            Take out the disc
          </button>
        )}
        {stage === "inspect" && (
          <>
            <button type="button" className="btn btn-primary" onClick={onFlip}>
              Flip the disc
            </button>
            <button type="button" className="btn" onClick={onReset}>
              Reset
            </button>
          </>
        )}
        <Link to={`/game/${game.slug}`} className="btn">
          Watch &amp; read
        </Link>
      </div>

      <nav className={styles.browse} aria-label="Browse cases">
        <button
          type="button"
          className={styles.navBtn}
          onClick={() => onStep(-1)}
          disabled={!prev}
          aria-label={prev ? `Previous: ${prev.title}` : "No previous case"}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className={styles.navTitle}>{prev?.title ?? "Start"}</span>
        </button>
        <span className={`mono ${styles.count}`} aria-live="polite">
          {position.index + 1} / {position.total}
        </span>
        <button
          type="button"
          className={`${styles.navBtn} ${styles.navNext}`}
          onClick={() => onStep(1)}
          disabled={!next}
          aria-label={next ? `Next: ${next.title}` : "No next case"}
        >
          <span className={styles.navTitle}>{next?.title ?? "End"}</span>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </nav>

      <button type="button" className={styles.backBtn} onClick={onBack}>
        {BACK_LABEL[stage]}
        <span className="kbd">Esc</span>
      </button>
    </aside>
  );
});

export default CasePanel;
