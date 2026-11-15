import { pageTitle } from "@/lib/site.js";
import JourneyTrack from "@/components/journey/JourneyTrack.jsx";
import { getJourney, meta } from "@/lib/data.js";

const games = getJourney();

export default function Journey() {
  return (
    <>
      <title>{pageTitle("Journey")}</title>
      <header className="container" style={{ paddingTop: 140, display: "grid", gap: 18 }}>
        <h1 data-fx="lines">The journey</h1>
        <p className="lede">
          {meta.hasVideos
            ? "Every game in the order I played it, dated by its first video on the channel."
            : "Every game in the order I played it. Dates appear once the YouTube videos are connected."}
        </p>
      </header>
      <JourneyTrack games={games} />
    </>
  );
}
