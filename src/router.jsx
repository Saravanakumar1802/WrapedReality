import { createBrowserRouter } from "react-router";
import { useEffect } from "react";
import Layout from "./Layout.jsx";
import RouteError from "./pages/RouteError.jsx";
import ScrollFx from "./components/ui/ScrollFx.jsx";
import { markRouteReady } from "./lib/boot.js";
import { loadGame } from "./lib/gameData.js";

/**
 * Pages are code-split: each route's JS (and the 3D stack) loads on demand.
 * Every page is followed by <ScrollFx />, which wires up its data-fx scroll effects
 * once the page has actually rendered.
 * @param {() => Promise<{ default: import("react").ComponentType }>} load
 * @param {import("react-router").LoaderFunction} [loader] data the page needs before it renders
 */
const page = (load, loader) => async () => {
  const Page = (await load()).default;
  const Component = () => {
    useEffect(markRouteReady, []); // tells the boot loader the first page is on screen
    return (
      <>
        <Page />
        <ScrollFx />
      </>
    );
  };
  return loader ? { Component, loader } : { Component };
};

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    ErrorBoundary: RouteError,
    HydrateFallback: () => null, // first lazy page is still downloading
    children: [
      { index: true, lazy: page(() => import("./pages/Home.jsx")) },
      { path: "shelf", lazy: page(() => import("./pages/Shelf.jsx")) },
      { path: "genre/:key", lazy: page(() => import("./pages/Shelf.jsx")) },
      { path: "mood/:key", lazy: page(() => import("./pages/Shelf.jsx")) },
      { path: "platform/:key", lazy: page(() => import("./pages/Shelf.jsx")) },
      {
        path: "game/:slug",
        lazy: page(
          () => import("./pages/Game.jsx"),
          ({ params }) => loadGame(params.slug),
        ),
      },
      { path: "moments", lazy: page(() => import("./pages/Moments.jsx")) },
      { path: "journey", lazy: page(() => import("./pages/Journey.jsx")) },
      { path: "about", lazy: page(() => import("./pages/About.jsx")) },
      { path: "*", lazy: page(() => import("./pages/NotFound.jsx")) },
    ],
  },
]);
