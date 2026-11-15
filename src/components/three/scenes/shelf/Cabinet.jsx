import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CASE, SHELF } from "@/lib/layout.js";
import { theme, platformTheme } from "@/theme";
import { plateTexture, woodMaterial } from "@/components/three/materials/wood.js";
import { withLocalLights } from "@/components/three/materials/localLights.js";
import { ensureFonts, fonts } from "@/components/three/art/art.js";
import Room from "./Room.jsx";
import CompileGate from "@/components/three/canvas/CompileGate.jsx";
import { RowLights, RowStrip } from "./RowLamp.jsx";

/**
 * The furniture: uprights, a board under every row, a top, a back panel, a warm
 * LED strip tucked under each board, and a brass plate naming each row's platform.
 * The strip over the row you're looking at fades on as the camera arrives.
 */
export default function Cabinet({ layout, compact, camRef, reduced }) {
  const s = theme.scene.shelf;
  const t = SHELF.boardThickness;
  const depth = SHELF.depth;
  const pitch = CASE.height + SHELF.rowGap;
  const innerW = Math.max(layout.width, 1.2) + 0.3;
  const outerW = innerW + t * 2;
  const rows = layout.rows;
  const boardY = (r) => r.y - CASE.height / 2 - t / 2;
  const topY = boardY(rows[0]) + pitch;
  const bottomY = boardY(rows[rows.length - 1]);
  const height = topY - bottomY + t;
  const midY = (topY + bottomY) / 2;

  const mats = useMemo(
    () => ({
      // the room's wash and neon light reaches the timber (and only the timber): see Room.jsx
      board: withLocalLights(woodMaterial("board", { repeat: [Math.max(1, innerW / 2.6), 0.5] })),
      edge: withLocalLights(woodMaterial("edge", { repeat: [Math.max(1, innerW / 2.6), 0.06], offset: 0.31 })),
      side: withLocalLights(woodMaterial("side", { repeat: [Math.max(1, height / 2.6), 0.6], vertical: true, offset: 0.57 })),
      back: withLocalLights(
        woodMaterial("back", {
          repeat: [Math.max(1, height / 2.2), Math.max(1, innerW / 1.1)],
          vertical: true,
          tone: s.back,
          offset: 0.13,
        }),
      ),
    }),
    [innerW, height, s.back],
  );

  // BoxGeometry material slots: +x, -x, +y, -y, +z (front edge), -z
  const boardMats = useMemo(() => [mats.edge, mats.edge, mats.board, mats.board, mats.edge, mats.edge], [mats]);

  // Engraved plates are drawn once the print font has loaded.
  const [plates, setPlates] = useState(/** @type {Map<string, THREE.Texture> | null} */ (null));
  const platformKey = rows.map((r) => r.platform).join();
  useEffect(() => {
    let alive = true;
    let made = null;
    ensureFonts().then(() => {
      if (!alive) return;
      made = new Map();
      for (const name of new Set(platformKey.split(","))) made.set(name, plateTexture(platformTheme(name).name, fonts().print));
      setPlates(made);
    });
    return () => {
      alive = false;
      made?.forEach((t) => t.dispose());
    };
  }, [platformKey]);

  const shadow = useRef(/** @type {THREE.DirectionalLight | null} */ (null));
  useLayoutEffect(() => {
    const l = shadow.current;
    if (!l) return;
    const cam = l.shadow.camera;
    cam.left = -outerW / 2 - 1;
    cam.right = outerW / 2 + 1;
    cam.top = height / 2 + 1;
    cam.bottom = -height / 2 - 1;
    cam.near = 1;
    cam.far = 40;
    cam.updateProjectionMatrix();
    l.target.position.set(0, midY, 0);
    l.target.updateMatrixWorld();
  }, [outerW, height, midY]);

  const lampXs = useMemo(() => (compact ? [0] : [-innerW / 4, innerW / 4]), [compact, innerW]);
  const lampRows = useMemo(() => rows.map((r) => ({ y: boardY(r) + pitch - t / 2, spineY: r.y })), [rows, pitch, t]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group>
      {/* the light that draws shadows: boards onto cases, cases onto the back panel */}
      <directionalLight
        ref={shadow}
        color={theme.scene.key.color}
        intensity={1.6}
        position={[outerW * 0.25, midY + height * 0.5 + 5, 10]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
      />

      <RowLights rows={lampRows} camRef={camRef} reduced={reduced} front={depth / 2} width={innerW} lampXs={lampXs} />

      <Room outerW={outerW} height={height} midY={midY} wallZ={-depth / 2 - 0.06} reduced={reduced} />

      {/* back panel */}
      <mesh position={[0, midY, -depth / 2 + 0.01]} material={mats.back} receiveShadow>
        <planeGeometry args={[innerW, height]} />
      </mesh>

      {/* uprights */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (innerW / 2 + t / 2), midY, 0]} material={mats.side} castShadow receiveShadow>
          <boxGeometry args={[t, height, depth]} />
        </mesh>
      ))}

      {/* top */}
      <mesh position={[0, topY, 0]} material={boardMats} castShadow receiveShadow>
        <boxGeometry args={[innerW, t, depth]} />
      </mesh>

      {rows.map((r, i) => {
        const y = boardY(r);
        const underside = y + pitch - t / 2; // bottom face of the board above this row
        return (
          <group key={`${r.platform}-${i}`}>
            <mesh position={[0, y, 0]} material={boardMats} castShadow receiveShadow>
              <boxGeometry args={[innerW, t, depth]} />
            </mesh>

            {/* brass plate on the board's front edge (shown once its shader has compiled) */}
            {plates && (
              <CompileGate deps={[plates]}>
                <mesh position={[-innerW / 2 + 0.5, y, depth / 2 + 0.002]}>
                  <planeGeometry args={[0.52, 0.064]} />
                  <meshStandardMaterial map={plates.get(r.platform)} metalness={0.85} roughness={0.36} />
                </mesh>
              </CompileGate>
            )}

            <RowStrip index={i} rowCount={rows.length} camRef={camRef} reduced={reduced} y={underside} front={depth / 2} width={innerW} />
          </group>
        );
      })}
    </group>
  );
}
