import { Link } from "react-router";
import { genreList, moodList, platformList } from "@/lib/data.js";
import styles from "./ShelfFilters.module.css";

/** Filter links (real routes, so every shelf view has a shareable URL). */
export default function ShelfFilters({ active = "all" }) {
  const platforms = platformList().filter((p) => p.count > 0);
  return (
    <nav aria-label="Filter the shelf" className={styles.nav}>
      <Link to="/shelf" className="chip" aria-current={active === "all" ? "page" : undefined}>
        All
      </Link>
      {platforms.map((p) => {
        const key = `platform:${p.key.toLowerCase()}`;
        return (
          <Link key={key} to={`/platform/${p.key.toLowerCase()}`} className="chip" aria-current={active === key ? "page" : undefined}>
            {p.key}
          </Link>
        );
      })}
      <span className={styles.sep} aria-hidden="true" />
      {genreList().map((g) => {
        const key = `genre:${g.key}`;
        return (
          <Link
            key={key}
            to={`/genre/${g.key}`}
            className="chip"
            aria-current={active === key ? "page" : undefined}
            style={{ "--chip-color": `var(--genre-${g.key})` }}
          >
            <span className="dot" aria-hidden="true" />
            {g.label}
          </Link>
        );
      })}
      <span className={styles.sep} aria-hidden="true" />
      {moodList().map((m) => {
        const key = `mood:${m.key}`;
        return (
          <Link
            key={key}
            to={`/mood/${m.key}`}
            className="chip"
            aria-current={active === key ? "page" : undefined}
            style={{ "--chip-color": `var(--mood-${m.key})` }}
          >
            <span className="dot" aria-hidden="true" />
            {m.label}
          </Link>
        );
      })}
    </nav>
  );
}
