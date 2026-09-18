import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "@/app/api/client/profile/route";

const dbMock = vi.hoisted(() => ({
  customer: { findUnique: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}));
const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }));
const passwordMock = vi.hoisted(() => ({ verifyPassword: vi.fn() }));
const mailMock = vi.hoisted(() => ({
  getMailConfig: vi.fn(),
  sendMailAndLog: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: dbMock }));
vi.mock("@/lib/auth/session", () => sessionMock);
vi.mock("@/lib/auth/password", () => passwordMock);
vi.mock("@/lib/mail/transport", () => mailMock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const PROFILE_URL = "http://localhost/api/client/profile";
const CUSTOMER_ID = "customer-1";
const USER_ID = "user-1";
const CURRENT_EMAIL = "ana@example.com";
const NEW_EMAIL = "ana.new@example.com";
const PASSWORD_HASH = "$2a$12$hash";
const CORRECT_PASSWORD = "correct-horse";
const WRONG_PASSWORD = "wrong-horse";
const CUSTOMER_SESSION = { sub: USER_ID, role: "CUSTOMER" };
const SMTP_CONFIG = {
  host: "smtp.example",
  port: 587,
  user: "mailer@example.com",
  pass: "secret",
  from: "mailer@example.com",
};
const OK_STATUS = 200;
const BAD_REQUEST_STATUS = 400;
const UNAUTHORIZED_STATUS = 401;

function personalPayload(overrides: Record<string, unknown> = {}) {
  return {
    kind: "personal",
    nombre: "Ana",
    apellidos: "Perez",
    email: CURRENT_EMAIL,
    telefono: "305-555-0101",
    idiomaPreferencia: "ES",
    ...overrides,
  };
}

function patchRequest(payload: unknown) {
  return new Request(PROFILE_URL, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("PATCH /api/client/profile (personal)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionMock.getSession.mockReset().mockResolvedValue(CUSTOMER_SESSION);
    dbMock.customer.findUnique
      .mockReset()
      .mockResolvedValue({ id: CUSTOMER_ID, userId: USER_ID });
    dbMock.customer.update.mockReset();
    dbMock.user.findUnique
      .mockReset()
      .mockResolvedValue({ email: CURRENT_EMAIL, passwordHash: PASSWORD_HASH });
    dbMock.user.findFirst.mockReset().mockResolvedValue(null);
    dbMock.user.update.mockReset();
    dbMock.$transaction.mockReset().mockResolvedValue([]);
    passwordMock.verifyPassword.mockReset().mockResolvedValue(true);
    mailMock.getMailConfig.mockReset().mockReturnValue(SMTP_CONFIG);
    mailMock.sendMailAndLog.mockReset().mockResolvedValue({ ok: true, emailLogId: "log-1" });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("saves the profile without a password when the e-mail does not change", async () => {
    const response = await PATCH(patchRequest(personalPayload()));

    expect(response.status).toBe(OK_STATUS);
    expect(passwordMock.verifyPassword).not.toHaveBeenCalled();
    expect(mailMock.sendMailAndLog).not.toHaveBeenCalled();
    expect(dbMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("treats a case-only difference as the same address", async () => {
    const response = await PATCH(
      patchRequest(personalPayload({ email: CURRENT_EMAIL.toUpperCase() }))
    );

    expect(response.status).toBe(OK_STATUS);
    expect(passwordMock.verifyPassword).not.toHaveBeenCalled();
  });

  it("refuses an e-mail change that carries no current password", async () => {
    const response = await PATCH(
      patchRequest(personalPayload({ email: NEW_EMAIL }))
    );

    expect(response.status).toBe(BAD_REQUEST_STATUS);
    await expect(response.json()).resolves.toEqual({
      error: "Current password required",
    });
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an e-mail change with a wrong password and keeps the old address", async () => {
    passwordMock.verifyPassword.mockResolvedValue(false);

    const response = await PATCH(
      patchRequest(
        personalPayload({ email: NEW_EMAIL, currentPassword: WRONG_PASSWORD })
      )
    );

    expect(response.status).toBe(UNAUTHORIZED_STATUS);
    await expect(response.json()).resolves.toEqual({ error: "Invalid password" });
    expect(passwordMock.verifyPassword).toHaveBeenCalledWith(
      WRONG_PASSWORD,
      PASSWORD_HASH
    );
    expect(dbMock.$transaction).not.toHaveBeenCalled();
    expect(mailMock.sendMailAndLog).not.toHaveBeenCalled();
  });

  it("refuses the change when the account has no password yet", async () => {
    dbMock.user.findUnique.mockResolvedValue({
      email: CURRENT_EMAIL,
      passwordHash: null,
    });

    const response = await PATCH(
      patchRequest(
        personalPayload({ email: NEW_EMAIL, currentPassword: CORRECT_PASSWORD })
      )
    );

    expect(response.status).toBe(BAD_REQUEST_STATUS);
    await expect(response.json()).resolves.toEqual({
      error: expect.stringContaining("no password"),
    });
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("accepts the change with the right password and warns the previous address", async () => {
    const response = await PATCH(
      patchRequest(
        personalPayload({ email: NEW_EMAIL, currentPassword: CORRECT_PASSWORD })
      )
    );

    expect(response.status).toBe(OK_STATUS);
    expect(passwordMock.verifyPassword).toHaveBeenCalledWith(
      CORRECT_PASSWORD,
      PASSWORD_HASH
    );
    expect(dbMock.$transaction).toHaveBeenCalledTimes(1);
    expect(mailMock.sendMailAndLog).toHaveBeenCalledWith(
      expect.objectContaining({
        to: CURRENT_EMAIL,
        customerId: CUSTOMER_ID,
        metadata: expect.objectContaining({ category: "EMAIL_CHANGED" }),
      })
    );
  });

  it("skips the notice when SMTP is not configured", async () => {
    mailMock.getMailConfig.mockReturnValue(null);

    const response = await PATCH(
      patchRequest(
        personalPayload({ email: NEW_EMAIL, currentPassword: CORRECT_PASSWORD })
      )
    );

    expect(response.status).toBe(OK_STATUS);
    expect(mailMock.sendMailAndLog).not.toHaveBeenCalled();
  });

  it("still saves the profile when the notice cannot be sent", async () => {
    mailMock.sendMailAndLog.mockRejectedValue(new Error("smtp down"));

    const response = await PATCH(
      patchRequest(
        personalPayload({ email: NEW_EMAIL, currentPassword: CORRECT_PASSWORD })
      )
    );

    expect(response.status).toBe(OK_STATUS);
    expect(console.error).toHaveBeenCalledWith(
      "Email change notice failed:",
      expect.any(Error)
    );
  });

  it("rejects a session that is not a customer", async () => {
    sessionMock.getSession.mockResolvedValue({ sub: USER_ID, role: "ADMIN" });

    const response = await PATCH(patchRequest(personalPayload()));

    expect(response.status).toBe(UNAUTHORIZED_STATUS);
    expect(dbMock.customer.findUnique).not.toHaveBeenCalled();
  });
});
