import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import BoxArt from "@/components/ui/BoxArt.jsx";
import { useUI } from "@/lib/store.js";
import { keywordFeelSearch } from "@/lib/feel.js";
import { INDEX, semanticSearch, warmSearch } from "@/lib/semanticSearch.js";
import { useSearchStatus } from "@/hooks/useSearchStatus.js";
import styles from "./FeelSearch.module.css";

const SUGGESTIONS = ["something calm and lonely", "pure chaos with friends", "a story that broke me", "monsters in the dark"];

/**
 * Feel-search: type a feeling, get games. The shared in-browser model
 * (src/lib/semanticSearch.js) loads on first focus; until it's ready, or if it
 * can't load, answers come from instant keyword matching.
 * @param {{ games: any[], enabled: boolean, dim: number }} props games must be in vectors.bin order
 */
export default function FeelSearch({ games, enabled, dim }) {
  const reqId = useRef(0);
  const { status: model, progress } = useSearchStatus();
  const status = !enabled || model === "unavailable" ? "fallback" : model;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(/** @type {{ slug: string, score: number }[] | null} */ (null));
  const [busy, setBusy] = useState(false);
  const setHighlighted = useUI((s) => s.setHighlighted);

  useEffect(() => () => setHighlighted([]), [setHighlighted]);

  const init = useCallback(() => enabled && warmSearch(), [enabled]);

  const show = (hits) => {
    setResults(hits);
    setHighlighted(hits.map((h) => h.slug));
  };

  const run = (text) => {
    const q = text.trim();
    if (!q) return;
    setQuery(q);
    const id = ++reqId.current;
    if (status === "ready") {
      setBusy(true);
      semanticSearch(INDEX.games(dim), q, 6)
        .then(
          (hits) => id === reqId.current && show(hits.map((h) => ({ slug: games[h.index]?.slug, score: h.score })).filter((h) => h.slug)),
        )
        .catch(() => id === reqId.current && show(keywordFeelSearch(q, games)))
        .finally(() => id === reqId.current && setBusy(false));
      return;
    }
    // model still loading or unavailable → instant keyword answer
    show(keywordFeelSearch(q, games));
  };

  const clear = () => {
    setResults(null);
    setQuery("");
    setHighlighted([]);
  };

  const bySlug = (slug) => games.find((g) => g.slug === slug);
  const maxScore = results?.[0]?.score || 1;

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
        <label htmlFor="feel-input" className={`hud ${styles.label}`}>
          Search by feeling
        </label>
        <div className={styles.row}>
          <input
            id="feel-input"
            className={styles.input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={init}
            placeholder="something calm and lonely"
            autoComplete="off"
            maxLength={200}
          />
          <button type="submit" className="btn btn-primary" disabled={!query.trim() || busy}>
            {busy ? "Searching" : "Find games"}
          </button>
        </div>
        <p className={styles.status} aria-live="polite">
          {status === "idle" && "Runs an AI model in your browser. Nothing you type leaves this page."}
          {status === "loading" && `Loading the AI model (about 23 MB, only once)… ${progress ? `${progress}%` : ""}`}
          {status === "ready" && "AI model ready."}
          {status === "fallback" && "Using quick keyword matching."}
        </p>
      </form>

      {!results && (
        <div className={styles.suggest}>
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="chip" onFocus={init} onClick={() => run(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {results && (
        <div className={styles.results}>
          {results.length === 0 ? (
            <p className="muted">Nothing matched that feeling. Try describing the mood, like “tense and lonely”.</p>
          ) : (
            <ol className={styles.list}>
              {results.map((r) => {
                const g = bySlug(r.slug);
                if (!g) return null;
                return (
                  <li key={r.slug}>
                    <Link to={`/game/${r.slug}`} className={styles.hit}>
                      <span className={styles.hitBox}>
                        <BoxArt game={g} />
                      </span>
                      <span className={styles.hitTitle}>{g.title}</span>
                      <span className={styles.meter} aria-label={`relative match ${Math.round((r.score / maxScore) * 100)}%`}>
                        <span style={{ width: `${Math.max(8, (r.score / maxScore) * 100)}%` }} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
          <button type="button" className="chip" onClick={clear}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
