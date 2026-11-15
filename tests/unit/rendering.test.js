import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { localLightUniforms, updateLocalLights, withLocalLights } from "@/components/three/materials/localLights.js";
import { W_PATH, logoMarkCss, logoMarkMarkup } from "@/components/ui/logoMark.js";
import { SITE, pageTitle } from "@/lib/site.js";

describe("local lights (lights only the wall and timber evaluate)", () => {
  it("injects the light loop into a lit material once, with its own program key", () => {
    const m = withLocalLights(new THREE.MeshStandardMaterial());
    const key = m.customProgramCacheKey();
    withLocalLights(m); // idempotent
    expect(m.customProgramCacheKey()).toBe(key);
    expect(key.endsWith("|local-lights")).toBe(true);
    // every patched material shares one program variant
    expect(withLocalLights(new THREE.MeshStandardMaterial()).customProgramCacheKey()).toBe(key);

    const shader = {
      uniforms: {},
      vertexShader: "",
      fragmentShader: "#include <common>\nvoid main() {\n#include <lights_fragment_begin>\n}",
    };
    m.onBeforeCompile(shader, null);
    expect(shader.uniforms.uLocalCount).toBe(localLightUniforms.uLocalCount);
    expect(shader.fragmentShader).toContain("uniform vec3 uLocalPosition");
    expect(shader.fragmentShader).toContain("RE_Direct( localLight");
    expect(shader.fragmentShader.match(/uniform int uLocalCount/g)).toHaveLength(1);
  });

  it("writes light positions in view space, scaled colours, and the count", () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 5);
    camera.updateMatrixWorld();
    updateLocalLights(
      [{ position: new THREE.Vector3(1, 2, 0), color: new THREE.Color(1, 0.5, 0), intensity: 2, distance: 7, decay: 1.5 }],
      camera,
    );
    expect(localLightUniforms.uLocalCount.value).toBe(1);
    expect(localLightUniforms.uLocalPosition.value[0].toArray()).toEqual([1, 2, -5]);
    expect(localLightUniforms.uLocalColor.value[0].toArray()).toEqual([2, 1, 0]);
    expect(localLightUniforms.uLocalRange.value[0]).toBe(7);
    updateLocalLights([], camera);
    expect(localLightUniforms.uLocalCount.value).toBe(0);
  });
});

describe("site identity and logo", () => {
  it("is WrapedReality everywhere", () => {
    expect(SITE.name).toBe("WrapedReality");
    expect(SITE.wordmark.join("")).toBe(SITE.name);
    expect(pageTitle("Shelf")).toBe("Shelf — WrapedReality");
  });

  it("the mark uses unique gradient ids and only theme colours", () => {
    const a = logoMarkMarkup("one");
    const b = logoMarkMarkup("two");
    expect(a).toContain(W_PATH);
    expect(a).toContain('id="one-film"');
    expect(b).not.toContain('id="one-film"');
    expect(a + logoMarkCss(".x")).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });
});
