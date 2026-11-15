import { useId, useMemo } from "react";
import { SITE } from "@/lib/site.js";
import { MARK_VIEWBOX, logoMarkMarkup } from "./logoMark.js";
import styles from "./Logo.module.css";

/**
 * The WrapedReality logo: the disc mark (see logoMark.js) plus a two-tone
 * wordmark. On hover the disc spins up and tilts toward you.
 * All colours are theme tokens, so the mark follows the active theme.
 */
export default function Logo({ wordmark = true, size = 40, caption }) {
  const id = useId().replace(/:/g, "");
  const markup = useMemo(() => logoMarkMarkup(`lm${id}`), [id]);
  const [lead, rest] = SITE.wordmark;
  return (
    <span className={styles.logo} style={{ "--size": `${size}px` }}>
      <svg className={styles.mark} viewBox={MARK_VIEWBOX} aria-hidden="true" data-logo-mark dangerouslySetInnerHTML={{ __html: markup }} />

      {wordmark && (
        <span className={styles.text}>
          <span className={styles.word}>
            {lead}
            <span className={styles.wordRest}>{rest}</span>
          </span>
          {caption && <span className={styles.caption}>{caption}</span>}
        </span>
      )}
    </span>
  );
}
