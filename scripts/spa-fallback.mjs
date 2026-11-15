/** Static hosts without rewrites (e.g. GitHub Pages) serve 404.html for deep links. */
import fs from "node:fs/promises";
import { p } from "./util.mjs";
await fs.copyFile(p("dist", "index.html"), p("dist", "404.html"));
console.log("spa-fallback: dist/404.html written");
