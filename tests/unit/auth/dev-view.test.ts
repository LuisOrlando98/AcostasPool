import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
}));
const jwtMock = vi.hoisted(() => ({ verifySessionToken: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: dbMock }));
vi.mock("@/lib/auth/jwt", () => jwtMock);

import {
  DEV_VIEW_COOKIE_MAX_AGE,
  DEV_VIEW_COOKIE_NAME,
  hasDeveloperAccess,
  listDevViewTargets,
  parseDevViewCookie,
  resolveDevView,
  resolveDeveloperActor,
  serializeDevViewCookie,
} from "@/lib/auth/dev-view";

const DEVELOPER_EMAIL = "luiso.rodriguezcabrera@gmail.com";
const DEVELOPER_ID = "user-dev";
const TECH_USER_ID = "user-tech";
const CUSTOMER_USER_ID = "user-customer";
const AUTH_TOKEN = "signed.jwt.token";
const TWELVE_HOURS_IN_SECONDS = 43200;

const developerActor = {
  id: DEVELOPER_ID,
  email: DEVELOPER_EMAIL,
  fullName: "Dev Principal",
  isDeveloper: true,
};

const outsiderActor = {
  id: "user-admin",
  email: "admin@acostaspool.test",
  fullName: "Admin Demo",
  isDeveloper: true,
};

function encodeCookie(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function technicianRow() {
  return {
    id: TECH_USER_ID,
    email: "tech@acostaspool.test",
    fullName: "Tecnico Demo",
    avatarUrl: null,
    technician: { id: "technician-1" },
    customer: null,
  };
}

function customerRow() {
  return {
    id: CUSTOMER_USER_ID,
    email: "cliente@acostaspool.test",
    fullName: "Cliente Demo",
    avatarUrl: "/avatars/cliente.png",
    technician: null,
    customer: {
      nombre: "Cliente",
      apellidos: "Demo",
      email: "cliente@acostaspool.test",
    },
  };
}

beforeEach(() => {
  dbMock.user.findUnique.mockReset();
  dbMock.user.findFirst.mockReset();
  dbMock.user.findMany.mockReset();
  jwtMock.verifySessionToken.mockReset();
});

describe("dev view cookie", () => {
  it("exposes a 12 hour lifetime under a dedicated cookie name", () => {
    expect(DEV_VIEW_COOKIE_NAME).toBe("ap_dev_view");
    expect(DEV_VIEW_COOKIE_MAX_AGE).toBe(TWELVE_HOURS_IN_SECONDS);
  });

  it("round-trips a serialized value", () => {
    const value = { role: "TECH", targetUserId: TECH_USER_ID } as const;

    const parsed = parseDevViewCookie(serializeDevViewCookie(value));

    expect(parsed).toEqual(value);
  });

  it("drops extra properties when serializing", () => {
    const serialized = serializeDevViewCookie({
      role: "CUSTOMER",
      targetUserId: CUSTOMER_USER_ID,
    });

    expect(JSON.parse(Buffer.from(serialized, "base64url").toString("utf8"))).toEqual({
      role: "CUSTOMER",
      targetUserId: CUSTOMER_USER_ID,
    });
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
    expect(
      parseDevViewCookie(encodeCookie({ role: "ADMIN", targetUserId: TECH_USER_ID }))
    ).toBeNull();
  });

  it("returns null when targetUserId is missing or empty", () => {
    expect(parseDevViewCookie(encodeCookie({ role: "TECH" }))).toBeNull();
    expect(
      parseDevViewCookie(encodeCookie({ role: "TECH", targetUserId: "" }))
    ).toBeNull();
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
    expect(dbMock.user.findFirst).not.toHaveBeenCalled();
  });

  it("ignores the cookie for accounts that are not developers", async () => {
    const resolved = await resolveDevView({
      actor: outsiderActor,
      cookieValue: { role: "TECH", targetUserId: TECH_USER_ID },
    });

    expect(resolved).toBeNull();
    expect(dbMock.user.findFirst).not.toHaveBeenCalled();
  });

  it("returns null when the target does not exist, is inactive or has another role", async () => {
    dbMock.user.findFirst.mockResolvedValue(null);

    const resolved = await resolveDevView({
      actor: developerActor,
      cookieValue: { role: "TECH", targetUserId: "missing" },
    });

    expect(resolved).toBeNull();
    expect(dbMock.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "missing", isActive: true, role: "TECH" },
      })
    );
  });

  it("returns null when the technician row is missing", async () => {
    dbMock.user.findFirst.mockResolvedValue({ ...technicianRow(), technician: null });

    const resolved = await resolveDevView({
      actor: developerActor,
      cookieValue: { role: "TECH", targetUserId: TECH_USER_ID },
    });

    expect(resolved).toBeNull();
  });

  it("returns null when the customer row is missing", async () => {
    dbMock.user.findFirst.mockResolvedValue({ ...customerRow(), customer: null });

    const resolved = await resolveDevView({
      actor: developerActor,
      cookieValue: { role: "CUSTOMER", targetUserId: CUSTOMER_USER_ID },
    });

    expect(resolved).toBeNull();
  });

  it("resolves a technician target labelled with its full name", async () => {
    dbMock.user.findFirst.mockResolvedValue(technicianRow());

    const resolved = await resolveDevView({
      actor: developerActor,
      cookieValue: { role: "TECH", targetUserId: TECH_USER_ID },
    });

    expect(resolved).toEqual({
      targetUser: {
        id: TECH_USER_ID,
        email: "tech@acostaspool.test",
        fullName: "Tecnico Demo",
        role: "TECH",
        avatarUrl: null,
      },
      label: "Tecnico Demo",
    });
  });

  it("resolves a customer target labelled with its customer name", async () => {
    dbMock.user.findFirst.mockResolvedValue(customerRow());

    const resolved = await resolveDevView({
      actor: developerActor,
      cookieValue: { role: "CUSTOMER", targetUserId: CUSTOMER_USER_ID },
    });

    expect(resolved).toEqual({
      targetUser: {
        id: CUSTOMER_USER_ID,
        email: "cliente@acostaspool.test",
        fullName: "Cliente Demo",
        role: "CUSTOMER",
        avatarUrl: "/avatars/cliente.png",
      },
      label: "Cliente Demo",
    });
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
    dbMock.user.findUnique.mockResolvedValue({
      ...developerActor,
      isActive: false,
    });

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
    });
  });
});

describe("listDevViewTargets", () => {
  it("labels every target and prefers the developer's own rows as defaults", async () => {
    dbMock.user.findMany
      .mockResolvedValueOnce([
        { id: TECH_USER_ID, fullName: "Tecnico Demo", email: "tech@acostaspool.test" },
        { id: DEVELOPER_ID, fullName: "Dev Principal", email: DEVELOPER_EMAIL },
      ])
      .mockResolvedValueOnce([
        {
          id: CUSTOMER_USER_ID,
          fullName: "Cliente Demo",
          email: "cliente@acostaspool.test",
          customer: {
            nombre: "Cliente",
            apellidos: "Demo",
            email: "cliente@acostaspool.test",
          },
        },
      ]);

    const targets = await listDevViewTargets(DEVELOPER_ID);

    expect(targets.technicians).toEqual([
      { userId: TECH_USER_ID, label: "Tecnico Demo" },
      { userId: DEVELOPER_ID, label: "Dev Principal" },
    ]);
    expect(targets.customers).toEqual([
      { userId: CUSTOMER_USER_ID, label: "Cliente Demo" },
    ]);
    expect(targets.defaults).toEqual({
      TECH: DEVELOPER_ID,
      CUSTOMER: CUSTOMER_USER_ID,
    });
  });

  it("returns null defaults when a role has no candidates", async () => {
    dbMock.user.findMany.mockResolvedValue([]);

    const targets = await listDevViewTargets(DEVELOPER_ID);

    expect(targets).toEqual({
      technicians: [],
      customers: [],
      defaults: { TECH: null, CUSTOMER: null },
    });
  });
});
