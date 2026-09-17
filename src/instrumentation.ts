/**
 * Next.js instrumentation hook. `register()` runs once when the server starts
 * (`next dev` / `next start`); Next skips it during `next build`, so it can
 * never break a build. Environment validation only makes sense on the Node.js
 * runtime, where `process.env` is the real process environment.
 */

const NODE_RUNTIME = "nodejs";
const PRODUCTION_ENV = "production";
const LOG_PREFIX = "[env]";

export async function register() {
  if (process.env.NEXT_RUNTIME !== NODE_RUNTIME) {
    return;
  }

  const { assertEnv, validateEnv } = await import("@/lib/config/env");
  const result = validateEnv();

  result.warnings.forEach((message) => console.warn(`${LOG_PREFIX} ${message}`));
  result.errors.forEach((message) => console.error(`${LOG_PREFIX} ${message}`));

  if (process.env.NODE_ENV === PRODUCTION_ENV) {
    assertEnv();
  }
}
