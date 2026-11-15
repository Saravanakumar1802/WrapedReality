/**
 * "Local" point lights: lights that only the materials which can actually see
 * them evaluate.
 *
 * three.js makes every lit material loop over every light in the scene, and on
 * Windows (ANGLE → Direct3D) each extra light makes every physically based shader
 * noticeably slower to compile and to run. The shelf room's RGB wash and neon
 * tubes sit behind the cases' spines, so they never light a case; they only
 * light the wall and the cabinet's timber. Those materials get the lights through
 * this chunk instead, using three's own BRDF (`RE_Direct`) and falloff, so they
 * shade exactly as with real point lights, while the case, spine and disc
 * shaders skip them entirely.
 */
import * as THREE from "three";

export const MAX_LOCAL_LIGHTS = 6;

/** Shared uniforms (one shelf on screen at a time). Positions are in view space, like three's own. */
export const localLightUniforms = {
  uLocalCount: { value: 0 },
  uLocalPosition: { value: Array.from({ length: MAX_LOCAL_LIGHTS }, () => new THREE.Vector3()) },
  uLocalColor: { value: Array.from({ length: MAX_LOCAL_LIGHTS }, () => new THREE.Color(0, 0, 0)) },
  uLocalRange: { value: new Float32Array(MAX_LOCAL_LIGHTS) },
  uLocalDecay: { value: new Float32Array(MAX_LOCAL_LIGHTS) },
};

const DECLARE = /* glsl */ `
#define MAX_LOCAL_LIGHTS ${MAX_LOCAL_LIGHTS}
uniform int uLocalCount;
uniform vec3 uLocalPosition[ MAX_LOCAL_LIGHTS ];
uniform vec3 uLocalColor[ MAX_LOCAL_LIGHTS ];
uniform float uLocalRange[ MAX_LOCAL_LIGHTS ];
uniform float uLocalDecay[ MAX_LOCAL_LIGHTS ];
`;

// Same steps as three's point-light loop (getPointLightInfo + RE_Direct).
const APPLY = /* glsl */ `
#if defined( RE_Direct )
for ( int i = 0; i < MAX_LOCAL_LIGHTS; i ++ ) {
  if ( i >= uLocalCount ) break;
  vec3 localVector = uLocalPosition[ i ] - geometryPosition;
  float localDistance = length( localVector );
  IncidentLight localLight;
  localLight.direction = localVector / max( localDistance, 1e-4 );
  localLight.color = uLocalColor[ i ] * getDistanceAttenuation( localDistance, uLocalRange[ i ], uLocalDecay[ i ] );
  localLight.visible = ( localLight.color != vec3( 0.0 ) );
  RE_Direct( localLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
}
#endif
`;

/**
 * Adds the local lights to a lit (standard / physical) material. Idempotent.
 * @template {THREE.Material} M
 * @param {M} material
 * @returns {M}
 */
export function withLocalLights(material) {
  if (material.userData.localLights) return material;
  material.userData.localLights = true;
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer);
    Object.assign(shader.uniforms, localLightUniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${DECLARE}`)
      .replace("#include <lights_fragment_begin>", `#include <lights_fragment_begin>\n${APPLY}`);
  };
  const key = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${key()}|local-lights`;
  material.needsUpdate = true;
  return material;
}

const tmp = new THREE.Vector3();

/**
 * Writes this frame's local lights (world-space positions → view space).
 * @param {{ position: THREE.Vector3, color: THREE.Color, intensity: number, distance: number, decay: number }[]} lights
 * @param {THREE.Camera} camera
 */
export function updateLocalLights(lights, camera) {
  const u = localLightUniforms;
  const n = Math.min(lights.length, MAX_LOCAL_LIGHTS);
  u.uLocalCount.value = n;
  for (let i = 0; i < n; i++) {
    const l = lights[i];
    u.uLocalPosition.value[i].copy(tmp.copy(l.position).applyMatrix4(camera.matrixWorldInverse));
    u.uLocalColor.value[i].copy(l.color).multiplyScalar(l.intensity);
    u.uLocalRange.value[i] = l.distance;
    u.uLocalDecay.value[i] = l.decay;
  }
}
