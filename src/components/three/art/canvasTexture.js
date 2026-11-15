import * as THREE from "three";

/** Canvas → sRGB texture with mipmaps and anisotropic filtering (printed art stays crisp at angles). */
export function canvasTexture(canvas, anisotropy = 8) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}
