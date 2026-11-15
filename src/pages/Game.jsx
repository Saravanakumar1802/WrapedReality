import { pageTitle } from "@/lib/site.js";
import { Link, useLoaderData, useParams, useSearchParams } from "react-router";
import { getLite, genreLabel, moodLabel, prevNext } from "@/lib/data.js";
import { platformTheme } from "@/theme";
import GameStage from "@/components/game/GameStage.jsx";
import VideoPlayer from "@/components/game/VideoPlayer.jsx";
import GenreDNA from "@/components/game/GenreDNA.jsx";
import TakeawayText from "@/components/game/TakeawayText.jsx";
import BoxArt from "@/components/ui/BoxArt.jsx";
import NotFound from "./NotFound.jsx";
import styles from "./Game.module.css";

const CHANNEL = import.meta.env.VITE_YT_CHANNEL_URL || "";

export default function Game() {
  const { slug } = useParams();
  const game = useLoaderData(); // this game's full record (src/lib/gameData.js)
  const [search] = useSearchParams();
  if (!game) return <NotFound />;
  // deep link from moment search: /game/<slug>?v=<videoId>&t=<seconds>#videos
  const cue = { videoId: search.get("v"), t: Number(search.get("t")) || 0 };

  const lite = getLite(slug);
  const neighbors = game.neighbors.map(getLite).filter(Boolean);
  const { prev, next } = prevNext(slug);
  const pt = platformTheme(game.platform);
  const backdrop = game.hero ? { src: game.hero, kind: "hero" } : { src: game.cover, kind: "cover" };

  return (
    <article className={styles.page} style={{ "--accent-game": game.palette[0] }} key={slug}>
      <title>{pageTitle(game.title)}</title>
      <meta name="description" content={game.takeaway[0] ?? game.summary} />

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.backdrop} aria-hidden="true">
          {backdrop.src && <img src={backdrop.src} data-kind={backdrop.kind} alt="" fetchPriority="high" data-boot-media />}
          <div className={styles.scrim} />
        </div>

        <div className={`container ${styles.heroGrid}`}>
          <div className={styles.copy}>
            <nav aria-label="Breadcrumb" className={styles.crumbs}>
              <Link to="/shelf">Shelf</Link>
              <span aria-hidden="true">/</span>
              <Link to={`/platform/${game.platform.toLowerCase()}`}>{game.platform}</Link>
            </nav>

            {game.logo ? (
              <h1 className={styles.logoWrap}>
                <img className={styles.logo} data-dark={game.logoDark || undefined} src={game.logo} alt={game.title} />
              </h1>
            ) : (
              <h1 className={styles.title}>{game.title}</h1>
            )}

            <ul className={styles.facts}>
              <li>{pt.mark ? <img className="ps-mark" src={pt.mark} alt={pt.name} style={{ height: 18 }} /> : pt.label}</li>
              <li>
                <Link to={`/genre/${game.primaryGenre}`} className={styles.tag} style={{ "--c": `var(--genre-${game.primaryGenre})` }}>
                  {genreLabel(game.primaryGenre)}
                </Link>
              </li>
              <li>
                <Link to={`/mood/${game.primaryMood}`} className={styles.tag} style={{ "--c": `var(--mood-${game.primaryMood})` }}>
                  {moodLabel(game.primaryMood)}
                </Link>
              </li>
              {game.year && <li className={styles.plain}>{game.year}</li>}
              {game.stats.hours != null && <li className={styles.plain}>{game.stats.hours} h played</li>}
              {game.stats.trophies != null && <li className={styles.plain}>{game.stats.trophies} trophies</li>}
              {game.note && <li className={styles.note}>{game.note}</li>}
            </ul>

            <p className={styles.summary}>{game.summary}</p>

            <div className={styles.ctas}>
              <a href="#takeaway" className="btn btn-primary">
                Read the takeaway
              </a>
              <a href="#videos" className="btn">
                {game.videos.length ? `Watch ${game.videos.length > 1 ? `${game.videos.length} videos` : "the video"}` : "Videos"}
              </a>
            </div>
          </div>

          <GameStage game={lite} takeaway={game.takeaway[0] ?? ""} />
        </div>
      </section>

      {/* ── Takeaway + DNA ── */}
      <section id="takeaway" className={`container ${styles.body}`}>
        <div>
          <span className="hud">What it left me</span>
          <div className={styles.takeaway}>
            <TakeawayText paragraphs={game.takeaway} summary={game.summary} />
          </div>
        </div>
        <aside className={`panel ${styles.side}`}>
          <div>
            <h2 className={styles.h3}>Genre DNA</h2>
            <p className={styles.small}>How closely the AI matched this game to each shelf. Relative, not a probability.</p>
            <GenreDNA match={game.match.genre} kind="genre" primary={game.primaryGenre} />
          </div>
          <div>
            <h2 className={styles.h3}>Mood</h2>
            <p className={styles.small}>{game.moodIsManual ? "Set by me." : "Picked by the AI from the game and my takeaway."}</p>
            <GenreDNA match={game.match.mood} kind="mood" primary={game.primaryMood} limit={3} />
          </div>
        </aside>
      </section>

      {/* ── Videos ── */}
      <section id="videos" className={`container ${styles.videos}`} aria-labelledby="videos-title">
        <h2 id="videos-title" className={styles.h2} data-fx="lines">
          On the channel
        </h2>
        <VideoPlayer key={slug} videos={game.videos} moments={game.moments} channelUrl={CHANNEL} cue={cue} gameSlug={slug} />
      </section>

      {/* ── Played alike ── */}
      {neighbors.length > 0 && (
        <section className={`container ${styles.alike}`} aria-labelledby="alike-title">
          <div className={styles.alikeHead}>
            <h2 id="alike-title" className={styles.h2} data-fx="lines">
              Played alike
            </h2>
            <p className="muted">The three games closest to this one by meaning, not just by genre.</p>
          </div>
          <ul className={styles.alikeGrid} data-fx="rise">
            {neighbors.map((n) => (
              <li key={n.slug} data-fx-item>
                <Link to={`/game/${n.slug}`} className={styles.alikeCard}>
                  <BoxArt game={n} size="full" />
                  <span>{n.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav className={`container ${styles.pager}`} aria-label="More games">
        <Link to={`/game/${prev.slug}`} rel="prev" className={styles.pageLink}>
          <span className={styles.pageBox}>
            <BoxArt game={prev} />
          </span>
          <span>
            <span className="hud">Previous</span>
            <strong>{prev.title}</strong>
          </span>
        </Link>
        <Link to={`/game/${next.slug}`} rel="next" className={`${styles.pageLink} ${styles.next}`}>
          <span>
            <span className="hud">Next</span>
            <strong>{next.title}</strong>
          </span>
          <span className={styles.pageBox}>
            <BoxArt game={next} />
          </span>
        </Link>
      </nav>
    </article>
  );
}
