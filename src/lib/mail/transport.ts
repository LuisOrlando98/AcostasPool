import nodemailer, { type SendMailOptions, type Transporter } from "nodemailer";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { EmailTemplateId } from "@/lib/email-templates";

/**
 * Single SMTP transport for the web app.
 *
 * Every send goes through `sendMailAndLog`, which always writes one EmailLog row
 * (status SENT or FAILED, one attempt) so admins can audit what left the system,
 * what failed and why. SMTP failures never throw: callers receive a result object
 * and decide how to surface it. A failure to write the EmailLog row is reported
 * to the console and does not change the send outcome.
 */

const DEFAULT_SMTP_PORT = 587;
const SMTP_IMPLICIT_TLS_PORT = 465;
const MAX_TCP_PORT = 65535;
const ERROR_MESSAGE_MAX_LENGTH = 500;
const SINGLE_ATTEMPT = 1;
const UNKNOWN_SEND_ERROR = "Unknown send error";

export const SMTP_NOT_CONFIGURED_ERROR = "SMTP not configured";

export type MailConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

/** Values written to EmailLog.recipientRole (a free-form string column). */
export type MailRecipientRole = "ADMIN" | "TECH" | "CUSTOMER" | "USER";

/** Identifies the content that was sent; stored in EmailLog.metadata.template. */
export type MailTemplateKey = EmailTemplateId | "PUBLIC_INTEGRATION_RESPONSE";

export type MailAttachment = {
  filename: string;
  content: Buffer | string;
};

export type SendMailAndLogInput = {
  to: string;
  recipientName?: string | null;
  subject: string;
  text: string;
  html?: string | null;
  template: MailTemplateKey;
  recipientRole: MailRecipientRole;
  customerId?: string | null;
  technicianId?: string | null;
  jobId?: string | null;
  digestId?: string | null;
  metadata?: Record<string, unknown> | null;
  replyTo?: string | null;
  bcc?: readonly string[] | null;
  attachments?: readonly MailAttachment[] | null;
};

export type SendMailFailureReason = "not_configured" | "send_failed";

export type SendMailAndLogResult =
  | { ok: true; emailLogId: string | null }
  | {
      ok: false;
      reason: SendMailFailureReason;
      error: string;
      emailLogId: string | null;
    };

type EmailLogOutcome =
  | { status: "SENT"; sentAt: Date }
  | { status: "FAILED"; errorMessage: string };

type TransporterCacheEntry = {
  signature: string;
  transporter: Transporter;
};

let transporterCache: TransporterCacheEntry | null = null;

function parseSmtpPort(rawPort: string | undefined): number | null {
  const trimmed = rawPort?.trim();
  if (!trimmed) {
    return DEFAULT_SMTP_PORT;
  }
  const port = Number(trimmed);
  if (!Number.isInteger(port) || port <= 0 || port > MAX_TCP_PORT) {
    return null;
  }
  return port;
}

/**
 * Reads and validates SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM.
 * Returns null when a required value is missing or SMTP_PORT is not a valid port.
 * SMTP_PORT defaults to 587 and SMTP_FROM defaults to SMTP_USER.
 */
export function getMailConfig(): MailConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM?.trim() || user;

  if (!host || !user || !pass || !from) {
    return null;
  }

  const port = parseSmtpPort(process.env.SMTP_PORT);
  if (port === null) {
    console.warn("Invalid SMTP_PORT; mail transport disabled:", process.env.SMTP_PORT);
    return null;
  }

  return { host, port, user, pass, from };
}

function buildConfigSignature(config: MailConfig): string {
  return JSON.stringify([config.host, config.port, config.user, config.pass, config.from]);
}

/** Lazily creates one nodemailer transporter and reuses it while the SMTP config is unchanged. */
function getTransporter(config: MailConfig): Transporter {
  const signature = buildConfigSignature(config);
  if (transporterCache && transporterCache.signature === signature) {
    return transporterCache.transporter;
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === SMTP_IMPLICIT_TLS_PORT,
    auth: { user: config.user, pass: config.pass },
  });
  transporterCache = { signature, transporter };
  return transporter;
}

/** Short, storable description of an error (message only, capped in length). */
export function summarizeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const message = raw.trim() || UNKNOWN_SEND_ERROR;
  if (message.length <= ERROR_MESSAGE_MAX_LENGTH) {
    return message;
  }
  return `${message.slice(0, ERROR_MESSAGE_MAX_LENGTH)}...`;
}

function buildMailOptions(config: MailConfig, input: SendMailAndLogInput): SendMailOptions {
  return {
    from: config.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html ?? undefined,
    replyTo: input.replyTo ?? undefined,
    bcc: input.bcc && input.bcc.length > 0 ? [...input.bcc] : undefined,
    attachments: input.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
    })),
  };
}

function buildLogMetadata(input: SendMailAndLogInput): Prisma.InputJsonValue {
  return {
    ...(input.metadata ?? {}),
    template: input.template,
    attempts: SINGLE_ATTEMPT,
  } as Prisma.InputJsonValue;
}

async function writeEmailLog(
  input: SendMailAndLogInput,
  outcome: EmailLogOutcome
): Promise<string | null> {
  try {
    const row = await prisma.emailLog.create({
      data: {
        recipientEmail: input.to,
        recipientName: input.recipientName ?? null,
        recipientRole: input.recipientRole,
        subject: input.subject,
        bodyText: input.text,
        bodyHtml: input.html ?? null,
        status: outcome.status,
        errorMessage: outcome.status === "FAILED" ? outcome.errorMessage : null,
        sentAt: outcome.status === "SENT" ? outcome.sentAt : null,
        customerId: input.customerId ?? null,
        technicianId: input.technicianId ?? null,
        jobId: input.jobId ?? null,
        digestId: input.digestId ?? null,
        metadata: buildLogMetadata(input),
      },
      select: { id: true },
    });
    return row.id;
  } catch (error) {
    console.error(`EmailLog write failed (${input.template}, ${outcome.status}):`, error);
    return null;
  }
}

/**
 * Sends one email through the shared transporter and always records an EmailLog row.
 *
 * - SMTP not configured: nothing is sent, a FAILED row is written, `reason` is "not_configured".
 * - SMTP error: a FAILED row is written with the summarized error, `reason` is "send_failed".
 * - Success: a SENT row is written with `sentAt`.
 *
 * Never throws for SMTP or logging failures.
 */
export async function sendMailAndLog(
  input: SendMailAndLogInput
): Promise<SendMailAndLogResult> {
  const config = getMailConfig();
  if (!config) {
    const emailLogId = await writeEmailLog(input, {
      status: "FAILED",
      errorMessage: SMTP_NOT_CONFIGURED_ERROR,
    });
    return {
      ok: false,
      reason: "not_configured",
      error: SMTP_NOT_CONFIGURED_ERROR,
      emailLogId,
    };
  }

  try {
    await getTransporter(config).sendMail(buildMailOptions(config, input));
  } catch (error) {
    const message = summarizeError(error);
    console.error(`Mail send failed (${input.template}):`, error);
    const emailLogId = await writeEmailLog(input, {
      status: "FAILED",
      errorMessage: message,
    });
    return { ok: false, reason: "send_failed", error: message, emailLogId };
  }

  const emailLogId = await writeEmailLog(input, { status: "SENT", sentAt: new Date() });
  return { ok: true, emailLogId };
}
