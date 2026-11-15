import { Link } from "react-router";
import { meta } from "@/lib/data.js";
import styles from "./SiteFooter.module.css";

const CHANNEL = import.meta.env.VITE_YT_CHANNEL_URL || "";

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.grid}>
          <div>
            <p className={styles.big}>{meta.count} games and counting.</p>
            <p className="muted">
              Cover art and logos belong to their publishers and are shown only to identify each game. PlayStation, PS5, PS4 and the
              PlayStation logos are trademarks of Sony Interactive Entertainment. A personal fan site, not affiliated with Sony.
            </p>
          </div>
          <nav aria-label="Footer" className={styles.links}>
            <Link to="/shelf">The shelf</Link>
            <Link to="/journey">Journey</Link>
            <Link to="/about">About and credits</Link>
            {CHANNEL && (
              <a href={CHANNEL} rel="noreferrer" target="_blank">
                YouTube channel
              </a>
            )}
          </nav>
        </div>
      </div>
    </footer>
  );
}
