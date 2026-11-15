import { defineConfig, devices } from "@playwright/test";

// Smoke tests run against the production build: `npm run build && npm run test:e2e`
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  retries: 0,
  // WebGL runs in software (SwiftShader) here: each browser saturates CPU cores, so run two at a time.
  workers: 2,
  use: {
    baseURL: "http://localhost:4173",
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] },
  },
  webServer: {
    command: "npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
