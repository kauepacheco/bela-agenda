import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  use: { baseURL: "http://127.0.0.1:3107", timezoneId: "America/Los_Angeles", trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: {
    command: "node --import tsx scripts/e2e-server.ts",
    url: "http://127.0.0.1:3107/api/health",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
