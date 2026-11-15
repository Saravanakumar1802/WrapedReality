import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { themeCss, theme } from "./src/theme/index.js";
import { SITE, pageTitle } from "./src/lib/site.js";
import { logoMarkCss, logoMarkMarkup } from "./src/components/ui/logoMark.js";

/** Injects the central theme (CSS variables), the site identity and the logo mark into index.html (single source). */
function themeTokens() {
  return {
    name: "theme-tokens",
    // "pre": the inline <style> in index.html is extracted and minified after this runs, so its placeholders must be filled first
    transformIndexHtml: {
      order: "pre",
      handler: (html) =>
        html
          .replace("<!--theme-tokens-->", `<style id="theme-tokens">${themeCss()}</style>`)
          .replaceAll("%THEME_BG%", theme.colors.void)
          .replace("%LOGO_MARK_CSS%", logoMarkCss(".boot-mark"))
          .replace("%LOGO_MARK%", logoMarkMarkup("boot"))
          .replaceAll("%SITE_TITLE%", pageTitle())
          .replaceAll("%SITE_NAME_LETTERS%", [...SITE.name].map((c, i) => `<span style="--i:${i}">${c}</span>`).join(""))
          .replaceAll("%SITE_NAME%", SITE.name)
          .replaceAll("%SITE_DESCRIPTION%", SITE.description.replaceAll('"', "&quot;")),
    },
  };
}

export default defineConfig({
  plugins: [react(), themeTokens()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  server: { port: 3000 },
  preview: { port: 4173 },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Heavy 3D stack in its own long-cacheable chunk, loaded only by pages with a canvas.
        manualChunks(id) {
          // The area-light lookup tables (~240 KB) are only used by the shelf: leave them in its chunk.
          if (/node_modules[\\/]three[\\/]examples[\\/]jsm[\\/]lights[\\/]/.test(id)) return undefined;
          if (/node_modules[\\/](three|@react-three|postprocessing|three-stdlib|troika)/.test(id)) return "three";
          if (/node_modules[\\/](gsap|@gsap|lenis)/.test(id)) return "motion";
        },
      },
    },
  },
});
