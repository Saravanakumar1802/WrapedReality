import { Outlet, ScrollRestoration, useNavigation } from "react-router";
import SiteHeader from "@/components/ui/SiteHeader.jsx";
import SiteFooter from "@/components/ui/SiteFooter.jsx";
import SmoothScroll from "@/components/ui/SmoothScroll.jsx";
import CommandPalette from "@/components/ui/CommandPalette.jsx";
import SpaceField from "@/components/space/SpaceField.jsx";
import { getLiteGames, genreList, moodList } from "@/lib/data.js";

const searchIndex = getLiteGames().map((g) => ({ slug: g.slug, title: g.title, platform: g.platform }));
const genres = genreList();
const moods = moodList();

export default function Layout() {
  const nav = useNavigation();
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SpaceField />
      <SmoothScroll />
      <SiteHeader />
      <div className="route-progress" data-active={nav.state === "loading"} aria-hidden="true" />
      <main id="main">
        <Outlet />
      </main>
      <SiteFooter />
      <CommandPalette games={searchIndex} genres={genres} moods={moods} />
      {/* Keyed by path: fresh page loads all share the key "default", which would
          restore one page's scroll position onto another. */}
      <ScrollRestoration getKey={(location) => location.pathname} />
    </>
  );
}
