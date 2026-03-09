export const ALLOWED_PUBLIC_INTEGRATION_TOKENS = new Set([
  "8213120931bsdbaasdad",
  "n7x4v2k9q1m8c5p3r6t0z4a9h2w7y5d1",
]);

export function isAllowedPublicIntegrationToken(token: string) {
  return ALLOWED_PUBLIC_INTEGRATION_TOKENS.has(token);
}
