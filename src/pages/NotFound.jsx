import { pageTitle } from "@/lib/site.js";
import { Link } from "react-router";

export default function NotFound() {
  return (
    <div className="container" style={{ paddingBlock: "170px 120px", display: "grid", gap: 22, justifyItems: "start" }}>
      <title>{pageTitle("Not found")}</title>
      <span className="hud">Error 404</span>
      <h1>This disc isn&apos;t on the shelf.</h1>
      <p className="lede">The page may have moved, or the game hasn&apos;t been added yet.</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link to="/shelf" className="btn btn-primary">
          Go to the shelf
        </Link>
        <Link to="/" className="btn">
          Home
        </Link>
      </div>
    </div>
  );
}
