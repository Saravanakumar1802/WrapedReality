import { GENRES, MOODS } from "@/data/taxonomy.js";
import { dnaDots } from "@/lib/scoring.js";
import styles from "./GenreDNA.module.css";

/**
 * The AI sorting made visible: each genre/mood with 0–5 dots of relative match.
 * @param {{ match: Record<string, number>, kind: "genre" | "mood", primary: string, limit?: number }} props
 */
export default function GenreDNA({ match, kind, primary, limit = 5 }) {
  const dots = dnaDots(match);
  const dict = kind === "mood" ? MOODS : GENRES;
  const rows = Object.entries(match)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  return (
    <ul className={styles.list}>
      {rows.map(([key, value]) => (
        <li key={key} className={styles.row} data-primary={key === primary} style={{ "--c": `var(--${kind}-${key})` }}>
          <span className={styles.name}>{dict[key]?.label ?? key}</span>
          <span className={styles.dots} role="img" aria-label={`${dots[key]} of 5, relative match ${Math.round(value * 100)}%`}>
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className={styles.dot} data-on={i < dots[key]} />
            ))}
          </span>
          <span className={styles.pct}>{Math.round(value * 100)}%</span>
        </li>
      ))}
    </ul>
  );
}
