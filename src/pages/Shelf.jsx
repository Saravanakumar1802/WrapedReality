import { pageTitle } from "@/lib/site.js";
import { useMemo } from "react";
import { useLocation, useParams } from "react-router";
import ShelfExperience from "@/components/shelf/ShelfExperience.jsx";
import ShelfFilters from "@/components/shelf/ShelfFilters.jsx";
import NotFound from "./NotFound.jsx";
import { genreLabel, getLiteGames, moodLabel } from "@/lib/data.js";
import { platformTheme } from "@/theme";

/** One page for /shelf, /genre/:key, /mood/:key and /platform/:key. */
export default function Shelf() {
  const { key } = useParams();
  const { pathname } = useLocation();
  const kind = pathname.split("/")[1]; // "shelf" | "genre" | "mood" | "platform"

  const view = useMemo(() => {
    const all = getLiteGames();
    if (kind === "genre") {
      const games = all.filter((g) => g.shelves.includes(key));
      const label = genreLabel(key);
      return {
        games,
        heading: label,
        active: `genre:${key}`,
        intro: `${games.length} games the AI placed on the ${label.toLowerCase()} shelf.`,
      };
    }
    if (kind === "mood") {
      const games = all.filter((g) => g.primaryMood === key);
      return {
        games,
        heading: moodLabel(key),
        active: `mood:${key}`,
        intro: `${games.length} games sorted by how they felt, not by genre.`,
      };
    }
    if (kind === "platform") {
      const p = String(key).toUpperCase();
      const games = all.filter((g) => g.platform === p);
      return { games, heading: platformTheme(p).name, active: `platform:${key}`, intro: `${games.length} games on the ${p} shelf.` };
    }
    return {
      games: all,
      heading: "The shelf",
      active: "all",
      intro: `${all.length} cases, one row per platform. Pull one out, open it, take the disc.`,
    };
  }, [kind, key]);

  if (kind !== "shelf" && view.games.length === 0) return <NotFound />;

  return (
    <>
      <title>{pageTitle(view.heading)}</title>
      <ShelfExperience
        key={view.active}
        games={view.games}
        heading={view.heading}
        intro={view.intro}
        nav={<ShelfFilters active={view.active} />}
      />
    </>
  );
}
