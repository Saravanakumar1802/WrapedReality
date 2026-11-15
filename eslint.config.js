import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist/**", "cache/**", "public/**", "playwright-report/**", "test-results/**", "node_modules/**"]),
  {
    files: ["**/*.{js,jsx,mjs}"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^[A-Z_]", caughtErrors: "none" }],
    },
  },
  {
    files: ["src/**/*.{js,jsx}"],
    extends: [reactHooks.configs.flat["recommended-latest"] ?? reactHooks.configs["recommended-latest"], reactRefresh.configs.vite],
    rules: {
      // Build-time secrets live in /scripts only; the site must never import them.
      "no-restricted-imports": ["error", { patterns: ["**/scripts/*"] }],
      "react-refresh/only-export-components": "off",
    },
  },
  {
    // three.js objects (materials, buffer attributes, uniforms) are imperative GPU
    // resources mutated every frame by design; they are not React state.
    files: ["src/components/three/**/*.{js,jsx}"],
    rules: { "react-hooks/immutability": "off" },
  },
]);
