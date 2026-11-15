/** Single-case canvas entry (home hero, game page). */
import SceneCanvas from "../SceneCanvas.jsx";
import CaseViewerScene, { CASE_CAMERA } from "@/components/three/scenes/case/CaseViewerScene.jsx";

export default function CaseEntry({ fallback, transparent = false, ...props }) {
  return (
    <SceneCanvas camera={CASE_CAMERA} fallback={fallback} transparent={transparent} effects={!transparent}>
      <CaseViewerScene {...props} />
    </SceneCanvas>
  );
}
