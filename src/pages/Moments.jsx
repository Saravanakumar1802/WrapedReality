import { pageTitle } from "@/lib/site.js";
import MomentSearch from "@/components/moments/MomentSearch.jsx";
import ContinueWatching from "@/components/moments/ContinueWatching.jsx";
import styles from "./Moments.module.css";

/**
 * /moments: search inside every playthrough on the channel. Each video is
 * indexed (by the creator's notes and an AI pass over its captions) into
 * moments with exact timestamps; a result opens the video at that second.
 */
export default function Moments() {
  return (
    <div className={`container ${styles.page}`}>
      <title>{pageTitle("Find a moment")}</title>
      <header className={styles.head}>
        <span className="hud">Every video, searchable inside</span>
        <h1 className={styles.h1}>Find any moment</h1>
        <p className="lede">
          Describe a boss, a place, a puzzle or a scene. The search finds the exact second in the playthroughs, so you skip straight to it
          instead of scrubbing through hours of video.
        </p>
      </header>
      <ContinueWatching />
      <MomentSearch />
    </div>
  );
}
