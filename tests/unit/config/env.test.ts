import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_SECRET_MIN_LENGTH,
  ENV_VARIABLE_NAMES,
  EnvValidationError,
  PUSHER_CLIENT_ENV_VARIABLES,
  PUSHER_SERVER_ENV_VARIABLES,
  REQUIRED_ENV_VARIABLES,
  S3_ENV_VARIABLES,
  SMTP_ENV_VARIABLES,
  assertEnv,
  formatEnvErrors,
  resolveStorageDriver,
  validateEnv,
  type EnvSource,
  type EnvValidationResult,
} from "@/lib/config/env";

const VALID_REQUIRED: EnvSource = {
  DATABASE_URL: "postgresql://user:secret@localhost:5432/acostaspool",
  AUTH_SECRET: "a".repeat(AUTH_SECRET_MIN_LENGTH),
  APP_URL: "https://acostaspool.example",
};

const FULL_S3: EnvSource = {
  STORAGE_DRIVER: "s3",
  AWS_REGION: "us-east-1",
  AWS_S3_BUCKET: "acostaspool-assets",
  AWS_ACCESS_KEY_ID: "AKIAEXAMPLE",
  AWS_SECRET_ACCESS_KEY: "secret-example",
};

const FULL_PUSHER: EnvSource = {
  PUSHER_APP_ID: "123456",
  PUSHER_KEY: "pusher-key",
  PUSHER_SECRET: "pusher-secret",
  PUSHER_CLUSTER: "mt1",
  NEXT_PUBLIC_PUSHER_KEY: "pusher-key",
  NEXT_PUBLIC_PUSHER_CLUSTER: "mt1",
};

const FULL_SMTP: EnvSource = {
  SMTP_HOST: "smtp.example",
  SMTP_PORT: "587",
  SMTP_USER: "mailer@example.com",
  SMTP_PASS: "smtp-password",
};

const withRequired = (overrides: EnvSource = {}): EnvSource => ({
  ...VALID_REQUIRED,
  ...overrides,
});

const warningsMentioning = (result: EnvValidationResult, text: string) =>
  result.warnings.filter((message) => message.includes(text));

const errorsMentioning = (result: EnvValidationResult, text: string) =>
  result.errors.filter((message) => message.includes(text));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("validateEnv - required variables", () => {
  it("reports ok when the required variables are valid", () => {
    const result = validateEnv(VALID_REQUIRED);

    expect(result.ok).toBe(true);
    expect(result.missingRequired).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("lists every required variable when the source is empty", () => {
    const result = validateEnv({});

    expect(result.ok).toBe(false);
    expect(result.missingRequired).toEqual([...REQUIRED_ENV_VARIABLES]);
    expect(result.errors).toHaveLength(REQUIRED_ENV_VARIABLES.length);
  });

  it("treats blank and whitespace-only values as missing", () => {
    const result = validateEnv({
      DATABASE_URL: "",
      AUTH_SECRET: "   ",
      APP_URL: "\t",
    });

    expect(result.missingRequired).toEqual([...REQUIRED_ENV_VARIABLES]);
  });

  it("warns (without blocking startup) when AUTH_SECRET is shorter than the minimum length", () => {
    const result = validateEnv(
      withRequired({ AUTH_SECRET: "b".repeat(AUTH_SECRET_MIN_LENGTH - 1) })
    );

    expect(result.ok).toBe(true);
    expect(result.missingRequired).toEqual([]);
    expect(warningsMentioning(result, String(AUTH_SECRET_MIN_LENGTH))).toHaveLength(1);
  });

  it("rejects an APP_URL that is not an absolute URL", () => {
    const result = validateEnv(withRequired({ APP_URL: "acostaspool.com" }));

    expect(result.missingRequired).toEqual(["APP_URL"]);
    expect(errorsMentioning(result, "APP_URL")).toHaveLength(1);
  });

  it("rejects a DATABASE_URL that is not a PostgreSQL connection string", () => {
    const result = validateEnv(
      withRequired({ DATABASE_URL: "mysql://user:secret@localhost:3306/db" })
    );

    expect(result.missingRequired).toEqual(["DATABASE_URL"]);
  });

  it.each([
    "postgres://user:secret@localhost:5432/db",
    "postgresql://user:secret@localhost:5432/db?schema=public",
    "prisma://accelerate.prisma-data.net/?api_key=example",
  ])("accepts %p as DATABASE_URL", (databaseUrl) => {
    const result = validateEnv(withRequired({ DATABASE_URL: databaseUrl }));

    expect(result.missingRequired).toEqual([]);
  });

  it("does not throw for malformed values of recommended variables", () => {
    const result = validateEnv(
      withRequired({ SMTP_PORT: "not-a-port", NEXT_PUBLIC_CDN_URL: "cdn" })
    );

    expect(result.ok).toBe(true);
    expect(warningsMentioning(result, "SMTP_PORT")).toHaveLength(1);
    expect(warningsMentioning(result, "NEXT_PUBLIC_CDN_URL")).toHaveLength(1);
  });

  it("reads process.env by default", () => {
    vi.stubEnv("DATABASE_URL", VALID_REQUIRED.DATABASE_URL);
    vi.stubEnv("AUTH_SECRET", VALID_REQUIRED.AUTH_SECRET);
    vi.stubEnv("APP_URL", VALID_REQUIRED.APP_URL);

    const result = validateEnv();

    expect(
      REQUIRED_ENV_VARIABLES.some((name) => result.missingRequired.includes(name))
    ).toBe(false);
  });

  it("does not mutate the source", () => {
    const source = Object.freeze({ ...VALID_REQUIRED, STORAGE_DRIVER: "s3" });
    const snapshot = { ...source };

    validateEnv(source);

    expect(source).toEqual(snapshot);
  });

  it("knows every variable read by the project", () => {
    const expected = [
      ...REQUIRED_ENV_VARIABLES,
      ...S3_ENV_VARIABLES,
      ...SMTP_ENV_VARIABLES,
      ...PUSHER_SERVER_ENV_VARIABLES,
      ...PUSHER_CLIENT_ENV_VARIABLES,
      "CRON_SECRET",
      "CONTACT_INBOX_EMAIL",
      "STORAGE_DRIVER",
      "NEXT_PUBLIC_CDN_URL",
      "GOOGLE_MAPS_SERVER_API_KEY",
      "GOOGLE_MAPS_API_KEY",
      "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
      "BUSINESS_TIMEZONE",
      "NEXT_PUBLIC_BUSINESS_TIMEZONE",
    ];

    expect(ENV_VARIABLE_NAMES).toEqual(expect.arrayContaining(expected));
  });
});

describe("validateEnv - storage", () => {
  it("warns about the AWS variables only when STORAGE_DRIVER is s3 (never blocks startup)", () => {
    const s3 = validateEnv(withRequired({ STORAGE_DRIVER: "s3" }));
    const local = validateEnv(withRequired({ STORAGE_DRIVER: "local" }));

    expect(s3.ok).toBe(true);
    expect(s3.missingRequired).toEqual([]);
    for (const name of S3_ENV_VARIABLES) {
      expect(warningsMentioning(s3, `${name} is required when STORAGE_DRIVER=s3`)).toHaveLength(1);
    }
    expect(local.ok).toBe(true);
    expect(warningsMentioning(local, "STORAGE_DRIVER=s3")).toEqual([]);
  });

  it("passes when the S3 configuration is complete", () => {
    const result = validateEnv(withRequired(FULL_S3));

    expect(result.ok).toBe(true);
  });

  it("accepts STORAGE_DRIVER case-insensitively, like the storage module", () => {
    const result = validateEnv(withRequired({ STORAGE_DRIVER: "S3" }));

    expect(resolveStorageDriver({ STORAGE_DRIVER: " S3 " })).toBe("s3");
    expect(result.missingRequired).toEqual([]);
    expect(warningsMentioning(result, "STORAGE_DRIVER=s3")).toHaveLength(S3_ENV_VARIABLES.length);
  });

  it("warns about an unknown STORAGE_DRIVER instead of blocking", () => {
    const result = validateEnv(withRequired({ STORAGE_DRIVER: "gcs" }));

    expect(result.ok).toBe(true);
    expect(resolveStorageDriver({ STORAGE_DRIVER: "gcs" })).toBe("local");
    expect(warningsMentioning(result, "STORAGE_DRIVER")).toHaveLength(1);
  });
});

describe("validateEnv - realtime notifications", () => {
  it("warns that Pusher is off and mentions the in-memory fallback", () => {
    const result = validateEnv(VALID_REQUIRED);

    const pusherWarnings = warningsMentioning(result, "Pusher");
    expect(pusherWarnings).toHaveLength(1);
    expect(pusherWarnings[0]).toContain("in-memory bus");
  });

  it("warns when the server credentials are incomplete", () => {
    const result = validateEnv(
      withRequired({ ...FULL_PUSHER, PUSHER_SECRET: undefined })
    );

    const pusherWarnings = warningsMentioning(result, "Pusher server");
    expect(pusherWarnings).toHaveLength(1);
    expect(pusherWarnings[0]).toContain("PUSHER_SECRET");
  });

  it("warns when the browser settings are missing", () => {
    const result = validateEnv(
      withRequired({
        ...FULL_PUSHER,
        NEXT_PUBLIC_PUSHER_KEY: undefined,
        NEXT_PUBLIC_PUSHER_CLUSTER: undefined,
      })
    );

    expect(warningsMentioning(result, "Pusher browser")).toHaveLength(1);
  });

  it("warns when the browser key or cluster differ from the server ones", () => {
    const result = validateEnv(
      withRequired({
        ...FULL_PUSHER,
        NEXT_PUBLIC_PUSHER_KEY: "other-key",
        NEXT_PUBLIC_PUSHER_CLUSTER: "eu",
      })
    );

    expect(warningsMentioning(result, "does not match PUSHER_KEY")).toHaveLength(1);
    expect(warningsMentioning(result, "does not match PUSHER_CLUSTER")).toHaveLength(1);
  });

  it("does not warn about Pusher when the configuration is complete and consistent", () => {
    const result = validateEnv(withRequired(FULL_PUSHER));

    expect(warningsMentioning(result, "Pusher")).toEqual([]);
    expect(warningsMentioning(result, "PUSHER")).toEqual([]);
  });
});

describe("validateEnv - e-mail and cron", () => {
  it("warns when SMTP is not configured at all", () => {
    const result = validateEnv(VALID_REQUIRED);

    const smtpWarnings = warningsMentioning(result, "SMTP is not configured");
    expect(smtpWarnings).toHaveLength(1);
    expect(warningsMentioning(result, "CONTACT_INBOX_EMAIL")).toEqual([]);
  });

  it("warns which SMTP variables are missing when partially configured", () => {
    const result = validateEnv(withRequired({ SMTP_HOST: "smtp.example" }));

    const smtpWarnings = warningsMentioning(result, "partially configured");
    expect(smtpWarnings).toHaveLength(1);
    expect(smtpWarnings[0]).toContain("SMTP_USER");
    expect(smtpWarnings[0]).toContain("SMTP_PASS");
  });

  it("warns about CONTACT_INBOX_EMAIL only once SMTP is configured", () => {
    const result = validateEnv(withRequired(FULL_SMTP));

    expect(warningsMentioning(result, "SMTP")).toHaveLength(1);
    expect(warningsMentioning(result, "CONTACT_INBOX_EMAIL is not set")).toHaveLength(1);
  });

  it("warns about an invalid CONTACT_INBOX_EMAIL", () => {
    const result = validateEnv(
      withRequired({ ...FULL_SMTP, CONTACT_INBOX_EMAIL: "not-an-email" })
    );

    expect(result.ok).toBe(true);
    expect(warningsMentioning(result, "CONTACT_INBOX_EMAIL must be")).toHaveLength(1);
  });

  it("warns about an out-of-range SMTP_PORT", () => {
    const result = validateEnv(withRequired({ ...FULL_SMTP, SMTP_PORT: "70000" }));

    expect(warningsMentioning(result, "SMTP_PORT")).toHaveLength(1);
  });

  it("warns when CRON_SECRET is missing and stays quiet when present", () => {
    const missing = validateEnv(VALID_REQUIRED);
    const present = validateEnv(withRequired({ CRON_SECRET: "cron-secret" }));

    expect(warningsMentioning(missing, "CRON_SECRET")).toHaveLength(1);
    expect(warningsMentioning(present, "CRON_SECRET")).toEqual([]);
  });
});

describe("validateEnv - Google Maps and time zone", () => {
  it("warns separately about the server and browser Google Maps keys", () => {
    const result = validateEnv(VALID_REQUIRED);

    expect(warningsMentioning(result, "GOOGLE_MAPS_SERVER_API_KEY")).toHaveLength(1);
    expect(warningsMentioning(result, "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY")).toHaveLength(1);
  });

  it("accepts GOOGLE_MAPS_API_KEY as the server-side alias", () => {
    const result = validateEnv(withRequired({ GOOGLE_MAPS_API_KEY: "server-key" }));

    expect(warningsMentioning(result, "GOOGLE_MAPS_SERVER_API_KEY")).toEqual([]);
  });

  it("blocks on an invalid BUSINESS_TIMEZONE because it crashes at import time", () => {
    const result = validateEnv(withRequired({ BUSINESS_TIMEZONE: "Mars/Olympus" }));

    expect(result.ok).toBe(false);
    expect(result.missingRequired).toEqual(["BUSINESS_TIMEZONE"]);
  });

  it("accepts a valid IANA time zone", () => {
    const result = validateEnv(withRequired({ BUSINESS_TIMEZONE: "America/New_York" }));

    expect(result.ok).toBe(true);
  });

  it("warns when the public and server time zones differ", () => {
    const result = validateEnv(
      withRequired({
        BUSINESS_TIMEZONE: "America/New_York",
        NEXT_PUBLIC_BUSINESS_TIMEZONE: "Europe/Madrid",
      })
    );

    expect(warningsMentioning(result, "takes precedence")).toHaveLength(1);
  });
});

describe("assertEnv", () => {
  it("returns the validation result when the configuration is ok", () => {
    const result = assertEnv(VALID_REQUIRED);

    expect(result.ok).toBe(true);
  });

  it("throws an EnvValidationError naming the offending variables", () => {
    const source = withRequired({ AUTH_SECRET: "", APP_URL: "not a url" });

    const act = () => assertEnv(source);

    expect(act).toThrow(EnvValidationError);
    expect(act).toThrow(/AUTH_SECRET is required/);
    expect(act).toThrow(/APP_URL must be an absolute URL/);
    expect(act).toThrow(/\.env\.example/);
  });

  it("exposes the full result on the error", () => {
    const result = validateEnv({});

    const error = new EnvValidationError(result);

    expect(error.name).toBe("EnvValidationError");
    expect(error.result).toBe(result);
    expect(error.message).toBe(formatEnvErrors(result));
  });
});
