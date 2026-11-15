/**
 * Theme: Nebula
 * ---------------------------------------------------------------------------
 * Deep-space PlayStation blue. EVERY colour, font, radius, motion curve and 3D
 * scene setting lives here. Components and CSS never hardcode colours; they read
 * these tokens (CSS via generated custom properties, 3D via direct import).
 *
 * New theme: copy this file, change the values (keep the keys), register it in
 * src/theme/index.js and switch ACTIVE_THEME.
 */

/** @type {import('../index.js').Theme} */
const nebula = {
  name: "Nebula",
  colorScheme: "dark",

  colors: {
    // the YouTube channel's own brand (banner red), used by the About page
    channel: "#E8203A",
    channelDeep: "#7A0B18",
    channelGlow: "#FF4D5E",
    void: "#03050B", // deepest background (canvas clear colour, page base)
    ink: "#060A15", // page surface
    panel: "#0B1224", // raised surfaces
    panelHigh: "#121C36", // hover / active surfaces
    glass: "rgba(10, 16, 34, 0.58)", // frosted overlays
    glassStrong: "rgba(8, 13, 28, 0.82)",
    line: "rgba(150, 180, 255, 0.12)", // hairlines
    lineStrong: "rgba(150, 180, 255, 0.26)",
    text: "#F3F6FF",
    textMuted: "#A3AECF",
    textDim: "#5F6B90",
    accent: "#2F7BFF", // primary action (PlayStation-leaning blue)
    accentHover: "#4A8DFF",
    accentSoft: "rgba(47, 123, 255, 0.16)",
    accentGlow: "rgba(47, 123, 255, 0.45)",
    onAccent: "#FFFFFF",
    cyan: "#59D2FF", // HUD highlight
    focus: "#59D2FF",
    success: "#3EE3A4",
    warning: "#FFC861",
    danger: "#FF5C7A",
    scrim: "rgba(3, 5, 11, 0.74)",
  },

  /** Holographic foil — reserved for discs, focus rings and signature moments. */
  holo: {
    stops: ["#59D2FF", "#9B7BFF", "#FF7AD9", "#FFE29A"],
    gradient: "conic-gradient(from 210deg, #59D2FF, #9B7BFF, #FF7AD9, #FFE29A, #59D2FF)",
    linear: "linear-gradient(100deg, #59D2FF 0%, #9B7BFF 38%, #FF7AD9 70%, #FFE29A 100%)",
  },

  /**
   * Retail case identity (researched): PS5 = darker transparent blue case, white
   * banner with black PS5 logo. PS4 = blue case, blue banner with white PS4 logo.
   */
  platforms: {
    PS5: {
      label: "PS5",
      name: "PlayStation 5",
      shell: "#173A86", // darker transparent blue plastic
      shellInner: "#0E2558",
      band: "#FFFFFF",
      bandText: "#000000",
      spineText: "#FFFFFF",
      led: "#5C9BFF",
      mark: "/brand/ps5-mark.png",
      markTone: "dark", // logo colour on the banner
    },
    PS4: {
      label: "PS4",
      name: "PlayStation 4",
      shell: "#1F5FD0", // classic PS4 blue plastic
      shellInner: "#163F96",
      band: "#003791", // PlayStation blue banner
      bandText: "#FFFFFF",
      spineText: "#FFFFFF",
      led: "#2F7BFF",
      mark: "/brand/ps4-mark.png",
      markTone: "light",
    },
    PS2: {
      label: "PS2",
      name: "PlayStation 2",
      shell: "#121318",
      shellInner: "#0A0B0F",
      band: "#121318",
      bandText: "#E8EAF2",
      spineText: "#E8EAF2",
      led: "#9B7BFF",
      mark: "",
      markTone: "light",
    },
    PC: {
      label: "PC",
      name: "PC",
      shell: "#121318", // black keep case, like retail PC boxes
      shellInner: "#0A0B0E",
      band: "#0A0A0C", // black top banner with a white PC mark
      bandText: "#FFFFFF",
      spineText: "#FFFFFF",
      led: "#FF1F4B", // ROG red: the PC is the laptop
      mark: "/brand/pc-mark.svg",
      markTone: "light",
    },
  },

  /** Genre colours (keys must match data/taxonomy.js). */
  genres: {
    action: "#FF6B4A",
    adventure: "#FFC24D",
    "open-world": "#3EE3A4",
    horror: "#FF3D6A",
    shooter: "#5C9BFF",
    fighting: "#FF6FD8",
    racing: "#59D2FF",
    sports: "#A6F06B",
    rpg: "#A884FF",
  },

  moods: {
    peace: "#59D2FF",
    fear: "#FF3D6A",
    adrenaline: "#FF9248",
    grief: "#8E9BFF",
    wonder: "#FFE29A",
  },

  fonts: {
    // Self-hosted via @fontsource (see src/main.jsx). Display has a width axis.
    display: '"Saira Variable", "Saira", ui-sans-serif, system-ui, sans-serif',
    body: '"Geist Variable", "Geist", ui-sans-serif, system-ui, sans-serif',
    mono: '"Geist Mono Variable", "Geist Mono", ui-monospace, monospace',
    print: '"Saira Variable", "Saira", ui-sans-serif, system-ui, sans-serif',
  },

  radii: { xs: "4px", sm: "8px", md: "14px", lg: "24px", pill: "999px" },

  shadows: {
    panel: "0 1px 0 rgba(255,255,255,0.05) inset, 0 30px 80px -30px rgba(0,0,0,0.8)",
    glow: "0 0 0 1px rgba(47,123,255,0.45), 0 12px 40px -10px rgba(47,123,255,0.6)",
    card: "0 18px 40px -18px rgba(0,0,0,0.9)",
  },

  motion: {
    easeOut: "expo.out",
    easeInOut: "power3.inOut",
    cssEaseOut: "cubic-bezier(0.16, 1, 0.3, 1)",
    cssEaseInOut: "cubic-bezier(0.65, 0, 0.35, 1)",
    fast: 0.22,
    base: 0.55,
    slow: 1.1,
  },

  /** The site-wide star field (src/components/space/SpaceField.jsx). */
  space: { stars: ["#FFFFFF", "#CFE0FF", "#9B7BFF"], dust: "#2F4BD6", tint: "#2F7BFF", count: 2200, dustCount: 26 },

  /** 3D scene settings (read directly by three.js components). */
  scene: {
    background: "#03050B",
    fog: "#03050B",
    fogNear: 9,
    fogFar: 26,
    ambient: { color: "#B8C8FF", intensity: 0.45 },
    key: { color: "#FFFFFF", intensity: 2.4 },
    rim: { color: "#5C9BFF", intensity: 3.2 },
    fill: { color: "#9B7BFF", intensity: 0.6 },
    lightformers: [
      { color: "#FFFFFF", intensity: 2.6, position: [0, 4, -6], scale: [10, 2, 1] },
      { color: "#5C9BFF", intensity: 2.2, position: [-6, 1, 1], scale: [2, 8, 1] },
      { color: "#9B7BFF", intensity: 1.2, position: [6, 1, 1], scale: [2, 8, 1] },
      { color: "#59D2FF", intensity: 1.0, position: [0, -4, 3], scale: [10, 1, 1] },
    ],
    shelf: {
      wood: "#1A2444",
      woodDark: "#0A1026",
      woodLight: "#2C3A66",
      back: "#0C1430",
      wall: "#060B1C",
      lamp: "#9FC2FF",
      lampIntensity: 1.5,
      plate: "#AEB9D6",
      plateText: "#0A1026",
    },
    disc: {
      dataSide: "#8F96B8", // Blu-ray data side: darker than a DVD, blue-violet cast
      mirror: "#D9DDEA", // inner mirror band
      clear: "#AEB4C8", // clear polycarbonate hub and outer rim
      etch: "#5E6480", // laser-etched mastering text + barcode
      iridescence: 0.55,
      iridescenceIOR: 1.75,
      iridescenceThickness: [180, 760],
      hub: "#E6ECF8",
      print: "#FFFFFF",
    },
    /** Console models on the home page (src/components/three/consoles.jsx). */
    consoles: {
      ps5: { plate: "#F1F2F4", body: "#0A0A0C", port: "#2A2B30", standby: "#FF8A1E", on: "#4D8DFF", ready: "#FFFFFF" },
      ps4: { matte: "#1B1C20", gloss: "#060608", gap: "#030304", port: "#2A2B30", standby: "#FF8A1E", on: "#2F6BFF", ready: "#FFFFFF" },
      ps2: { body: "#121216", tray: "#1B1B21", port: "#050506", logo: "#2B4BD8", standby: "#FF2A2A", on: "#35E06B", eject: "#3B7BFF" },
      rog: { on: "#FF1F4B" }, // ROG red: the stage colour; the laptop's own lighting is a rainbow
    },
    /** RGB lighting in the shelf room: colours the wall-wash cycles through, and the two neon tubes. */
    room: { rgb: ["#FF3D9A", "#8E5BFF", "#2FD8FF"], tubeLeft: "#FF3D9A", tubeRight: "#2FD8FF", wash: 7, floor: "#07070C" },
    sleeve: { color: "#FFFFFF", opacity: 0.06 },
    bloom: { intensity: 0.5, threshold: 0.85, smoothing: 0.2 },
  },

  /** 2D art generation (fallback covers, spines, inserts). */
  cover: {
    noiseOpacity: 0.07,
    titleColor: "#FFFFFF",
    shade: "rgba(3, 5, 11, 0.6)",
    spineShade: "rgba(3, 5, 11, 0.55)",
    spineBase: "#0B0B10",
    gloss: "rgba(255, 255, 255, 0.1)",
    crease: "rgba(0, 0, 0, 0.4)",
    sheen: "rgba(255, 255, 255, 0.05)",
  },
};

export default nebula;
