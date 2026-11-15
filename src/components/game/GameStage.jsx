import { useEffect, useRef, useState } from "react";
import { CaseCanvas } from "@/components/three/canvas/lazy.jsx";
import BoxArt from "@/components/ui/BoxArt.jsx";
import styles from "./GameStage.module.css";

const NEXT_LABEL = { closed: "Open the case", open: "Take out the disc", inspect: "Flip the disc" };
const HINT = {
  closed: "Click the case to open it.",
  open: "Click the disc to take it out.",
  inspect: "Drag to rotate. Double-click to flip.",
};

/** The game page's 3D case with the closed → open → inspect flow. */
export default function GameStage({ game, takeaway }) {
  const [stage, setStage] = useState(/** @type {"closed" | "open" | "inspect"} */ ("closed"));
  const discRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (/** @type {HTMLElement} */ (e.target).closest("input, textarea, select, dialog")) return;
      if (e.key === "Escape") setStage((s) => (s === "inspect" ? "open" : "closed"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const advance = () => {
    if (stage === "closed") setStage("open");
    else if (stage === "open") setStage("inspect");
    else discRef.current?.flip();
  };

  return (
    <div className={styles.stage}>
      <CaseCanvas
        transparent
        game={game}
        stage={stage}
        takeaway={takeaway}
        discRef={discRef}
        onCaseClick={() => setStage((s) => (s === "closed" ? "open" : s === "open" ? "closed" : s))}
        onDiscClick={() => setStage((s) => (s === "open" ? "inspect" : s))}
        fallback={
          <div className={styles.fallback}>
            <BoxArt game={game} size="full" eager />
          </div>
        }
        loading={
          <div className={styles.fallback}>
            <BoxArt game={game} size="full" eager />
          </div>
        }
      />
      <div className={styles.controls}>
        <p className={styles.hint} aria-live="polite">
          {HINT[stage]}
        </p>
        <div className={styles.buttons}>
          <button type="button" className="btn btn-primary" onClick={advance}>
            {NEXT_LABEL[stage]}
          </button>
          {stage === "inspect" && (
            <button type="button" className="btn" onClick={() => discRef.current?.reset()}>
              Reset
            </button>
          )}
          {stage !== "closed" && (
            <button type="button" className="btn" onClick={() => setStage(stage === "inspect" ? "open" : "closed")}>
              {stage === "inspect" ? "Put the disc back" : "Close the case"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
