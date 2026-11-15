import { useRef } from "react";
import { Link } from "react-router";
import ConsoleHero from "@/components/home/ConsoleHero.jsx";
import WorldsFlight from "@/components/worlds/WorldsFlight.jsx";
import TitleMarquee from "@/components/home/TitleMarquee.jsx";
import ConsoleShowcase from "@/components/home/ConsoleShowcase.jsx";
import FeelSearch from "@/components/home/FeelSearch.jsx";
import BoxArt from "@/components/ui/BoxArt.jsx";
import ContinueWatching from "@/components/moments/ContinueWatching.jsx";
import MomentSearch from "@/components/moments/MomentSearch.jsx";
import { getLiteGames, genreList, meta, moodList } from "@/lib/data.js";
import { gsap, useGSAP, MQ } from "@/lib/motion.js";
import { pageTitle } from "@/lib/site.js";
import styles from "./Home.module.css";

// Hero order: start with the games that have cinematic key art.
const FEATURED_FIRST = [
  "ghost-of-tsushima",
  "god-of-war-ragnarok",
  "marvels-spider-man-2",
  "red-dead-redemption-2",
  "horizon-forbidden-west",
  "the-last-of-us-part-ii",
  "black-myth-wukong",
  "the-witcher-3-wild-hunt",
];

const games = getLiteGames();
const heroGames = [
  ...FEATURED_FIRST.map((s) => games.find((g) => g.slug === s)).filter(Boolean),
  ...games.filter((g) => !FEATURED_FIRST.includes(g.slug)),
];
const all = games;
const stats = [
  { value: meta.count, label: "games played" },
  { value: all.filter((g) => g.platform === "PS5").length, label: "on PS5" },
  { value: all.filter((g) => g.platform === "PS4").length, label: "on PS4" },
  { value: genreList().length, label: "genres" },
  { value: moodList().length, label: "moods" },
];
const fan = ["god-of-war-ragnarok", "ghost-of-tsushima", "marvels-spider-man-2", "red-dead-redemption-2", "the-last-of-us-part-ii"]
  .map((s) => games.find((g) => g.slug === s))
  .filter(Boolean);
const titles = games.map((g) => g.title);

export default function Home() {
  const fanRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  // The stack of cases fans open as it scrolls into view (CSS reads --open).
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(MQ.motion, () => {
      gsap.fromTo(
        fanRef.current,
        { "--open": 0 },
        { "--open": 1, ease: "none", scrollTrigger: { trigger: fanRef.current, start: "top 92%", end: "top 28%", scrub: 0.6 } },
      );
    });
    return () => mm.revert();
  });

  return (
    <>
      <title>{pageTitle()}</title>
      <ConsoleHero games={heroGames} />

      {/* returning visitors: pick up the playthrough where they stopped (renders nothing otherwise) */}
      <div className={`container ${styles.continue}`}>
        <ContinueWatching />
      </div>

      <section className={styles.archive} aria-labelledby="archive-title" id="archive">
        <header className={`container ${styles.head}`}>
          <h2 id="archive-title" data-fx="lines">
            Fly through every world I&apos;ve played
          </h2>
          <p className="lede" data-fx="words">
            Keep scrolling to travel. Each genre is its own world: pass through its gate and the games drift by as their real cases. Pick
            any one to open its journal.
          </p>
        </header>
        <WorldsFlight games={games} />
        <span id="after-archive" />
      </section>

      <section className={styles.numbers} aria-label="Collection in numbers">
        <TitleMarquee titles={titles} />
        <dl className={`container ${styles.statsGrid}`} data-fx="rise">
          {stats.map((s) => (
            <div key={s.label} data-fx-item>
              <dt>{s.label}</dt>
              <dd data-fx="count">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <ConsoleShowcase />

      <section className={`section ${styles.shelfCta}`} aria-labelledby="shelf-title">
        <div className={`container ${styles.shelfGrid}`}>
          <div className={styles.shelfCopy}>
            <h2 id="shelf-title" data-fx="lines">
              Pull one off the shelf
            </h2>
            <p className="lede" data-fx="words">
              Every game sits in a walnut cabinet as its real case. Slide one out, open it, lift the disc off the hub and turn it in your
              hands.
            </p>
            <Link to="/shelf" className="btn btn-primary">
              Enter the shelf
            </Link>
          </div>
          <div ref={fanRef} className={styles.fan} aria-hidden="true">
            {fan.map((g, i) => (
              <div key={g.slug} className={styles.fanCase} style={{ "--i": i, "--n": fan.length }}>
                <BoxArt game={g} size="full" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {meta.momentCount > 0 && (
        <section className={`section ${styles.feel}`} aria-labelledby="moments-title" id="moments">
          <div className={`container ${styles.feelGrid}`}>
            <div>
              <h2 id="moments-title" data-fx="lines">
                Jump to any moment
              </h2>
              <p className="lede" data-fx="words">
                Every playthrough is indexed scene by scene. Name a boss, a place or what happens, and land on the exact second.
              </p>
              <Link to="/moments" className="btn">
                Open moment search
              </Link>
            </div>
            <div data-fx="rise">
              <MomentSearch compact />
            </div>
          </div>
        </section>
      )}

      <section className={`section ${styles.feel}`} aria-labelledby="feel-title" id="feel">
        <div className={`container ${styles.feelGrid}`}>
          <div>
            <h2 id="feel-title" data-fx="lines">
              Search by feeling
            </h2>
            <p className="lede" data-fx="words">
              Describe a mood instead of a name. A small AI model runs right here in your browser and finds the games that match it.
            </p>
          </div>
          <div data-fx="rise">
            <FeelSearch games={games} enabled={meta.embeddings} dim={meta.dim} />
          </div>
        </div>
      </section>
    </>
  );
}
