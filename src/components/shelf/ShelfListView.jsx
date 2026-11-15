import { Link } from "react-router";
import BoxArt from "@/components/ui/BoxArt.jsx";
import { GENRES } from "@/data/taxonomy.js";
import styles from "./ShelfExperience.module.css";

/** The flat alternative to the 3D shelf: every game as box art, grouped by platform. */
export default function ShelfListView({ games, platforms }) {
  return (
    <div className={styles.list}>
      {platforms.map((p) => {
        const items = games.filter((g) => g.platform === p);
        return (
          <section key={p} aria-labelledby={`list-${p}`}>
            <h2 id={`list-${p}`} className={styles.listHead}>
              {p} <span className="count mono muted">{items.length}</span>
            </h2>
            <ul className={styles.grid}>
              {items.map((g) => (
                <li key={g.slug}>
                  <Link to={`/game/${g.slug}`} className={styles.card}>
                    <BoxArt game={g} />
                    <span className={styles.cardTitle}>{g.title}</span>
                    <span className={styles.cardMeta}>{GENRES[g.primaryGenre]?.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
