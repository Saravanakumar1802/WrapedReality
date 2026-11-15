import { useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { getLite } from "@/lib/data.js";
import { formatTime } from "@/lib/math.js";
import { keywordMomentSearch } from "@/lib/momentIndex.js";
import { INDEX, semanticSearch, warmSearch } from "@/lib/semanticSearch.js";
import { useSearchStatus } from "@/hooks/useSearchStatus.js";
import { KIND_LABEL } from "@/components/game/MomentList.jsx";
import { useMomentIndex } from "./useMomentIndex.js";
import styles from "./MomentSearch.module.css";

const SUGGESTIONS = ["final boss fight", "how to solve the puzzle", "the funniest moment", "the ending", "first time riding a horse"];

/** Deep link that opens the game page with this video cued at this second. */
export const momentHref = (slug, videoId, t) => `/game/${slug}?v=${videoId}&t=${Math.floor(t)}#videos`;

/**
 * Search inside every playthrough by describing a scene, a boss, a place or a
 * question. Results open the video at the exact second.
 *
 * Instant keyword answers first; once the in-browser model is ready, results are
 * ranked by meaning ("the part where he loses his son" finds it without those words).
 * @param {{ compact?: boolean }} props compact: fewer results, no game filter (home page)
 */
export default function MomentSearch({ compact = false }) {
  const { index, loading } = useMomentIndex();
  const { status, progress } = useSearchStatus();
  const [query, setQuery] = useState("");
  const [game, setGame] = useState("");
  const [hideSpoilers, setHideSpoilers] = useState(true);
  const [revealed, setRevealed] = useState(() => new Set());
  const [hits, setHits] = useState(/** @type {{ index: number, score: number }[] | null} */ (null));
  const [busy, setBusy] = useState(false);
  const reqId = useRef(0);
  const semantic = Boolean(index?.model && index.dim);
  const limit = compact ? 6 : 16;

  const games = useMemo(
    () =>
      index
        ? [...new Set(index.items.map((it) => it.g))]
            .map((g) => ({ slug: index.games[g], title: getLite(index.games[g])?.title ?? index.games[g] }))
            .sort((a, b) => a.title.localeCompare(b.title))
        : [],
    [index],
  );

  const inScope = (i) => !game || index.games[index.items[i].g] === game;

  const run = (text) => {
    const q = text.trim();
    if (!q || !index) return;
    setQuery(q);
    setRevealed(new Set());
    const id = ++reqId.current;
    const keyword = keywordMomentSearch(q, index.items, 200)
      .filter((h) => inScope(h.index))
      .slice(0, limit);
    setHits(keyword);
    if (!semantic || status === "unavailable") return;
    setBusy(true);
    semanticSearch(INDEX.moments(index.dim), q, 120)
      .then((found) => id === reqId.current && setHits(found.filter((h) => inScope(h.index)).slice(0, limit)))
      .catch(() => {})
      .finally(() => id === reqId.current && setBusy(false));
  };

  if (loading) return <div className={`panel ${styles.box}`} aria-busy="true" />;
  if (!index) {
    return (
      <div className={`panel ${styles.box} ${styles.empty}`}>
        <p>The moment index is being built from the channel&apos;s videos. Check back soon.</p>
        <Link to="/shelf" className="btn">
          Browse the shelf meanwhile
        </Link>
      </div>
    );
  }

  return (
    <div className={`panel ${styles.box}`} data-lenis-prevent>
      <form
        className={styles.form}
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          run(query);
        }}
      >
        <label htmlFor="moment-input" className={`hud ${styles.label}`}>
          Find a moment
        </label>
        <div className={styles.row}>
          <input
            id="moment-input"
            className={styles.input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => semantic && warmSearch()}
            placeholder="a boss, a place, a scene, a question…"
            autoComplete="off"
            enterKeyHint="search"
            maxLength={200}
          />
          <button type="submit" className="btn btn-primary" disabled={!query.trim() || busy}>
            {busy ? "Searching" : "Search"}
          </button>
        </div>
        <div className={styles.options}>
          {!compact && games.length > 1 && (
            <label className={styles.select}>
              <span className="visually-hidden">Game</span>
              <select value={game} onChange={(e) => setGame(e.target.value)} aria-label="Only in this game">
                <option value="">All games</option>
                {games.map((g) => (
                  <option key={g.slug} value={g.slug}>
                    {g.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className={styles.toggle}>
            <input type="checkbox" checked={hideSpoilers} onChange={(e) => setHideSpoilers(e.target.checked)} />
            Blur spoilers
          </label>
        </div>
        <p className={styles.status} aria-live="polite">
          {!semantic && `${index.items.length} moments indexed.`}
          {semantic &&
            status === "idle" &&
            `${index.items.length} moments indexed. Search runs in your browser; nothing you type leaves this page.`}
          {semantic && status === "loading" && `Loading the search model (about 23 MB, once)… ${progress ? `${progress}%` : ""}`}
          {semantic && status === "ready" && `${index.items.length} moments, searched by meaning.`}
          {semantic && status === "unavailable" && "Using quick keyword matching."}
        </p>
      </form>

      {!hits && (
        <div className={styles.suggest}>
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="chip" onFocus={() => semantic && warmSearch()} onClick={() => run(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {hits && hits.length === 0 && <p className="muted">No moment matched. Try naming a boss, a place or what happens.</p>}

      {hits && hits.length > 0 && (
        <ol className={styles.results}>
          {hits.map(({ index: i }) => {
            const it = index.items[i];
            const slug = index.games[it.g];
            const blur = hideSpoilers && it.spoiler && !revealed.has(i);
            return (
              <li key={i}>
                <Link
                  to={momentHref(slug, it.v, it.t)}
                  className={styles.hit}
                  onClick={(e) => {
                    if (!blur) return;
                    e.preventDefault(); // first tap reveals the spoiler, the second opens it
                    setRevealed((s) => new Set(s).add(i));
                  }}
                >
                  <span className={styles.thumb}>
                    <img
                      src={`https://i.ytimg.com/vi/${it.v}/mqdefault.jpg`}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      width="320"
                      height="180"
                    />
                    <span className={`mono ${styles.stamp}`}>{formatTime(it.t)}</span>
                  </span>
                  <span className={styles.text} data-spoiler={blur || undefined}>
                    <span className={styles.game}>
                      {getLite(slug)?.title ?? slug}
                      {it.kind && KIND_LABEL[it.kind] && <span className={styles.kind}>{KIND_LABEL[it.kind]}</span>}
                    </span>
                    <strong className={styles.title}>{it.label}</strong>
                  </span>
                  {blur && <span className={styles.reveal}>Spoiler · tap to show</span>}
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
