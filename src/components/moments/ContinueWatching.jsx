import { useEffect, useState } from "react";
import { Link } from "react-router";
import { getLite } from "@/lib/data.js";
import { formatTime } from "@/lib/math.js";
import { continueWatching } from "@/lib/watchProgress.js";
import { momentHref } from "./MomentSearch.jsx";
import styles from "./ContinueWatching.module.css";

/**
 * "Continue watching": videos this visitor started on the site but didn't
 * finish, newest first. Lives only in their browser; renders nothing for a first visit.
 * @param {{ title?: string, limit?: number }} props
 */
export default function ContinueWatching({ title = "Continue watching", limit = 4 }) {
  const [items, setItems] = useState(/** @type {ReturnType<typeof continueWatching>} */ ([]));
  useEffect(() => {
    // per-visitor storage, readable only after hydration
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(continueWatching(limit).filter((e) => getLite(e.slug)));
  }, [limit]);
  if (!items.length) return null;

  return (
    <section className={styles.wrap} aria-labelledby="continue-title">
      <h2 id="continue-title" className={styles.heading}>
        {title}
      </h2>
      <ul className={styles.list}>
        {items.map((e) => {
          const game = getLite(e.slug);
          const pct = e.duration ? Math.min(100, (e.t / e.duration) * 100) : 0;
          return (
            <li key={e.videoId}>
              <Link to={momentHref(e.slug, e.videoId, e.t)} className={styles.card}>
                <span className={styles.thumb}>
                  <img
                    src={`https://i.ytimg.com/vi/${e.videoId}/mqdefault.jpg`}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width="320"
                    height="180"
                  />
                  {pct > 0 && (
                    <span className={styles.bar} aria-hidden="true">
                      <span style={{ width: `${pct}%` }} />
                    </span>
                  )}
                </span>
                <span className={styles.meta}>{game?.title}</span>
                <span className={styles.title}>{e.title}</span>
                <span className={`mono ${styles.resume}`}>Resume at {formatTime(e.t)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
