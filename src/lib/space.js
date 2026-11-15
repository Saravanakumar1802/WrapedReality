/**
 * Shared state for the site-wide star field. Sections ask for a tint while they
 * are on screen; the field eases toward it. Plain module state (no React) because
 * it is read once per frame by the WebGL loop.
 */
import { theme } from "@/theme";
import { hexToVec3 } from "./color.js";

const rest = hexToVec3(theme.space.tint);

export const space = {
  /** colour the field is easing toward */
  tint: rest,
  /** 0..1 how strongly the tint washes the stars (sections that set a tint raise it) */
  strength: 0.25,
};

/** Tint the star field (pass null to return to the resting colour). */
export function setSpaceTint(hex) {
  space.tint = hex ? hexToVec3(hex) : rest;
  space.strength = hex ? 0.6 : 0.25;
}
