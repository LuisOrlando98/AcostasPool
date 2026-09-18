import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieJar = vi.hoisted(() => new Map<string, string>());
const dbMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findFirst: vi.fn() },
}));
const jwtMock = vi.hoisted(() => ({ verifySessionToken: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
  }),
}));
vi.mock("@/lib/db", () => ({ prisma: dbMock }));
vi.mock("@/lib/auth/jwt", () => jwtMock);

import { getSession } from "@/lib/auth/session";
import { serializeDevViewCookie, DEV_VIEW_COOKIE_NAME } from "@/lib/auth/dev-view";

const AUTH_COOKIE = "ap_session";
const AUTH_TOKEN = "signed.jwt.token";
const DEVELOPER_EMAIL = "luiso.rodriguezcabrera@gmail.com";
const DEVELOPER_ID = "user-dev";
const TECH_USER_ID = "user-tech";

const developerUser = {
  id: DEVELOPER_ID,
  email: DEVELOPER_EMAIL,
  fullName: "Dev Principal",
  role: "ADMIN",
  avatarUrl: null,
  isActive: true,
  isDeveloper: true,
};

const technicianUser = {
  id: TECH_USER_ID,
  email: "tech@acostaspool.test",
  fullName: "Tecnico Demo",
  role: "TECH",
  avatarUrl: null,
  isActive: true,
  isDeveloper: false,
};

const technicianTargetRow = {
  id: TECH_USER_ID,
  email: technicianUser.email,
  fullName: technicianUser.fullName,
  avatarUrl: null,
  technician: { id: "technician-1" },
  customer: null,
};

beforeEach(() => {
  cookieJar.clear();
  cookieJar.set(AUTH_COOKIE, AUTH_TOKEN);
  dbMock.user.findUnique.mockReset();
  dbMock.user.findFirst.mockReset();
  jwtMock.verifySessionToken.mockReset().mockResolvedValue({ sub: DEVELOPER_ID });
});

describe("getSession", () => {
  it("returns null without a session cookie", async () => {
    cookieJar.delete(AUTH_COOKIE);

    expect(await getSession()).toBeNull();
  });

  it("returns null when the user is inactive", async () => {
    dbMock.user.findUnique.mockResolvedValue({ ...developerUser, isActive: false });

    expect(await getSession()).toBeNull();
  });

  it("ignores the dev view cookie for accounts that are not developers", async () => {
    jwtMock.verifySessionToken.mockResolvedValue({ sub: TECH_USER_ID });
    dbMock.user.findUnique.mockResolvedValue(technicianUser);
    cookieJar.set(
      DEV_VIEW_COOKIE_NAME,
      serializeDevViewCookie({ role: "TECH", targetUserId: TECH_USER_ID })
    );

    const session = await getSession();

    expect(session).toEqual({
      sub: TECH_USER_ID,
      email: technicianUser.email,
      name: technicianUser.fullName,
      role: "TECH",
      avatarUrl: null,
      isDeveloper: false,
      devView: null,
    });
    expect(dbMock.user.findFirst).not.toHaveBeenCalled();
  });

  it("keeps the developer on the admin view when there is no dev view cookie", async () => {
    dbMock.user.findUnique.mockResolvedValue(developerUser);

    const session = await getSession();

    expect(session).toMatchObject({
      sub: DEVELOPER_ID,
      role: "ADMIN",
      isDeveloper: true,
      devView: null,
    });
  });

  it("falls back to the admin view when the target is no longer valid", async () => {
    dbMock.user.findUnique.mockResolvedValue(developerUser);
    dbMock.user.findFirst.mockResolvedValue(null);
    cookieJar.set(
      DEV_VIEW_COOKIE_NAME,
      serializeDevViewCookie({ role: "TECH", targetUserId: TECH_USER_ID })
    );

    const session = await getSession();

    expect(session).toMatchObject({ role: "ADMIN", devView: null });
  });

  it("returns the target session while the dev view is active", async () => {
    dbMock.user.findUnique.mockResolvedValue(developerUser);
    dbMock.user.findFirst.mockResolvedValue(technicianTargetRow);
    cookieJar.set(
      DEV_VIEW_COOKIE_NAME,
      serializeDevViewCookie({ role: "TECH", targetUserId: TECH_USER_ID })
    );

    const session = await getSession();

    expect(session).toEqual({
      sub: TECH_USER_ID,
      email: technicianUser.email,
      name: technicianUser.fullName,
      role: "TECH",
      avatarUrl: null,
      isDeveloper: true,
      devView: {
        actorUserId: DEVELOPER_ID,
        actorEmail: DEVELOPER_EMAIL,
        actorName: "Dev Principal",
        role: "TECH",
        targetLabel: "Tecnico Demo",
      },
    });
  });
});
