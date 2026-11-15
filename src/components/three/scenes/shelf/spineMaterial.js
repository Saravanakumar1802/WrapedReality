import * as THREE from "three";
import { SPINE_PAD } from "@/components/three/art/textures.js";

/**
 * Printed spines: a lit, glossy material (the clear sleeve over the paper) that
 * reads each instance's cell from one atlas texture.
 */
export function createSpineMaterial(atlas) {
  const material = new THREE.MeshPhysicalMaterial({
    map: atlas.texture,
    roughness: 0.42,
    metalness: 0,
    clearcoat: 0.7,
    clearcoatRoughness: 0.16,
    envMapIntensity: 0.6,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGrid = { value: new THREE.Vector2(atlas.cols, atlas.rows) };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec2 aCell;\nattribute float aGlow;\nuniform vec2 uGrid;\nvarying float vGlow;",
      )
      .replace(
        "#include <uv_vertex>",
        `#include <uv_vertex>\nvMapUv = (vec2(mix(${SPINE_PAD.toFixed(4)}, ${(1 - SPINE_PAD).toFixed(4)}, uv.x), uv.y) + aCell) / uGrid;\nvGlow = aGlow;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vGlow;")
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vGlow * 0.4;",
      );
  };
  return material;
}
