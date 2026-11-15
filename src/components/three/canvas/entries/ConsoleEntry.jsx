/** Console turntable canvas entry (home page). */
import SceneCanvas from "../SceneCanvas.jsx";
import ConsoleShowcaseScene, { CONSOLE_CAMERA } from "@/components/three/scenes/consoles/ConsoleShowcaseScene.jsx";

export default function ConsoleEntry({ fallback, ...props }) {
  return (
    <SceneCanvas camera={CONSOLE_CAMERA} fallback={fallback} transparent effects={false}>
      <ConsoleShowcaseScene {...props} />
    </SceneCanvas>
  );
}
