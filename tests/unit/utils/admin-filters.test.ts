import { describe, expect, it } from "vitest";
import {
  buildCustomerListWhere,
  buildCustomerPortalWhere,
  normalizeCustomerAccountFilter,
  normalizeCustomerPortalFilter,
} from "@/lib/customers/admin-filters";

const COMPLETED_INVITE_TOKEN = {
  purpose: "INVITE",
  usedAt: { not: null },
};

const PORTAL_ACTIVE_WHERE = {
  user: { is: { passwordResetTokens: { some: COMPLETED_INVITE_TOKEN } } },
};

const PORTAL_INACTIVE_WHERE = {
  OR: [
    { user: { is: null } },
    { user: { is: { passwordResetTokens: { none: COMPLETED_INVITE_TOKEN } } } },
  ],
};

describe("normalizeCustomerAccountFilter", () => {
  it.each([
    ["ACTIVE", "ACTIVE"],
    ["INACTIVE", "INACTIVE"],
    ["active", "ALL"],
    ["ALL", "ALL"],
    ["", "ALL"],
    ["anything", "ALL"],
  ])("maps %p to %p", (raw, expected) => {
    expect(normalizeCustomerAccountFilter(raw)).toBe(expected);
  });

  it("maps null and undefined to ALL", () => {
    expect(normalizeCustomerAccountFilter(null)).toBe("ALL");
    expect(normalizeCustomerAccountFilter(undefined)).toBe("ALL");
    expect(normalizeCustomerAccountFilter()).toBe("ALL");
  });
});

describe("normalizeCustomerPortalFilter", () => {
  it.each([
    ["ACTIVE", "ACTIVE"],
    ["INACTIVE", "INACTIVE"],
    ["inactive", "ALL"],
    ["", "ALL"],
  ])("maps %p to %p", (raw, expected) => {
    expect(normalizeCustomerPortalFilter(raw)).toBe(expected);
  });

  it("maps null and undefined to ALL", () => {
    expect(normalizeCustomerPortalFilter(null)).toBe("ALL");
    expect(normalizeCustomerPortalFilter(undefined)).toBe("ALL");
  });
});

describe("buildCustomerPortalWhere", () => {
  it("requires a used INVITE token for ACTIVE", () => {
    expect(buildCustomerPortalWhere("ACTIVE")).toEqual(PORTAL_ACTIVE_WHERE);
  });

  it("matches customers without user or without used INVITE token for INACTIVE", () => {
    expect(buildCustomerPortalWhere("INACTIVE")).toEqual(PORTAL_INACTIVE_WHERE);
  });

  it("returns an empty filter for ALL", () => {
    expect(buildCustomerPortalWhere("ALL")).toEqual({});
  });
});

describe("buildCustomerListWhere", () => {
  it("returns an empty where when no filters are given", () => {
    expect(buildCustomerListWhere({})).toEqual({});
  });

  it("ignores whitespace-only queries and unknown status/portal values", () => {
    expect(
      buildCustomerListWhere({ query: "   ", status: "foo", portal: "bar" })
    ).toEqual({});
  });

  it("returns a single condition unwrapped when only status is set", () => {
    expect(buildCustomerListWhere({ status: "ACTIVE" })).toEqual({
      estadoCuenta: "ACTIVE",
    });
  });

  it("returns the portal where unwrapped when only portal is set", () => {
    expect(buildCustomerListWhere({ portal: "INACTIVE" })).toEqual(
      PORTAL_INACTIVE_WHERE
    );
  });

  it("builds a case-insensitive OR over nombre, apellidos and email for a query", () => {
    expect(buildCustomerListWhere({ query: "  ana " })).toEqual({
      OR: [
        { nombre: { contains: "ana", mode: "insensitive" } },
        { apellidos: { contains: "ana", mode: "insensitive" } },
        { email: { contains: "ana", mode: "insensitive" } },
      ],
    });
  });

  it("combines status, portal and query with AND in that order", () => {
    expect(
      buildCustomerListWhere({ query: "ana", status: "INACTIVE", portal: "ACTIVE" })
    ).toEqual({
      AND: [
        { estadoCuenta: "INACTIVE" },
        PORTAL_ACTIVE_WHERE,
        {
          OR: [
            { nombre: { contains: "ana", mode: "insensitive" } },
            { apellidos: { contains: "ana", mode: "insensitive" } },
            { email: { contains: "ana", mode: "insensitive" } },
          ],
        },
      ],
    });
  });

  it("wraps two conditions in AND", () => {
    const where = buildCustomerListWhere({ status: "ACTIVE", query: "x" });
    expect(where.AND).toHaveLength(2);
    expect(where).not.toHaveProperty("estadoCuenta");
  });

  it("accepts null status and portal", () => {
    expect(buildCustomerListWhere({ status: null, portal: null })).toEqual({});
  });
});
