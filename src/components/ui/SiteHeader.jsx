import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { useUI } from "@/lib/store.js";
import { SITE } from "@/lib/site.js";
import { meta } from "@/lib/data.js";
import { getLenis } from "./SmoothScroll.jsx";
import Logo from "./Logo.jsx";
import styles from "./SiteHeader.module.css";

const NAV = [
  { to: "/shelf", label: "Shelf", note: "Every case, in a walnut cabinet" },
  // only once the moment index exists (videos connected + `npm run data`)
  ...(meta.momentCount > 0 ? [{ to: "/moments", label: "Moments", note: "Jump to any scene in the playthroughs" }] : []),
  { to: "/journey", label: "Journey", note: "The games in the order I played them" },
  { to: "/about", label: "About", note: "Why this exists, and the credits" },
];

const HIDE_AFTER = 420; // px scrolled before the bar may tuck away

/**
 * The site header: a floating glass bar.
 *  - At the top of a page it sits open and transparent; once you scroll it
 *    condenses into a capsule with a light running round its border and a
 *    reading-progress line along the bottom.
 *  - Scrolling down tucks it away, scrolling up brings it back.
 *  - A highlight slides between the links, resting on the current page.
 *  - Phones get a full-screen menu.
 */
export default function SiteHeader() {
  const setPaletteOpen = useUI((s) => s.setPaletteOpen);
  const sound = useUI((s) => s.sound);
  const toggleSound = useUI((s) => s.toggleSound);
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menu, setMenu] = useState(false);
  const header = useRef(/** @type {HTMLElement | null} */ (null));

  // ── scroll: condensed / hidden state + progress (written as a CSS variable) ──
  useEffect(() => {
    let raf = 0;
    let lastY = window.scrollY;
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      header.current?.style.setProperty("--progress", max > 0 ? (y / max).toFixed(4) : "0");
      setScrolled(y > 24);
      const delta = y - lastY;
      if (Math.abs(delta) > 6) {
        // keep it visible while something inside it has keyboard focus
        const focused = header.current?.contains(document.activeElement);
        setHidden(delta > 0 && y > HIDE_AFTER && !focused);
        lastY = y;
      }
    };
    const onScroll = () => (raf ||= requestAnimationFrame(update));
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // A new page always starts with the bar showing and the menu closed.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHidden(false);
    setMenu(false);
  }, [pathname]);

  // ── mobile menu: lock the page behind it, Esc closes ──
  useEffect(() => {
    if (!menu) return;
    const lenis = getLenis();
    lenis?.stop();
    document.documentElement.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", onKey);
    return () => {
      lenis?.start();
      document.documentElement.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  return (
    <header ref={header} className={styles.header} data-scrolled={scrolled} data-hidden={hidden && !menu} data-menu={menu}>
      <div className={styles.bar}>
        <span className={styles.border} aria-hidden="true" />
        <Link to="/" className={styles.brand} aria-label={`${SITE.name} home`}>
          <Logo caption={`${meta.count} games played`} />
        </Link>

        <DesktopNav pathname={pathname} />

        <div className={styles.actions}>
          <button type="button" className={styles.search} onClick={() => setPaletteOpen(true)} aria-label="Search games (Ctrl K)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className={styles.searchLabel}>Search games</span>
            <span className={styles.keys} aria-hidden="true">
              <kbd>Ctrl</kbd>
              <kbd>K</kbd>
            </span>
          </button>
          <SoundButton sound={sound} onToggle={toggleSound} className={styles.icon} />
          <button
            type="button"
            className={styles.menuButton}
            aria-expanded={menu}
            aria-controls="site-menu"
            aria-label={menu ? "Close the menu" : "Open the menu"}
            onClick={() => setMenu((m) => !m)}
          >
            <i />
            <i />
          </button>
        </div>
        <span className={styles.progress} aria-hidden="true" />
      </div>

      <div id="site-menu" className={styles.sheet} hidden={!menu}>
        <nav aria-label="Main">
          <ul className={styles.sheetList}>
            {NAV.map((n, i) => (
              <li key={n.to} style={{ "--i": i }}>
                <NavLink to={n.to} className={styles.sheetLink} onClick={() => setMenu(false)}>
                  <span>{n.label}</span>
                  <small>{n.note}</small>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.sheetFoot} style={{ "--i": NAV.length }}>
          <SoundButton sound={sound} onToggle={toggleSound} className={styles.sheetSound} labelled />
          <span>{meta.count} games played</span>
        </div>
      </div>
    </header>
  );
}

/** Links with a highlight that slides to whichever link you point at, and rests on the current page. */
function DesktopNav({ pathname }) {
  const nav = useRef(/** @type {HTMLElement | null} */ (null));
  const links = useRef(/** @type {(HTMLAnchorElement | null)[]} */ ([]));
  const [hover, setHover] = useState(-1);
  const active = NAV.findIndex((n) => pathname === n.to || pathname.startsWith(`${n.to}/`));
  const target = hover >= 0 ? hover : active;
  const [pill, setPill] = useState({ x: 0, w: 0, shown: false });

  const measure = useCallback(() => {
    const el = links.current[target];
    if (!el) return setPill((p) => ({ ...p, shown: false }));
    setPill({ x: el.offsetLeft, w: el.offsetWidth, shown: true });
  }, [target]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);
  useEffect(() => {
    // fonts can change link widths after first paint
    document.fonts?.ready.then(measure);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <nav ref={nav} aria-label="Main" className={styles.nav} onPointerLeave={() => setHover(-1)}>
      <span
        className={styles.pill}
        data-shown={pill.shown}
        data-hover={hover >= 0 && hover !== active}
        style={{ transform: `translateX(${pill.x}px)`, width: pill.w }}
        aria-hidden="true"
      />
      {NAV.map((n, i) => (
        <NavLink
          key={n.to}
          ref={(el) => (links.current[i] = el)}
          to={n.to}
          className={styles.link}
          onPointerEnter={() => setHover(i)}
          onFocus={() => setHover(i)}
          onBlur={() => setHover(-1)}
        >
          {n.label}
        </NavLink>
      ))}
    </nav>
  );
}

function SoundButton({ sound, onToggle, className, labelled = false }) {
  return (
    <button
      type="button"
      className={className}
      onClick={onToggle}
      aria-pressed={sound}
      aria-label={labelled ? undefined : sound ? "Turn interface sounds off" : "Turn interface sounds on"}
      title={labelled ? undefined : sound ? "Sound on" : "Sound off"}
    >
      {/* speaker; while sound is on, equaliser bars dance beside it */}
      <span className={styles.eq} data-on={sound} aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M3 9.5v5h3.5L11 19V5L6.5 9.5H3Z" fill="currentColor" />
          {!sound && <path d="m15.5 9.5 5 5m0-5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
        </svg>
        {sound && (
          <>
            <i />
            <i />
            <i />
          </>
        )}
      </span>
      {labelled && <span>{sound ? "Interface sounds on" : "Interface sounds off"}</span>}
    </button>
  );
}
