import { pageTitle } from "@/lib/site.js";
import { Link, isRouteErrorResponse, useRouteError } from "react-router";

/** Friendly error screen (e.g. a chunk failed to load after a redeploy). */
export default function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : (error?.message ?? "Unknown error");
  return (
    <div className="container" style={{ paddingBlock: "160px 120px", display: "grid", gap: 20, justifyItems: "start" }}>
      <title>{pageTitle("Something went wrong")}</title>
      <h1>The disc skipped.</h1>
      <p className="lede">This page failed to load ({message}). Reload to try again.</p>
      <div style={{ display: "flex", gap: 12 }}>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Reload
        </button>
        <Link to="/" className="btn">
          Home
        </Link>
      </div>
    </div>
  );
}
