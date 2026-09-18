/**
 * Tokens that unlock the public integration proposal pages
 * (`/new-integrations/<token>` and the reply endpoint).
 *
 * The list is read from `PUBLIC_INTEGRATION_TOKENS` (comma separated) so a
 * token can be rotated without a code change. The token originally shipped in
 * the source code stays as the fallback while the variable is unset, because
 * links carrying it are already in customers' inboxes; production logs one
 * warning in that case. Rotation: set `PUBLIC_INTEGRATION_TOKENS` to
 * `<new-token>` (both values while the old links are still live), redeploy and
 * resend the links.
 */

import type { EnvSource } from "@/lib/config/env";

/** Legacy token kept only as the fallback for links already sent. */
export const DEFAULT_PUBLIC_INTEGRATION_TOKEN =
  "n7x4v2k9q1m8c5p3r6t0z4a9h2w7y5d1";

const TOKEN_SEPARATOR = ",";
const PRODUCTION_NODE_ENV = "production";
const MISSING_TOKENS_WARNING =
  "PUBLIC_INTEGRATION_TOKENS is not set: /new-integrations is using the default token shipped in the source code. Configure it and rotate the public links.";

/** The warning describes the deployment, so it is logged once per process. */
let warnedMissingTokens = false;

function warnMissingTokensOnce(env: EnvSource) {
  if (warnedMissingTokens || env.NODE_ENV !== PRODUCTION_NODE_ENV) {
    return;
  }
  warnedMissingTokens = true;
  console.warn(MISSING_TOKENS_WARNING);
}

/** Parsed `PUBLIC_INTEGRATION_TOKENS`, or the default token when it is unset. */
export function getAllowedPublicIntegrationTokens(
  env: EnvSource = process.env
): ReadonlySet<string> {
  const configured = (env.PUBLIC_INTEGRATION_TOKENS ?? "")
    .split(TOKEN_SEPARATOR)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (configured.length === 0) {
    warnMissingTokensOnce(env);
    return new Set([DEFAULT_PUBLIC_INTEGRATION_TOKEN]);
  }

  return new Set(configured);
}

export function isAllowedPublicIntegrationToken(
  token: string,
  env: EnvSource = process.env
): boolean {
  return getAllowedPublicIntegrationTokens(env).has(token.trim());
}
