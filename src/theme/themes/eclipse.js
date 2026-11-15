/**
 * Theme: Eclipse
 * ---------------------------------------------------------------------------
 * Deep indigo space lit by a solar corona: warm starlight text, amber actions,
 * a cold ion-blue counterpoint. EVERY colour, font, radius, motion curve and 3D
 * scene setting lives here. Components and CSS never hardcode colours; they read
 * these tokens (CSS via generated custom properties, WebGL via direct import).
 *
 * New theme: copy this file, change the values (keep the keys), register it in
 * src/theme/index.js and switch ACTIVE_THEME.
 */

/** @type {import('../index.js').Theme} */
const eclipse = {
  name: "Eclipse",
  colorScheme: "dark",

  colors: {
    // the YouTube channel's own brand (banner red), used by the About page
    channel: "#E8203A",
    channelDeep: "#7A0B18",
    channelGlow: "#FF4D5E",
    void: "#04040C", // deepest background (canvas clear colour, page base)
    ink: "#080818", // page surface
    panel: "#0F1026", // raised surfaces
    panelHigh: "#1A1B3C", // hover / active surfaces
    glass: "rgba(14, 14, 38, 0.52)", // frosted overlays
    glassStrong: "rgba(7, 7, 20, 0.84)",
    line: "rgba(214, 205, 255, 0.11)", // hairlines
    lineStrong: "rgba(214, 205, 255, 0.26)",
    text: "#F6F1E7", // warm starlight
    textMuted: "#B7B2CA",
    textDim: "#76728F",
    accent: "#FFB038", // corona amber: primary action
    accentHover: "#FFC56A",
    accentSoft: "rgba(255, 176, 56, 0.13)",
    accentGlow: "rgba(255, 176, 56, 0.4)",
    onAccent: "#1B1002",
    cyan: "#7FE7FF", // ion blue: HUD highlight
    focus: "#7FE7FF",
    success: "#4FE3A8",
    warning: "#FFD166",
    danger: "#FF5C7A",
    scrim: "rgba(4, 4, 12, 0.76)",
  },

  /** Holographic foil: reserved for discs, focus rings and signature moments. */
  holo: {
    stops: ["#7FE7FF", "#8E7BFF", "#FF7AC8", "#FFD08A"],
    gradient: "conic-gradient(from 210deg, #7FE7FF, #8E7BFF, #FF7AC8, #FFD08A, #7FE7FF)",
    linear: "linear-gradient(100deg, #FFD08A 0%, #FF7AC8 38%, #8E7BFF 70%, #7FE7FF 100%)",
  },

  /**
   * Retail case identity (researched): PS5 = darker transparent blue case, white
   * banner with black PS5 logo. PS4 = blue case, blue banner with white PS4 logo.
   */
  platforms: {
    PS5: {
      label: "PS5",
      name: "PlayStation 5",
      shell: "#173A86",
      shellInner: "#0E2558",
      band: "#FFFFFF",
      bandText: "#000000",
      spineText: "#FFFFFF",
      led: "#5C9BFF",
      mark: "/brand/ps5-mark.png",
      markTone: "dark",
    },
    PS4: {
      label: "PS4",
      name: "PlayStation 4",
      shell: "#1F5FD0",
      shellInner: "#163F96",
      band: "#003791",
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

  /** Genre colours (keys must match data/taxonomy.js). Each one also tints the star field. */
  genres: {
    action: "#FF6A3D",
    adventure: "#FFC24D",
    "open-world": "#3FE0A0",
    horror: "#FF3560",
    shooter: "#5C9BFF",
    fighting: "#FF6FD8",
    racing: "#57D8FF",
    sports: "#A8F06B",
    rpg: "#A884FF",
  },

  moods: {
    peace: "#6FE0FF",
    fear: "#FF3560",
    adrenaline: "#FF8A3D",
    grief: "#8E9BFF",
    wonder: "#FFDF9A",
  },

  fonts: {
    // Self-hosted via @fontsource (see src/main.jsx).
    display: '"Unbounded Variable", "Unbounded", ui-sans-serif, system-ui, sans-serif',
    body: '"Geist Variable", "Geist", ui-sans-serif, system-ui, sans-serif',
    mono: '"Geist Mono Variable", "Geist Mono", ui-monospace, monospace',
    // Printed matter on cases and discs (spines need a narrow face, like retail).
    print: '"Saira Variable", "Saira", ui-sans-serif, system-ui, sans-serif',
  },

  radii: { xs: "4px", sm: "10px", md: "16px", lg: "28px", pill: "999px" },

  shadows: {
    panel: "0 1px 0 rgba(255,255,255,0.06) inset, 0 40px 90px -40px rgba(0,0,0,0.85)",
    glow: "0 0 0 1px rgba(255,176,56,0.5), 0 14px 44px -12px rgba(255,176,56,0.55)",
    card: "0 22px 44px -18px rgba(0,0,0,0.9)",
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
  space: {
    stars: ["#FFFFFF", "#FFE2B8", "#B9CCFF"], // white, warm and cold suns
    dust: "#5B4BD6", // large soft nebula motes
    tint: "#8E7BFF", // resting tint; sections override it while on screen
    count: 2200,
    dustCount: 26,
  },

  /** 3D scene settings (read directly by three.js components). */
  scene: {
    background: "#04040C",
    fog: "#04040C",
    fogNear: 9,
    fogFar: 26,
    ambient: { color: "#CFC8FF", intensity: 0.4 },
    key: { color: "#FFF4E2", intensity: 2.4 },
    rim: { color: "#7FA6FF", intensity: 3.0 },
    fill: { color: "#FFB038", intensity: 0.5 },
    lightformers: [
      { color: "#FFFFFF", intensity: 2.6, position: [0, 4, -6], scale: [10, 2, 1] },
      { color: "#8FB2FF", intensity: 2.0, position: [-6, 1, 1], scale: [2, 8, 1] },
      { color: "#FFC98A", intensity: 1.4, position: [6, 1, 1], scale: [2, 8, 1] },
      { color: "#7FE7FF", intensity: 0.9, position: [0, -4, 3], scale: [10, 1, 1] },
    ],
    /** A dark walnut display cabinet with warm under-shelf lighting. */
    shelf: {
      wood: "#4A2C1A", // walnut mid-tone
      woodDark: "#1F110A", // grain lines, pores
      woodLight: "#7A4C2A", // sapwood streaks
      back: "#2A180E", // back panel (same timber, in shadow)
      wall: "#0B0A14", // room wall behind the cabinet
      lamp: "#FFD9A6", // LED strip under each shelf
      lampIntensity: 1.5,
      plate: "#C8A25A", // brass label plates
      plateText: "#2A1C08",
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
    bloom: { intensity: 0.45, threshold: 0.88, smoothing: 0.2 },
  },

  /** 2D art generation (fallback covers, spines, inserts). */
  cover: {
    noiseOpacity: 0.07,
    titleColor: "#FFFFFF",
    shade: "rgba(4, 4, 12, 0.6)",
    spineShade: "rgba(4, 4, 12, 0.62)",
    spineBase: "#0B0B10", // printed spine stock behind the title
    gloss: "rgba(255, 255, 255, 0.1)", // sleeve highlight baked into print
    crease: "rgba(0, 0, 0, 0.4)", // fold shadow at the edges of a printed wrap
    sheen: "rgba(255, 255, 255, 0.05)",
  },
};

export default eclipse;
