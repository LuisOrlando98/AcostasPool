import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieJar = vi.hoisted(() => new Map<string, string>());
const dbMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  technician: { findUnique: vi.fn() },
  customer: { findUnique: vi.fn() },
}));
const jwtMock = vi.hoisted(() => ({
  verifySessionToken: vi.fn(),
  signSessionToken: vi.fn(),
}));

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
/** `sid` del token actual; la cookie de vista solo vale si lleva el mismo. */
const SESSION_ID = "session-1";

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

beforeEach(() => {
  cookieJar.clear();
  cookieJar.set(AUTH_COOKIE, AUTH_TOKEN);
  dbMock.user.findUnique.mockReset();
  dbMock.technician.findUnique.mockReset();
  dbMock.customer.findUnique.mockReset();
  jwtMock.verifySessionToken
    .mockReset()
    .mockResolvedValue({ sub: DEVELOPER_ID, sid: SESSION_ID });
  jwtMock.signSessionToken.mockReset();
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
    cookieJar.set(DEV_VIEW_COOKIE_NAME, serializeDevViewCookie({ role: "TECH", sid: SESSION_ID }));

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
    expect(dbMock.technician.findUnique).not.toHaveBeenCalled();
  });

  it("grants developer access by e-mail even when the database flag is false", async () => {
    dbMock.user.findUnique.mockResolvedValue({ ...developerUser, isDeveloper: false });

    expect(await getSession()).toMatchObject({ isDeveloper: true, role: "ADMIN" });
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

  it("ignores a view chosen in a previous session: a new login always starts as admin", async () => {
    dbMock.user.findUnique.mockResolvedValue(developerUser);
    dbMock.customer.findUnique.mockResolvedValue({ id: "customer-dev" });
    cookieJar.set(DEV_VIEW_COOKIE_NAME, serializeDevViewCookie({ role: "CUSTOMER", sid: SESSION_ID }));
    // Token nuevo (login): sin `sid`, o con otro distinto al de la cookie.
    jwtMock.verifySessionToken.mockResolvedValueOnce({ sub: DEVELOPER_ID });

    expect(await getSession()).toMatchObject({ role: "ADMIN", devView: null, isDeveloper: true });

    jwtMock.verifySessionToken.mockResolvedValueOnce({ sub: DEVELOPER_ID, sid: "session-2" });

    expect(await getSession()).toMatchObject({ role: "ADMIN", devView: null });
    expect(dbMock.customer.findUnique).not.toHaveBeenCalled();
  });

  it("falls back to the admin view when the test technician row is missing", async () => {
    dbMock.user.findUnique.mockResolvedValue(developerUser);
    dbMock.technician.findUnique.mockResolvedValue(null);
    cookieJar.set(DEV_VIEW_COOKIE_NAME, serializeDevViewCookie({ role: "TECH", sid: SESSION_ID }));

    const session = await getSession();

    expect(session).toMatchObject({ role: "ADMIN", devView: null });
  });

  it("keeps the developer's own identity and only changes the role", async () => {
    dbMock.user.findUnique.mockResolvedValue(developerUser);
    dbMock.technician.findUnique.mockResolvedValue({ id: "technician-dev" });
    cookieJar.set(DEV_VIEW_COOKIE_NAME, serializeDevViewCookie({ role: "TECH", sid: SESSION_ID }));

    const session = await getSession();

    expect(session).toEqual({
      sub: DEVELOPER_ID,
      email: DEVELOPER_EMAIL,
      name: "Dev Principal",
      role: "TECH",
      avatarUrl: null,
      isDeveloper: true,
      devView: { role: "TECH" },
    });
  });

  it("serves the client view from the developer's own customer row", async () => {
    dbMock.user.findUnique.mockResolvedValue(developerUser);
    dbMock.customer.findUnique.mockResolvedValue({ id: "customer-dev" });
    cookieJar.set(DEV_VIEW_COOKIE_NAME, serializeDevViewCookie({ role: "CUSTOMER", sid: SESSION_ID }));

    const session = await getSession();

    expect(session).toMatchObject({
      sub: DEVELOPER_ID,
      role: "CUSTOMER",
      devView: { role: "CUSTOMER" },
    });
  });
});
