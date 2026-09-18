import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  technician: { findUnique: vi.fn() },
  customer: { findUnique: vi.fn() },
}));
const jwtMock = vi.hoisted(() => ({
  verifySessionToken: vi.fn(),
  signSessionToken: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: dbMock }));
vi.mock("@/lib/auth/jwt", () => jwtMock);

import {
  DEV_VIEW_COOKIE_MAX_AGE,
  DEV_VIEW_COOKIE_NAME,
  buildDeveloperSessionCookie,
  hasDeveloperAccess,
  parseDevViewCookie,
  resolveDevView,
  resolveDeveloperActor,
  serializeDevViewCookie,
} from "@/lib/auth/dev-view";
import { AUTH_COOKIE_MAX_AGE } from "@/lib/auth/config";

const DEVELOPER_EMAIL = "luiso.rodriguezcabrera@gmail.com";
const DEVELOPER_ID = "user-dev";
const AUTH_TOKEN = "signed.jwt.token";
const REFRESHED_TOKEN = "refreshed.jwt.token";
const TWELVE_HOURS_IN_SECONDS = 43200;
const ONE_HOUR_IN_SECONDS = 3600;
const MILLISECONDS_PER_SECOND = 1000;

const developerActor = {
  id: DEVELOPER_ID,
  email: DEVELOPER_EMAIL,
  fullName: "Dev Principal",
  avatarUrl: null,
  isDeveloper: true,
};

const outsiderActor = {
  id: "user-admin",
  email: "admin@acostaspool.test",
  fullName: "Admin Demo",
  avatarUrl: null,
  isDeveloper: true,
};

function encodeCookie(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function nowInSeconds(): number {
  return Math.floor(Date.now() / MILLISECONDS_PER_SECOND);
}

beforeEach(() => {
  dbMock.user.findUnique.mockReset();
  dbMock.technician.findUnique.mockReset();
  dbMock.customer.findUnique.mockReset();
  jwtMock.verifySessionToken.mockReset();
  jwtMock.signSessionToken.mockReset().mockResolvedValue(REFRESHED_TOKEN);
});

describe("dev view cookie", () => {
  it("exposes a 12 hour lifetime under a dedicated cookie name", () => {
    expect(DEV_VIEW_COOKIE_NAME).toBe("ap_dev_view");
    expect(DEV_VIEW_COOKIE_MAX_AGE).toBe(TWELVE_HOURS_IN_SECONDS);
  });

  it("round-trips a serialized value", () => {
    const value = { role: "TECH" } as const;

    expect(parseDevViewCookie(serializeDevViewCookie(value))).toEqual(value);
  });

  it("stores only the role, never a target user", () => {
    const serialized = serializeDevViewCookie({ role: "CUSTOMER" });

    expect(JSON.parse(Buffer.from(serialized, "base64url").toString("utf8"))).toEqual({
      role: "CUSTOMER",
    });
  });

  it("drops a targetUserId left over from an older cookie", () => {
    expect(
      parseDevViewCookie(encodeCookie({ role: "TECH", targetUserId: "user-tech" }))
    ).toEqual({ role: "TECH" });
  });

  it("returns null when the cookie is missing or empty", () => {
    expect(parseDevViewCookie(undefined)).toBeNull();
    expect(parseDevViewCookie(null)).toBeNull();
    expect(parseDevViewCookie("")).toBeNull();
  });

  it("returns null when the cookie is not decodable JSON", () => {
    expect(parseDevViewCookie("not-base64-json")).toBeNull();
  });

  it("returns null when the role is not impersonatable", () => {
    expect(parseDevViewCookie(encodeCookie({ role: "ADMIN" }))).toBeNull();
  });
});

describe("hasDeveloperAccess", () => {
  it("accepts the developer e-mail even without the isDeveloper flag", () => {
    expect(hasDeveloperAccess({ email: DEVELOPER_EMAIL, isDeveloper: false })).toBe(true);
  });

  it("rejects any other account", () => {
    expect(hasDeveloperAccess({ email: outsiderActor.email, isDeveloper: true })).toBe(
      false
    );
  });
});

describe("resolveDevView", () => {
  it("returns null without a cookie", async () => {
    const resolved = await resolveDevView({ actor: developerActor, cookieValue: null });

    expect(resolved).toBeNull();
    expect(dbMock.technician.findUnique).not.toHaveBeenCalled();
  });

  it("ignores the cookie for accounts that are not developers", async () => {
    const resolved = await resolveDevView({
      actor: outsiderActor,
      cookieValue: { role: "TECH" },
    });

    expect(resolved).toBeNull();
    expect(dbMock.technician.findUnique).not.toHaveBeenCalled();
  });

  it("resolves the technician view against the developer's own row", async () => {
    dbMock.technician.findUnique.mockResolvedValue({ id: "technician-1" });

    const resolved = await resolveDevView({
      actor: developerActor,
      cookieValue: { role: "TECH" },
    });

    expect(resolved).toEqual({ role: "TECH" });
    expect(dbMock.technician.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: DEVELOPER_ID } })
    );
  });

  it("falls back to the admin view when the technician row does not exist yet", async () => {
    dbMock.technician.findUnique.mockResolvedValue(null);

    const resolved = await resolveDevView({
      actor: developerActor,
      cookieValue: { role: "TECH" },
    });

    expect(resolved).toBeNull();
  });

  it("resolves the client view against the developer's own customer row", async () => {
    dbMock.customer.findUnique.mockResolvedValue({ id: "customer-1" });

    const resolved = await resolveDevView({
      actor: developerActor,
      cookieValue: { role: "CUSTOMER" },
    });

    expect(resolved).toEqual({ role: "CUSTOMER" });
    expect(dbMock.customer.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: DEVELOPER_ID } })
    );
  });

  it("falls back to the admin view when the customer row does not exist yet", async () => {
    dbMock.customer.findUnique.mockResolvedValue(null);

    const resolved = await resolveDevView({
      actor: developerActor,
      cookieValue: { role: "CUSTOMER" },
    });

    expect(resolved).toBeNull();
  });
});

describe("resolveDeveloperActor", () => {
  it("returns null without a token", async () => {
    expect(await resolveDeveloperActor(undefined)).toBeNull();
    expect(jwtMock.verifySessionToken).not.toHaveBeenCalled();
  });

  it("returns null when the token does not verify", async () => {
    jwtMock.verifySessionToken.mockResolvedValue(null);

    expect(await resolveDeveloperActor(AUTH_TOKEN)).toBeNull();
    expect(dbMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when the account is inactive", async () => {
    jwtMock.verifySessionToken.mockResolvedValue({ sub: DEVELOPER_ID });
    dbMock.user.findUnique.mockResolvedValue({ ...developerActor, isActive: false });

    expect(await resolveDeveloperActor(AUTH_TOKEN)).toBeNull();
  });

  it("returns null when the account is not a developer", async () => {
    jwtMock.verifySessionToken.mockResolvedValue({ sub: outsiderActor.id });
    dbMock.user.findUnique.mockResolvedValue({ ...outsiderActor, isActive: true });

    expect(await resolveDeveloperActor(AUTH_TOKEN)).toBeNull();
  });

  it("returns the real developer behind the session token", async () => {
    jwtMock.verifySessionToken.mockResolvedValue({ sub: DEVELOPER_ID });
    dbMock.user.findUnique.mockResolvedValue({ ...developerActor, isActive: true });

    expect(await resolveDeveloperActor(AUTH_TOKEN)).toEqual({
      id: DEVELOPER_ID,
      email: DEVELOPER_EMAIL,
      fullName: "Dev Principal",
      avatarUrl: null,
    });
  });
});

describe("buildDeveloperSessionCookie", () => {
  const actor = {
    id: DEVELOPER_ID,
    email: DEVELOPER_EMAIL,
    fullName: "Dev Principal",
    avatarUrl: "/avatars/dev.png",
  };

  it("re-signs the session with the dev claim and the ADMIN role", async () => {
    jwtMock.verifySessionToken.mockResolvedValue({ sub: DEVELOPER_ID, role: "ADMIN" });

    const cookie = await buildDeveloperSessionCookie(actor, AUTH_TOKEN);

    expect(cookie.token).toBe(REFRESHED_TOKEN);
    expect(jwtMock.signSessionToken).toHaveBeenCalledWith(
      {
        sub: DEVELOPER_ID,
        email: DEVELOPER_EMAIL,
        name: "Dev Principal",
        role: "ADMIN",
        avatarUrl: "/avatars/dev.png",
        dev: true,
      },
      {}
    );
  });

  it("keeps the remaining lifetime of the previous token", async () => {
    const expiresAt = nowInSeconds() + ONE_HOUR_IN_SECONDS;
    jwtMock.verifySessionToken.mockResolvedValue({ sub: DEVELOPER_ID, exp: expiresAt });

    const cookie = await buildDeveloperSessionCookie(actor, AUTH_TOKEN);

    expect(jwtMock.signSessionToken).toHaveBeenCalledWith(
      expect.objectContaining({ dev: true }),
      { expiresAt }
    );
    expect(cookie.maxAge).toBeLessThanOrEqual(ONE_HOUR_IN_SECONDS);
    expect(cookie.maxAge).toBeGreaterThan(ONE_HOUR_IN_SECONDS - 10);
  });

  it("falls back to the standard lifetime without a usable expiration", async () => {
    jwtMock.verifySessionToken.mockResolvedValue({ sub: DEVELOPER_ID });

    const cookie = await buildDeveloperSessionCookie(actor, AUTH_TOKEN);

    expect(cookie.maxAge).toBe(AUTH_COOKIE_MAX_AGE);
  });

  it("signs a fresh token when there is no previous one", async () => {
    const cookie = await buildDeveloperSessionCookie(actor, null);

    expect(jwtMock.verifySessionToken).not.toHaveBeenCalled();
    expect(cookie).toEqual({ token: REFRESHED_TOKEN, maxAge: AUTH_COOKIE_MAX_AGE });
  });
});
