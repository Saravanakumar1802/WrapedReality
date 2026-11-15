import { pageTitle } from "@/lib/site.js";
import AboutHero from "@/components/about/AboutHero.jsx";
import Manifesto from "@/components/about/Manifesto.jsx";
import ChannelStats from "@/components/about/ChannelStats.jsx";
import Pillars from "@/components/about/Pillars.jsx";
import LatestVideos from "@/components/about/LatestVideos.jsx";
import LibraryWall from "@/components/about/LibraryWall.jsx";
import JoinCta from "@/components/about/JoinCta.jsx";
import SiteNotes from "@/components/about/SiteNotes.jsx";

/**
 * /about: the WrapedReality channel. Channel data (stats, avatar, banner, latest
 * uploads) comes from the YouTube API at build time (scripts/channel.mjs).
 * Every section animates on scroll; with reduced motion everything simply shows.
 */
export default function About() {
  return (
    <>
      <title>{pageTitle("About the channel")}</title>
      <AboutHero />
      <Manifesto />
      <ChannelStats />
      <Pillars />
      <LatestVideos />
      <LibraryWall />
      <JoinCta />
      <SiteNotes />
    </>
  );
}
