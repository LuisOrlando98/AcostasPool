import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
  createTransport: vi.fn(),
  emailLogCreate: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: mocks.createTransport },
  createTransport: mocks.createTransport,
}));

vi.mock("@/lib/db", () => ({
  prisma: { emailLog: { create: mocks.emailLogCreate } },
}));

import {
  getMailConfig,
  sendMailAndLog,
  summarizeError,
  type SendMailAndLogInput,
} from "@/lib/mail/transport";

const SMTP_ENV_KEYS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
] as const;
type SmtpEnvKey = (typeof SMTP_ENV_KEYS)[number];

const CONFIGURED_ENV: Record<SmtpEnvKey, string> = {
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: "2525",
  SMTP_USER: "mailer@example.com",
  SMTP_PASS: "secret",
  SMTP_FROM: "AcostasPool <no-reply@example.com>",
};

const DEFAULT_SMTP_PORT = 587;
const IMPLICIT_TLS_PORT = 465;
const ERROR_MESSAGE_MAX_LENGTH = 500;
const EMAIL_LOG_ID = "log_1";
const SINGLE_ATTEMPT = 1;

function stubSmtpEnv(values: Partial<Record<SmtpEnvKey, string>>) {
  for (const key of SMTP_ENV_KEYS) {
    vi.stubEnv(key, values[key] ?? "");
  }
}

function buildInput(overrides: Partial<SendMailAndLogInput> = {}): SendMailAndLogInput {
  return {
    to: "ana@example.com",
    recipientName: "Ana Perez",
    subject: "Invitacion",
    text: "Cuerpo en texto",
    html: "<p>Cuerpo en HTML</p>",
    template: "CUSTOMER_INVITE",
    recipientRole: "CUSTOMER",
    customerId: "cus_1",
    metadata: { category: "CUSTOMER_INVITE" },
    ...overrides,
  };
}

function lastEmailLogData() {
  const lastCall = mocks.emailLogCreate.mock.calls.at(-1);
  return lastCall?.[0]?.data;
}

beforeEach(() => {
  mocks.sendMail.mockReset();
  mocks.createTransport.mockReset();
  mocks.emailLogCreate.mockReset();
  mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
  mocks.sendMail.mockResolvedValue({ messageId: "msg_1" });
  mocks.emailLogCreate.mockResolvedValue({ id: EMAIL_LOG_ID });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("getMailConfig", () => {
  it("returns null when a required variable is missing", () => {
    stubSmtpEnv({ ...CONFIGURED_ENV, SMTP_PASS: "" });
    expect(getMailConfig()).toBeNull();
  });

  it("defaults the port to 587 and the sender to SMTP_USER", () => {
    stubSmtpEnv({ SMTP_HOST: " smtp.example.com ", SMTP_USER: "mailer@example.com", SMTP_PASS: "secret" });
    expect(getMailConfig()).toEqual({
      host: "smtp.example.com",
      port: DEFAULT_SMTP_PORT,
      user: "mailer@example.com",
      pass: "secret",
      from: "mailer@example.com",
    });
  });

  it("returns null and warns when SMTP_PORT is not a valid port", () => {
    stubSmtpEnv({ ...CONFIGURED_ENV, SMTP_PORT: "not-a-port" });
    expect(getMailConfig()).toBeNull();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });
});

describe("sendMailAndLog", () => {
  it("records a FAILED row and skips nodemailer when SMTP is not configured", async () => {
    stubSmtpEnv({});

    const result = await sendMailAndLog(buildInput());

    expect(result).toEqual({
      ok: false,
      reason: "not_configured",
      error: "SMTP not configured",
      emailLogId: EMAIL_LOG_ID,
    });
    expect(mocks.createTransport).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(lastEmailLogData()).toMatchObject({
      recipientEmail: "ana@example.com",
      recipientRole: "CUSTOMER",
      status: "FAILED",
      errorMessage: "SMTP not configured",
      sentAt: null,
    });
  });

  it("sends the message and records a SENT row with template and attempts", async () => {
    stubSmtpEnv(CONFIGURED_ENV);

    const result = await sendMailAndLog(buildInput());

    expect(result).toEqual({ ok: true, emailLogId: EMAIL_LOG_ID });
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: CONFIGURED_ENV.SMTP_FROM,
        to: "ana@example.com",
        subject: "Invitacion",
        text: "Cuerpo en texto",
        html: "<p>Cuerpo en HTML</p>",
      })
    );
    expect(mocks.emailLogCreate).toHaveBeenCalledTimes(1);
    expect(lastEmailLogData()).toMatchObject({
      recipientEmail: "ana@example.com",
      recipientName: "Ana Perez",
      recipientRole: "CUSTOMER",
      subject: "Invitacion",
      bodyText: "Cuerpo en texto",
      bodyHtml: "<p>Cuerpo en HTML</p>",
      status: "SENT",
      errorMessage: null,
      customerId: "cus_1",
      technicianId: null,
      jobId: null,
      digestId: null,
      metadata: {
        category: "CUSTOMER_INVITE",
        template: "CUSTOMER_INVITE",
        attempts: SINGLE_ATTEMPT,
      },
    });
    expect(lastEmailLogData().sentAt).toBeInstanceOf(Date);
  });

  it("records a FAILED row with the error message when sendMail rejects", async () => {
    stubSmtpEnv(CONFIGURED_ENV);
    mocks.sendMail.mockRejectedValueOnce(new Error("ECONNREFUSED 127.0.0.1:2525"));

    const result = await sendMailAndLog(buildInput());

    expect(result).toEqual({
      ok: false,
      reason: "send_failed",
      error: "ECONNREFUSED 127.0.0.1:2525",
      emailLogId: EMAIL_LOG_ID,
    });
    expect(lastEmailLogData()).toMatchObject({
      status: "FAILED",
      errorMessage: "ECONNREFUSED 127.0.0.1:2525",
      sentAt: null,
    });
    expect(console.error).toHaveBeenCalled();
  });

  it("passes replyTo, bcc and attachments through to nodemailer", async () => {
    stubSmtpEnv(CONFIGURED_ENV);

    await sendMailAndLog(
      buildInput({
        replyTo: "inbox@example.com",
        bcc: ["dev@example.com", "ops@example.com"],
        attachments: [{ filename: "INV-1.pdf", content: Buffer.from("pdf") }],
      })
    );

    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        replyTo: "inbox@example.com",
        bcc: ["dev@example.com", "ops@example.com"],
        attachments: [{ filename: "INV-1.pdf", content: Buffer.from("pdf") }],
      })
    );
  });

  it("reuses one transporter while the SMTP configuration is unchanged", async () => {
    stubSmtpEnv({ ...CONFIGURED_ENV, SMTP_HOST: "singleton.example.com" });

    await sendMailAndLog(buildInput());
    await sendMailAndLog(buildInput({ subject: "Segundo" }));

    expect(mocks.createTransport).toHaveBeenCalledTimes(1);
    expect(mocks.createTransport).toHaveBeenCalledWith({
      host: "singleton.example.com",
      port: Number(CONFIGURED_ENV.SMTP_PORT),
      secure: false,
      auth: { user: CONFIGURED_ENV.SMTP_USER, pass: CONFIGURED_ENV.SMTP_PASS },
    });
    expect(mocks.sendMail).toHaveBeenCalledTimes(2);
  });

  it("enables implicit TLS on port 465", async () => {
    stubSmtpEnv({
      ...CONFIGURED_ENV,
      SMTP_HOST: "tls.example.com",
      SMTP_PORT: String(IMPLICIT_TLS_PORT),
    });

    await sendMailAndLog(buildInput());

    expect(mocks.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: IMPLICIT_TLS_PORT, secure: true })
    );
  });

  it("keeps the send outcome when the EmailLog write fails", async () => {
    stubSmtpEnv(CONFIGURED_ENV);
    mocks.emailLogCreate.mockRejectedValueOnce(new Error("db down"));

    const result = await sendMailAndLog(buildInput());

    expect(result).toEqual({ ok: true, emailLogId: null });
    expect(console.error).toHaveBeenCalledTimes(1);
  });
});

describe("summarizeError", () => {
  it("uses the Error message", () => {
    expect(summarizeError(new Error("boom"))).toBe("boom");
  });

  it("stringifies non-Error values and falls back for empty ones", () => {
    expect(summarizeError("plain")).toBe("plain");
    expect(summarizeError("   ")).toBe("Unknown send error");
  });

  it("caps long messages", () => {
    const summary = summarizeError(new Error("x".repeat(ERROR_MESSAGE_MAX_LENGTH * 2)));
    expect(summary).toHaveLength(ERROR_MESSAGE_MAX_LENGTH + "...".length);
    expect(summary.endsWith("...")).toBe(true);
  });
});
