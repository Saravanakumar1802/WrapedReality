import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatTime } from "@/lib/math.js";
import { resumeAt, saveProgress } from "@/lib/watchProgress.js";
import { getLenis } from "@/components/ui/SmoothScroll.jsx";
import MomentList from "./MomentList.jsx";
import styles from "./VideoPlayer.module.css";

let apiPromise = null;
/** Loads the YouTube IFrame Player API once per page. */
function loadYouTubeApi() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => {
      apiPromise = null;
      reject(new Error("Couldn't load YouTube"));
    };
    document.head.appendChild(s);
  });
  return apiPromise;
}

/** How often the play position is sampled and saved. */
const SAMPLE_MS = 1000;
const SAVE_EVERY = 5; // samples

/**
 * The channel's videos for one game.
 *  - A lightweight facade (thumbnail) until the visitor presses play, then the real player.
 *  - Moments (chapters from the creator and the AI index) seek to the exact second.
 *  - Remembers where this visitor stopped in each video ("Resume at 23:10").
 *  - Deep links (`cue`, from moment search) open the right video at the right second.
 *
 * @param {{ videos: { id: string, title: string, duration?: number | null, summary?: string | null }[],
 *   moments: any[], channelUrl?: string, cue?: { videoId: string | null, t: number }, gameSlug: string }} props
 */
export default function VideoPlayer({ videos, moments, channelUrl, cue, gameSlug }) {
  const root = useRef(/** @type {HTMLDivElement | null} */ (null));
  const mount = useRef(/** @type {HTMLDivElement | null} */ (null));
  const player = useRef(/** @type {any} */ (null));
  const cued = cue?.videoId ? videos.findIndex((v) => v.id === cue.videoId) : -1;
  const [videoIndex, setVideoIndex] = useState(Math.max(0, cued));
  const [started, setStarted] = useState(false);
  const [error, setError] = useState("");
  const [time, setTime] = useState(0);
  const video = videos[videoIndex];

  // Where the play button starts: the deep-linked second, else where this visitor stopped.
  const [startAt, setStartAt] = useState(() => (cued >= 0 && cue.t ? cue.t : 0));
  useEffect(() => {
    if (!video || (cued === videoIndex && cue?.t)) return;
    // per-visitor storage is only readable after hydration
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStartAt(resumeAt(video.id));
  }, [video, videoIndex, cued, cue?.t]);

  // Arriving from moment search: bring the player into view.
  useEffect(() => {
    if (cued < 0 || !root.current) return;
    const id = requestAnimationFrame(() => {
      const lenis = getLenis();
      if (lenis) lenis.scrollTo(root.current, { offset: -110, duration: 1 });
      else root.current?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, [cued]);

  // Sample the position while playing; save it every few seconds.
  useEffect(() => {
    if (!started) return;
    let n = 0;
    const save = () => {
      const p = player.current;
      const t = p?.getCurrentTime?.();
      const id = p?.getVideoData?.()?.video_id;
      const v = videos.find((x) => x.id === id);
      if (typeof t === "number" && v) saveProgress(id, { t, duration: p.getDuration?.() || v.duration, slug: gameSlug, title: v.title });
    };
    const tick = setInterval(() => {
      const t = player.current?.getCurrentTime?.();
      if (typeof t === "number") setTime(t);
      if (++n % SAVE_EVERY === 0) save();
    }, SAMPLE_MS);
    window.addEventListener("pagehide", save);
    return () => {
      clearInterval(tick);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [started, videos, gameSlug]);

  useEffect(
    () => () => {
      try {
        player.current?.destroy?.();
      } catch {
        /* already gone */
      }
      player.current = null;
    },
    [],
  );

  const start = useCallback(async (videoId, seconds = 0) => {
    setError("");
    try {
      if (player.current) {
        const currentId = player.current.getVideoData?.()?.video_id;
        if (currentId !== videoId) player.current.loadVideoById({ videoId, startSeconds: seconds });
        else {
          player.current.seekTo(seconds, true);
          player.current.playVideo();
        }
        return;
      }
      setStarted(true);
      const YT = await loadYouTubeApi();
      await new Promise((r) => requestAnimationFrame(r)); // let React commit the mount node
      if (!mount.current || player.current) return;
      // YT replaces its target with an iframe, so give it a child React doesn't own.
      const target = document.createElement("div");
      mount.current.replaceChildren(target);
      player.current = new YT.Player(target, {
        host: "https://www.youtube-nocookie.com",
        videoId,
        playerVars: { autoplay: 1, start: Math.floor(seconds), rel: 0, playsinline: 1 },
      });
    } catch (e) {
      setStarted(false);
      setError(`${e.message}. Check your connection or open the video on YouTube.`);
    }
  }, []);

  const forVideo = useMemo(() => (video ? moments.filter((m) => !m.videoId || m.videoId === video.id) : []), [moments, video]);

  if (!videos.length) {
    return (
      <div className={styles.empty}>
        <p>Videos for this game are on the way.</p>
        {channelUrl && (
          <a className="btn" href={channelUrl} target="_blank" rel="noreferrer">
            Visit the YouTube channel
          </a>
        )}
      </div>
    );
  }

  const playLabel = startAt ? `${cued === videoIndex && cue?.t ? "Play from" : "Resume at"} ${formatTime(startAt)}` : null;

  return (
    <div ref={root} className={styles.wrap}>
      <div className={styles.frame}>
        {started ? (
          <div ref={mount} className={styles.iframe} />
        ) : (
          <button
            type="button"
            className={styles.facade}
            onClick={() => start(video.id, startAt)}
            aria-label={`Play video: ${video.title}${playLabel ? `, ${playLabel}` : ""}`}
          >
            <img src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`} alt="" loading="lazy" decoding="async" />
            <span className={styles.play} aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
            </span>
            {playLabel && <span className={styles.resume}>{playLabel}</span>}
          </button>
        )}
      </div>
      {error && <p className={styles.error}>{error}</p>}

      {videos.length > 1 && (
        <div className={styles.tabs} role="tablist" aria-label="Videos">
          {videos.map((v, i) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={i === videoIndex}
              className="chip"
              data-active={i === videoIndex}
              onClick={() => {
                setVideoIndex(i);
                if (started) start(v.id, resumeAt(v.id));
              }}
            >
              {v.title || `Part ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {video.summary && <p className={styles.summary}>{video.summary}</p>}

      {forVideo.length > 0 && (
        <MomentList moments={forVideo} time={started ? time : -1} onSeek={(m) => start(m.videoId ?? video.id, m.t)} />
      )}
    </div>
  );
}
