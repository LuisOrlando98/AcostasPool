import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const ENV_FILE = ".env";
const DEFAULT_PORT = "3000";

// The seed fixture (tests/e2e/helpers/seed.ts) reaches the database through
// Prisma Client, which unlike the Prisma CLI does not read .env by itself.
// Variables already present in the environment take precedence over the file.
if (!process.env.DATABASE_URL && existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const port = new URL(baseURL).port || DEFAULT_PORT;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // CI serves the production build (`npm run build` runs before the suite);
    // a server that never comes up fails the run with Playwright's own error.
    command: process.env.CI ? `npx next start -p ${port}` : "npm run dev",
    url: `${baseURL}/api/health`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
