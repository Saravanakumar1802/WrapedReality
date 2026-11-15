/**
 * Tiny synthesized UI sounds (no audio files). Muted unless the visitor turns sound on.
 */
import { useUI } from "./store.js";

let ctx = null;
function audio() {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new (window.AudioContext || /** @type {any} */ (window).webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function blip({ freq = 440, to = freq, dur = 0.08, type = "sine", gain = 0.05, noise = false }) {
  if (!useUI.getState().sound) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(ac.destination);
  if (noise) {
    const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ac.createBufferSource();
    const f = ac.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    src.buffer = buf;
    src.connect(f).connect(g);
    src.start(t);
  } else {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
}

export const sfx = {
  hover: () => blip({ freq: 1800, dur: 0.03, gain: 0.015, type: "triangle" }),
  slide: () => blip({ freq: 900, dur: 0.18, gain: 0.05, noise: true }),
  open: () => blip({ freq: 2400, dur: 0.06, gain: 0.06, noise: true }),
  disc: () => blip({ freq: 220, to: 660, dur: 0.35, gain: 0.03, type: "sine" }),
  back: () => blip({ freq: 520, to: 260, dur: 0.12, gain: 0.03, type: "triangle" }),
};
