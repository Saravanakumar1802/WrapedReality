import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useUI } from "@/lib/store.js";
import { slugify } from "@/lib/math.js";
import { getLenis } from "./SmoothScroll.jsx";
import styles from "./CommandPalette.module.css";

const PAGES = [
  { label: "The shelf", href: "/shelf" },
  { label: "Journey timeline", href: "/journey" },
  { label: "Search by feeling", href: "/#feel" },
  { label: "About and credits", href: "/about" },
];

/** Ranks how well `q` matches `text` (0 = no match). */
function rank(q, text) {
  const t = slugify(text).replace(/-/g, " ");
  if (!q) return 1;
  if (t.startsWith(q)) return 3;
  if (t.includes(` ${q}`)) return 2.5;
  if (t.includes(q)) return 2;
  // all query words somewhere
  const words = q.split(" ").filter(Boolean);
  return words.every((w) => t.includes(w)) ? 1.5 : 0;
}

/** Ctrl/Cmd+K search across games, genres, moods and pages. Native <dialog> for focus + a11y. */
export default function CommandPalette({ games, genres, moods }) {
  const open = useUI((s) => s.paletteOpen);
  const setOpen = useUI((s) => s.setPaletteOpen);
  const navigate = useNavigate();
  const dialog = useRef(/** @type {HTMLDialogElement | null} */ (null));
  const input = useRef(/** @type {HTMLInputElement | null} */ (null));
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useUI.getState().paletteOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      getLenis()?.stop();
      requestAnimationFrame(() => input.current?.focus());
    } else if (!open && d.open) {
      d.close();
    }
    if (!open) getLenis()?.start();
  }, [open]);

  const results = useMemo(() => {
    const q = slugify(query).replace(/-/g, " ").trim();
    const items = [
      ...games.map((g) => ({
        kind: "Game",
        label: g.title,
        meta: g.platform,
        href: `/game/${g.slug}`,
        score: rank(q, g.title),
      })),
      ...genres.map((g) => ({ kind: "Genre", label: g.label, meta: `${g.count}`, href: `/genre/${g.key}`, score: rank(q, g.label) * 0.9 })),
      ...moods.map((m) => ({ kind: "Mood", label: m.label, meta: `${m.count}`, href: `/mood/${m.key}`, score: rank(q, m.label) * 0.9 })),
      ...PAGES.map((p) => ({ kind: "Page", label: p.label, meta: "", href: p.href, score: rank(q, p.label) * 0.8 })),
    ];
    return items
      .filter((i) => i.score > 0)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, q ? 12 : 8);
  }, [query, games, genres, moods]);

  const go = (href) => {
    setOpen(false);
    setQuery("");
    navigate(href);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active].href);
    }
  };

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-label="Search"
      onClose={() => setOpen(false)}
      onClick={(e) => {
        if (e.target === dialog.current) setOpen(false); // backdrop click
      }}
    >
      <div className={styles.box}>
        <label className="visually-hidden" htmlFor="palette-input">
          Search games, genres and moods
        </label>
        <input
          id="palette-input"
          ref={input}
          className={styles.input}
          placeholder="Search games, genres, moods"
          value={query}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={results[active] ? `palette-opt-${active}` : undefined}
        />
        <ul id="palette-list" role="listbox" className={styles.list} data-lenis-prevent>
          {results.length === 0 && <li className={styles.empty}>No matches. Try a shorter word, or search by feeling on the home page.</li>}
          {results.map((r, i) => (
            <li
              key={`${r.kind}-${r.href}`}
              id={`palette-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={styles.item}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(r.href)}
            >
              <span className={styles.kind}>{r.kind}</span>
              <span className={styles.label}>{r.label}</span>
              {r.meta && <span className={styles.meta}>{r.meta}</span>}
            </li>
          ))}
        </ul>
        <p className={styles.hint}>
          <span className="kbd">↑</span> <span className="kbd">↓</span> to move, <span className="kbd">Enter</span> to open,{" "}
          <span className="kbd">Esc</span> to close
        </p>
      </div>
    </dialog>
  );
}
