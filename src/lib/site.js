/**
 * Site identity. Rename the whole site here: page titles, the header wordmark,
 * the boot loader and index.html (via vite.config.js) all read from this object.
 */
export const SITE = Object.freeze({
  name: "WrapedReality",
  /** The wordmark in two tones: "Wraped" (bold) + "Reality" (accent). */
  wordmark: Object.freeze(["Wraped", "Reality"]),
  tagline: "every game I've played, and every moment worth finding",
  description:
    "The WrapedReality game library: every game from the channel as its real PS5, PS4 and PC case. Pull one off a 3D shelf, read what it left me, and jump straight to any moment in the playthroughs.",
});

/** "Page — WrapedReality" (or the name and tagline for the home page). */
export const pageTitle = (page) => (page ? `${page} — ${SITE.name}` : `${SITE.name} — ${SITE.tagline}`);
