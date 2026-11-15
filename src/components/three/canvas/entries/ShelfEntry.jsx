/** Shelf canvas entry (its own chunk: the shelf's area-light tables only load on the shelf). */
import SceneCanvas from "../SceneCanvas.jsx";
import ShelfScene from "@/components/three/scenes/shelf/ShelfScene.jsx";

// Stable object: R3F re-applies camera props when they change identity.
const SHELF_CAMERA = { position: [0, 0.25, 12], fov: 35, near: 0.1, far: 120 };

export default function ShelfEntry({ fallback, ...props }) {
  return (
    <SceneCanvas camera={SHELF_CAMERA} fallback={fallback} shadows>
      <ShelfScene {...props} />
    </SceneCanvas>
  );
}
