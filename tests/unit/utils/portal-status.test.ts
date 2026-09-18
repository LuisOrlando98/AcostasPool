import { describe, expect, it } from "vitest";
import {
  getCustomerPortalStatus,
  hasActiveCustomerPortal,
} from "@/lib/customers/portal-status";

const NOW = new Date("2026-09-16T12:00:00Z");
const ONE_HOUR_MS = 60 * 60 * 1000;
const FUTURE = new Date(NOW.getTime() + ONE_HOUR_MS);
const PAST = new Date(NOW.getTime() - ONE_HOUR_MS);

describe("getCustomerPortalStatus", () => {
  it("returns NOT_INVITED when the customer has no user", () => {
    expect(getCustomerPortalStatus({}, NOW)).toBe("NOT_INVITED");
    expect(getCustomerPortalStatus({ user: null }, NOW)).toBe("NOT_INVITED");
    expect(getCustomerPortalStatus({ user: undefined }, NOW)).toBe("NOT_INVITED");
  });

  it("returns LINKED when the user has no invite tokens", () => {
    expect(getCustomerPortalStatus({ user: {} }, NOW)).toBe("LINKED");
    expect(
      getCustomerPortalStatus({ user: { passwordResetTokens: [] } }, NOW)
    ).toBe("LINKED");
  });

  it("returns INVITE_PENDING for an unused, unexpired token", () => {
    expect(
      getCustomerPortalStatus(
        { user: { passwordResetTokens: [{ expiresAt: FUTURE, usedAt: null }] } },
        NOW
      )
    ).toBe("INVITE_PENDING");
  });

  it("returns LINKED for an unused but expired token", () => {
    expect(
      getCustomerPortalStatus(
        { user: { passwordResetTokens: [{ expiresAt: PAST, usedAt: null }] } },
        NOW
      )
    ).toBe("LINKED");
  });

  it("does not consider a token expiring exactly now as pending", () => {
    expect(
      getCustomerPortalStatus(
        { user: { passwordResetTokens: [{ expiresAt: NOW, usedAt: null }] } },
        NOW
      )
    ).toBe("LINKED");
  });

  it("returns ACTIVE when a token was used", () => {
    expect(
      getCustomerPortalStatus(
        { user: { passwordResetTokens: [{ expiresAt: PAST, usedAt: PAST }] } },
        NOW
      )
    ).toBe("ACTIVE");
  });

  it("gives precedence to a pending invite over a completed one", () => {
    expect(
      getCustomerPortalStatus(
        {
          user: {
            passwordResetTokens: [
              { expiresAt: PAST, usedAt: PAST },
              { expiresAt: FUTURE, usedAt: null },
            ],
          },
        },
        NOW
      )
    ).toBe("INVITE_PENDING");
  });

  it("returns ACTIVE when there is a used token plus an expired unused one", () => {
    expect(
      getCustomerPortalStatus(
        {
          user: {
            passwordResetTokens: [
              { expiresAt: PAST, usedAt: null },
              { expiresAt: FUTURE, usedAt: PAST },
            ],
          },
        },
        NOW
      )
    ).toBe("ACTIVE");
  });

  it("defaults 'now' to the current time", () => {
    const farFuture = new Date(Date.now() + ONE_HOUR_MS);
    expect(
      getCustomerPortalStatus({
        user: { passwordResetTokens: [{ expiresAt: farFuture, usedAt: null }] },
      })
    ).toBe("INVITE_PENDING");
  });
});

describe("hasActiveCustomerPortal", () => {
  it("is true only for the ACTIVE status", () => {
    expect(
      hasActiveCustomerPortal(
        { user: { passwordResetTokens: [{ expiresAt: PAST, usedAt: PAST }] } },
        NOW
      )
    ).toBe(true);
  });

  it("is false for NOT_INVITED, INVITE_PENDING and LINKED", () => {
    expect(hasActiveCustomerPortal({}, NOW)).toBe(false);
    expect(
      hasActiveCustomerPortal(
        { user: { passwordResetTokens: [{ expiresAt: FUTURE, usedAt: null }] } },
        NOW
      )
    ).toBe(false);
    expect(hasActiveCustomerPortal({ user: {} }, NOW)).toBe(false);
  });
});
