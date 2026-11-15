import { memo } from "react";
import { platformTheme } from "@/theme";
import styles from "./BoxArt.module.css";

/**
 * A retail-accurate case front in DOM: coloured plastic rim, printed banner with
 * the real platform logo (white on PS4 blue, black on PS5 white), real cover art
 * and the glossy sleeve. `size` picks the image source (thumb for small uses).
 */
function BoxArt({ game, size = "thumb", className = "", eager = false }) {
  const pt = platformTheme(game.platform);
  const src = size === "full" ? (game.cover ?? game.thumb) : (game.thumb ?? game.cover);
  return (
    <div
      className={`${styles.case} ${className}`}
      data-platform={game.platform}
      style={{ "--shell": pt.shell, "--band": pt.band }}
      role="img"
      aria-label={`${game.title} — ${pt.name} case`}
    >
      <div className={styles.insert}>
        <div className={styles.band}>
          {pt.mark ? (
            <img className={styles.mark} data-tone={pt.markTone} src={pt.mark} alt="" draggable="false" />
          ) : (
            <span className={styles.bandText}>{pt.label}</span>
          )}
        </div>
        <div className={styles.art}>
          {src ? (
            <img src={src} alt="" loading={eager ? "eager" : "lazy"} decoding="async" draggable="false" />
          ) : (
            <span className={styles.fallback} style={{ "--a": game.palette?.[0], "--b": game.palette?.[1] }}>
              {game.title}
            </span>
          )}
        </div>
      </div>
      <span className={styles.glare} aria-hidden="true" />
    </div>
  );
}

export default memo(BoxArt);
