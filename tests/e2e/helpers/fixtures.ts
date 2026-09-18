import { test as base } from "@playwright/test";
import { createAuthStateCache, type AuthStateCache } from "./auth";
import { DEFAULT_BASE_URL, type Role } from "./constants";
import { ensureSeedJobScheduledToday } from "./seed";

type RoleOptions = {
  /** Role whose seed session is loaded into the browser context (null = anonymous). */
  role: Role | null;
};

type WorkerFixtures = {
  authStates: AuthStateCache;
  /** Id of the seed job, rescheduled to today when the seed ran on an earlier day. */
  seedJobId: string;
};

/**
 * Base test with:
 * - `role` option: `test.use({ role: "ADMIN" })` loads the seed session for
 *   the role into `context`, `page` and `request` via `storageState`.
 * - `authStates`: worker-scoped cache with one API login per role.
 * - `seedJobId`: worker-scoped id of the seed job, kept visible on /tech.
 * - service workers blocked: the production build registers /sw.js with a
 *   navigation fallback to /offline, which must not interfere with the checks.
 */
export const test = base.extend<RoleOptions, WorkerFixtures>({
  role: [null, { option: true }],
  serviceWorkers: "block",
  authStates: [
    // Playwright requires the destructuring pattern as first argument.
    async ({}, provide, workerInfo) => {
      const baseURL = workerInfo.project.use.baseURL ?? DEFAULT_BASE_URL;
      await provide(createAuthStateCache(baseURL));
    },
    { scope: "worker" },
  ],
  seedJobId: [
    async ({}, provide) => {
      await provide(await ensureSeedJobScheduledToday());
    },
    { scope: "worker" },
  ],
  storageState: async ({ role, authStates }, provide) => {
    await provide(role ? await authStates.get(role) : undefined);
  },
});

export const expect = test.expect;
