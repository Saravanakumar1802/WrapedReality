import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { theme } from "@/theme";

/**
 * Post-processing: subtle bloom on the brightest highlights (disc rims, LEDs),
 * a vignette, and ACES tone mapping.
 *
 * The composer stays mounted at every quality level. Whether frames go through
 * it decides which variant of every material's shader is used, so removing it
 * when quality drops forced every material in the scene to compile again (a
 * multi-second freeze on Windows). Low quality skips only the bloom pass and MSAA.
 *
 * @param {{ quality?: "high" | "low", multisampling?: number }} props
 */
export default function Effects({ quality = "high", multisampling = 4 }) {
  const b = theme.scene.bloom;
  const high = quality === "high";
  return (
    <EffectComposer multisampling={high ? multisampling : 0} enableNormalPass={false}>
      {high ? <Bloom mipmapBlur intensity={b.intensity} luminanceThreshold={b.threshold} luminanceSmoothing={b.smoothing} /> : <></>}
      <Vignette offset={0.3} darkness={0.55} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
