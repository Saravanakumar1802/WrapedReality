/**
 * Which 3D console models the site uses, and how each one is framed.
 *
 * Each entry points at a Sketchfab model that its author published as
 * downloadable under CC BY 4.0, CC0, or Sketchfab's Standard licence. Credits
 * are shown on the About page automatically. To use a different model, change the `uid`
 * (the last part of the model's Sketchfab URL) and run `npm run models`.
 *
 * view:
 *   size      longest side of the model on stage, in scene units (1 = 10 cm)
 *   rotation  [x, y, z] radians applied first, to stand the source model upright / face it forward
 *   yaw/tilt  the resting three-quarter angle on the turntable
 *   lift      vertical nudge on stage
 *   screen    (laptops) image shown on the display when it is switched on
 */
export const MODELS = {
  PS5: {
    uid: "d788de3735964151a3e24fd59c0f1956", // "PS5" by rtql8d
    enabled: true,
    view: { size: 3.6, rotation: [0, 0, 0], yaw: -0.55, tilt: 0.04, lift: 0.05 },
  },
  PS2: {
    uid: "1d0d69f1cdbd4e80838c6ac19c0b0c2f", // "A Playstation 2 Slim" by DemoDove99 (Sketchfab Free Standard licence)
    enabled: true,
    view: { size: 3.6, rotation: [0, 0, 0], yaw: -0.5, tilt: 0.45, lift: -0.2 },
  },
  ROG: {
    uid: "51eca7b2e5884c4087f3499e523d5184", // "Asus ROG Strix Scar 17 (2023) G733 Gaming Laptop" by Ranaha Creative Studio
    enabled: true,
    view: { size: 3.5, rotation: [0, 0, 0], yaw: -0.5, tilt: 0.28, lift: -0.15, screen: "/heroes/black-myth-wukong.webp" },
  },
  PS4: {
    uid: "78935136cd424a3ab7c2da1cf75a9ad1", // "PlayStation 4 Original" by Laxity
    enabled: false, // the code-built PS4 is used unless you switch this on
    view: { size: 3.4, rotation: [0, 0, 0], yaw: -0.5, tilt: 0.42, lift: 0 },
  },
};

/** Size budget: textures are capped to this edge length and re-encoded as WebP. */
export const TEXTURE_MAX = 1024;
/** Models above this many triangles are simplified down to it (invisible at the size they are shown). */
export const TRIANGLE_BUDGET = 120_000;
