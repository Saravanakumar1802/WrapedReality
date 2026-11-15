import { useEffect, useRef } from "react";
import { theme } from "@/theme";
import { hexToVec3 } from "@/lib/color.js";
import { space } from "@/lib/space.js";
import { isLowEndDevice, prefersReducedMotion } from "@/lib/env.js";
import { isBootDone, onBootDone } from "@/lib/boot.js";
import styles from "./SpaceField.module.css";

/**
 * The site-wide backdrop: a field of stars you fly through as you scroll.
 *  - scroll position moves the camera forward through the field
 *  - scroll speed stretches every star into a streak (warp)
 *  - the pointer shifts the field for parallax
 *  - sections tint it via setSpaceTint() (src/lib/space.js)
 *
 * Raw WebGL2 (no three.js) so every page gets it for a few KB: one buffer, two
 * draw calls (points + streak lines), all motion computed in the vertex shader.
 */

const VERT = /* glsl */ `#version 300 es
  in vec3 aPos;   // x, y in field units, z = depth 0..1
  in vec3 aData;  // size (px), kind (0..2 star colour, 3 dust), twinkle phase
  in float aEnd;  // 0 = star head, 1 = streak tail
  uniform float uTravel, uStreak, uTime, uDpr, uLine, uTintK;
  uniform vec2 uPointer;
  uniform vec3 uStar0, uStar1, uStar2, uDust, uTint;
  out vec4 vColor;
  out float vDust;

  void main() {
    float dust = step(2.5, aData.y);
    // dust drifts at a third of the speed, which reads as a far-away layer
    float z = fract(aPos.z - uTravel * mix(1.0, 0.35, dust));
    float zt = clamp(z + uStreak * aEnd, 0.0, 1.3);
    float persp = 0.34 / mix(0.06, 1.0, zt);
    vec2 p = aPos.xy * persp + uPointer * (1.0 - z) * 0.06;
    gl_Position = vec4(p, 0.0, 1.0);

    float size = aData.x * mix(clamp(persp, 0.7, 3.2), 1.0, dust);
    gl_PointSize = size * uDpr;

    vec3 base = aData.y < 0.5 ? uStar0 : aData.y < 1.5 ? uStar1 : uStar2;
    vec3 color = mix(mix(base, uTint, uTintK * 0.55), mix(uDust, uTint, uTintK), dust);

    float fade = smoothstep(0.0, 0.1, z) * (1.0 - smoothstep(0.72, 1.0, z));
    float twinkle = 0.8 + 0.2 * sin(uTime * (0.6 + aData.z) + aData.z * 40.0);
    float alpha = fade * mix(twinkle, 0.11, dust);
    // streak pass: visible only while moving, fading out toward the tail; never for dust
    float streak = min(1.0, abs(uStreak) * 26.0) * (1.0 - aEnd) * (1.0 - dust) * 0.5;
    vColor = vec4(color, mix(alpha, fade * streak, uLine));
    vDust = dust;
  }
`;

const FRAG = /* glsl */ `#version 300 es
  precision highp float; // must match the vertex shader: uLine is shared
  in vec4 vColor;
  in float vDust;
  uniform float uLine;
  out vec4 outColor;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float star = pow(max(0.0, 1.0 - d), 1.6);
    float cloud = pow(max(0.0, 1.0 - d), 2.4);
    float shape = mix(mix(star, cloud, vDust), 1.0, uLine);
    outColor = vec4(vColor.rgb * vColor.a * shape, 1.0);
  }
`;

const STRIDE = 7; // floats per vertex

/** Deterministic PRNG so the sky is the same on every visit. */
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildField(stars, dust) {
  const rnd = mulberry(20261110);
  const data = new Float32Array((stars + dust) * 2 * STRIDE);
  let o = 0;
  const push = (x, y, z, size, kind, phase) => {
    for (let end = 0; end < 2; end++) {
      data.set([x, y, z, size, kind, phase, end], o);
      o += STRIDE;
    }
  };
  for (let i = 0; i < stars; i++) {
    const big = rnd() > 0.93;
    push((rnd() * 2 - 1) * 3.2, (rnd() * 2 - 1) * 3.2, rnd(), big ? 3.2 + rnd() * 2 : 1.3 + rnd() * 1.5, Math.floor(rnd() * 3), rnd());
  }
  for (let i = 0; i < dust; i++) {
    push((rnd() * 2 - 1) * 2.6, (rnd() * 2 - 1) * 2.6, rnd(), 220 + rnd() * 360, 3, rnd());
  }
  return data;
}

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

/** Sets up GL state; returns { draw, resize, dispose } or null when WebGL2 is unavailable. */
function createRenderer(canvas, starCount, dustCount) {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
  if (!gl) return null;

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, buildField(starCount, dustCount), gl.STATIC_DRAW);

  // Two views of one buffer: lines read every vertex (head + tail), points every other one.
  const makeVao = (stride) => {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const bytes = stride * 4;
    [
      ["aPos", 3, 0],
      ["aData", 3, 12],
      ["aEnd", 1, 24],
    ].forEach(([name, size, offset]) => {
      const loc = gl.getAttribLocation(program, name);
      if (loc < 0) return;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, bytes, offset);
    });
    return vao;
  };
  const lineVao = makeVao(STRIDE);
  const pointVao = makeVao(STRIDE * 2);

  const u = (name) => gl.getUniformLocation(program, name);
  const loc = {
    travel: u("uTravel"),
    streak: u("uStreak"),
    time: u("uTime"),
    dpr: u("uDpr"),
    line: u("uLine"),
    tintK: u("uTintK"),
    pointer: u("uPointer"),
    tint: u("uTint"),
  };
  theme.space.stars.forEach((c, i) => gl.uniform3fv(u(`uStar${i}`), hexToVec3(c)));
  gl.uniform3fv(u("uDust"), hexToVec3(theme.space.dust));

  const bg = hexToVec3(theme.colors.void);
  gl.clearColor(bg[0], bg[1], bg[2], 1);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE); // additive: stars only ever add light

  const total = starCount + dustCount;
  let dpr = 1;

  return {
    resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.round(window.innerWidth * dpr);
      const h = Math.round(window.innerHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
    },
    /** @param {{ travel: number, streak: number, time: number, pointer: number[], tint: number[], tintK: number }} s */
    draw(s) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(loc.travel, s.travel);
      gl.uniform1f(loc.streak, s.streak);
      gl.uniform1f(loc.time, s.time);
      gl.uniform1f(loc.dpr, dpr);
      gl.uniform1f(loc.tintK, s.tintK);
      gl.uniform2fv(loc.pointer, s.pointer);
      gl.uniform3fv(loc.tint, s.tint);

      gl.uniform1f(loc.line, 0);
      gl.bindVertexArray(pointVao);
      gl.drawArrays(gl.POINTS, 0, total);

      if (Math.abs(s.streak) > 0.0015) {
        gl.uniform1f(loc.line, 1);
        gl.bindVertexArray(lineVao);
        gl.drawArrays(gl.LINES, 0, starCount * 2);
      }
    },
    dispose() {
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(lineVao);
      gl.deleteVertexArray(pointVao);
      gl.deleteProgram(program);
    },
  };
}

const TRAVEL_PER_PX = 0.00022; // field depths flown per scrolled pixel
const STREAK_PER_PX_S = 0.00005; // streak length per px/s of scroll speed
const MAX_STREAK = 0.12;

export default function SpaceField() {
  const canvas = useRef(/** @type {HTMLCanvasElement | null} */ (null));

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const low = isLowEndDevice();
    const renderer = createRenderer(el, Math.round(theme.space.count * (low ? 0.55 : 1)), theme.space.dustCount);
    if (!renderer) return; // no WebGL2: the page background colour stands in

    const reduced = prefersReducedMotion();
    const state = { travel: 0, streak: 0, time: 0, pointer: [0, 0], tint: [...space.tint], tintK: space.strength };
    const pointerTarget = [0, 0];
    let lastY = window.scrollY;
    let lastT = performance.now();
    let drift = 0;
    let raf = 0;

    const frame = (now) => {
      const dt = Math.min(0.05, (now - lastT) / 1000) || 0.016;
      lastT = now;
      const y = window.scrollY;
      const speed = (y - lastY) / dt; // px per second
      lastY = y;

      const ease = 1 - Math.exp(-dt * 7);
      const target = Math.max(-MAX_STREAK, Math.min(MAX_STREAK, speed * STREAK_PER_PX_S));
      state.streak += (target - state.streak) * ease;
      drift += dt * 0.006; // a slow idle drift so the sky is never frozen
      state.travel = y * TRAVEL_PER_PX + drift;
      state.time += dt;
      state.pointer[0] += (pointerTarget[0] - state.pointer[0]) * ease * 0.5;
      state.pointer[1] += (pointerTarget[1] - state.pointer[1]) * ease * 0.5;
      const tintEase = 1 - Math.exp(-dt * 2.2);
      for (let i = 0; i < 3; i++) state.tint[i] += (space.tint[i] - state.tint[i]) * tintEase;
      state.tintK += (space.strength - state.tintK) * tintEase;

      renderer.draw(state);
      raf = requestAnimationFrame(frame);
    };

    const still = () => {
      state.tint = [...space.tint];
      state.tintK = space.strength;
      renderer.draw(state);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      lastT = performance.now();
      lastY = window.scrollY;
      if (reduced) still();
      else raf = requestAnimationFrame(frame);
    };

    const onResize = () => {
      renderer.resize();
      if (reduced) still();
    };
    const onPointer = (e) => {
      pointerTarget[0] = -((e.clientX / window.innerWidth) * 2 - 1);
      pointerTarget[1] = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onVisibility = () => (document.hidden ? cancelAnimationFrame(raf) : isBootDone() && start());

    renderer.resize();
    renderer.draw(state); // one still frame now; the animation starts once the boot loader has left
    const offBoot = onBootDone(start);
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      offBoot();
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvas} className={styles.field} aria-hidden="true" />;
}
