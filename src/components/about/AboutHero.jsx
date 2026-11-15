import { useRef } from "react";
import { Link } from "react-router";
import { gsap, SplitText, useGSAP, MQ, EASE } from "@/lib/motion.js";
import { SITE } from "@/lib/site.js";
import { channel, channelUrl, subscribeUrl, yearsSince } from "@/lib/channel.js";
import styles from "./AboutHero.module.css";

/**
 * Opening scene: the channel name assembles letter by letter, the channel's own
 * banner hangs as a tilted poster that leans toward the pointer, and scrolling
 * away tips the whole scene back into the dark.
 */
export default function AboutHero() {
  const root = useRef(/** @type {HTMLElement | null} */ (null));
  const since = channel.since ? new Date(channel.since).getFullYear() : null;
  const years = channel.since ? yearsSince(channel.since) : null;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        const q = gsap.utils.selector(root);
        const split = SplitText.create(q("[data-title-line]"), { type: "chars", mask: "chars" });
        // unwrap the letters once they have landed: the masks would clip the title's glow into boxes
        const intro = gsap.timeline({ defaults: { ease: EASE.out }, onComplete: () => split.revert() });
        intro
          .from(split.chars, { yPercent: 120, rotate: 8, duration: 1.1, stagger: 0.035 }, 0.15)
          .from(q("[data-rise]"), { y: 28, autoAlpha: 0, duration: 0.9, stagger: 0.08 }, 0.55)
          .from(q("[data-poster]"), { rotateY: -48, rotateX: 12, z: -320, autoAlpha: 0, duration: 1.6, ease: "expo.out" }, 0.3)
          .from(q("[data-streak]"), { xPercent: -140, duration: 1.4, stagger: 0.07, ease: "expo.out" }, 0);

        // Scroll away: the copy lifts and fades, the poster swings flat and sinks.
        const exit = { trigger: root.current, start: "top top", end: "bottom top", scrub: 0.6 };
        gsap.to(q("[data-copy]"), { yPercent: -18, autoAlpha: 0, ease: "none", scrollTrigger: exit });
        gsap.to(q("[data-poster-wrap]"), { yPercent: 22, scale: 0.86, rotateX: 18, autoAlpha: 0.2, ease: "none", scrollTrigger: exit });
        gsap.to(q("[data-streaks]"), { xPercent: 12, ease: "none", scrollTrigger: exit });

        // The poster leans toward the pointer.
        const poster = q("[data-poster]")[0];
        const rx = gsap.quickTo(poster, "rotateX", { duration: 0.8, ease: "power3.out" });
        const ry = gsap.quickTo(poster, "rotateY", { duration: 0.8, ease: "power3.out" });
        const glare = gsap.quickTo(q("[data-glare]")[0], "xPercent", { duration: 0.8, ease: "power3.out" });
        const move = (e) => {
          const nx = e.clientX / window.innerWidth - 0.5;
          const ny = e.clientY / window.innerHeight - 0.5;
          ry(-14 + nx * 18);
          rx(6 - ny * 12);
          glare(nx * 60);
        };
        window.addEventListener("pointermove", move, { passive: true });
        return () => {
          window.removeEventListener("pointermove", move);
          split.revert();
        };
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} className={styles.hero} aria-labelledby="about-title">
      <div className={styles.streaks} data-streaks aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={styles.streak} data-streak style={{ "--i": i }} />
        ))}
      </div>

      <div className={`container ${styles.grid}`}>
        <div className={styles.copy} data-copy>
          <a className={styles.handle} href={channelUrl} target="_blank" rel="noreferrer" data-rise>
            {channel.avatar && <img src={channel.avatar} alt="" width="40" height="40" />}
            <span>{channel.handle ?? "@wrapedreality"}</span>
            <span className={styles.live}>
              <span className={styles.dot} aria-hidden="true" />
              Gameplay // Live
            </span>
          </a>

          <h1 id="about-title" className={styles.title} aria-label={channel.title ?? SITE.name}>
            <span data-title-line aria-hidden="true">
              {SITE.wordmark[0]}
            </span>
            <span data-title-line aria-hidden="true" className={styles.red}>
              {SITE.wordmark[1]}
            </span>
          </h1>

          <p className={styles.tag} data-rise>
            I&apos;m the hero of a thousand stories.
          </p>
          <p className={styles.meta} data-rise>
            Hosted by <strong>{SITE.creator}</strong>
            <span aria-hidden="true">·</span> PS5 · PS4 · PC
            {since && (
              <>
                <span aria-hidden="true">·</span> since {since}
                {years > 1 ? ` (${years} years)` : ""}
              </>
            )}
            {channel.country === "IN" && (
              <>
                <span aria-hidden="true">·</span> India
              </>
            )}
          </p>

          <div className={styles.ctas} data-rise>
            <a className={`btn ${styles.subscribe}`} href={subscribeUrl} target="_blank" rel="noreferrer">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path
                  d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1c.4-1.6.5-4.8.5-4.8s0-3.2-.5-4.8ZM9.8 15V9l5.8 3-5.8 3Z"
                  fill="currentColor"
                />
              </svg>
              Subscribe on YouTube
            </a>
            <Link to="/shelf" className="btn">
              Explore the library
            </Link>
          </div>
        </div>

        {channel.banner && (
          <div className={styles.posterWrap} data-poster-wrap aria-hidden="true">
            <div className={styles.poster} data-poster>
              <img src={channel.banner} alt="" width="1920" height="1080" fetchPriority="high" data-boot-media />
              <span className={styles.glare} data-glare />
              <span className={styles.frame} />
            </div>
          </div>
        )}
      </div>

      <span className={styles.cue} aria-hidden="true">
        Scroll
        <span />
      </span>
    </section>
  );
}
