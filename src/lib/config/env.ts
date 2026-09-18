import { z } from "zod";

/**
 * Environment inventory and validation.
 *
 * Every variable read by the app (`src/`), the cron worker and the seed
 * scripts is described here, so a misconfigured deployment fails fast when a
 * required value is missing and explains what is degraded when a recommended
 * one is. The scattered `process.env.*` reads are intentionally left in place
 * for now: this module documents and checks them, it does not replace them.
 *
 * `validateEnv()` never throws; `assertEnv()` throws only when the result is
 * not ok. Both default to `process.env`.
 */

export const AUTH_SECRET_MIN_LENGTH = 32;
const MIN_TCP_PORT = 1;
const MAX_TCP_PORT = 65535;
const MIN_TRUSTED_PROXY_HOPS = 0;
const DATABASE_URL_PATTERN = /^(postgres|postgresql|prisma):\/\//i;

export const STORAGE_DRIVERS = ["local", "s3"] as const;
export type StorageDriver = (typeof STORAGE_DRIVERS)[number];
const DEFAULT_STORAGE_DRIVER: StorageDriver = "local";
const S3_STORAGE_DRIVER: StorageDriver = "s3";

const NODE_ENVIRONMENTS = ["development", "test", "production"] as const;

export const REQUIRED_ENV_VARIABLES = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "APP_URL",
] as const;
export const S3_ENV_VARIABLES = [
  "AWS_REGION",
  "AWS_S3_BUCKET",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
] as const;
export const SMTP_ENV_VARIABLES = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"] as const;
export const PUSHER_SERVER_ENV_VARIABLES = [
  "PUSHER_APP_ID",
  "PUSHER_KEY",
  "PUSHER_SECRET",
  "PUSHER_CLUSTER",
] as const;
export const PUSHER_CLIENT_ENV_VARIABLES = [
  "NEXT_PUBLIC_PUSHER_KEY",
  "NEXT_PUBLIC_PUSHER_CLUSTER",
] as const;
const GOOGLE_MAPS_SERVER_ENV_VARIABLES = [
  "GOOGLE_MAPS_SERVER_API_KEY",
  "GOOGLE_MAPS_API_KEY",
] as const;

/**
 * Variables whose absence or invalid value makes the app unusable. Besides the
 * required trio, an invalid IANA zone throws at import time in
 * `@/lib/timezone`, which takes every page down.
 */
const STARTUP_BLOCKING_VARIABLES: ReadonlySet<string> = new Set([
  ...REQUIRED_ENV_VARIABLES,
  "BUSINESS_TIMEZONE",
  "NEXT_PUBLIC_BUSINESS_TIMEZONE",
]);

function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function isStorageDriver(value: string): value is StorageDriver {
  return STORAGE_DRIVERS.some((driver) => driver === value);
}

const optionalString = z.string().min(1).optional();
const optionalUrl = z
  .string()
  .url("must be an absolute URL (e.g. https://example.com)")
  .optional();
const optionalEmail = z.string().email("must be a valid e-mail address").optional();
const optionalPort = z.coerce
  .number({ invalid_type_error: "must be a TCP port number" })
  .int("must be a TCP port number")
  .min(MIN_TCP_PORT, `must be between ${MIN_TCP_PORT} and ${MAX_TCP_PORT}`)
  .max(MAX_TCP_PORT, `must be between ${MIN_TCP_PORT} and ${MAX_TCP_PORT}`)
  .optional();
const optionalProxyHops = z.coerce
  .number({ invalid_type_error: "must be a whole number of proxy hops" })
  .int("must be a whole number of proxy hops")
  .min(
    MIN_TRUSTED_PROXY_HOPS,
    `must be ${MIN_TRUSTED_PROXY_HOPS} or greater (number of proxies in front of the app)`
  )
  .optional();
const optionalTimeZone = z
  .string()
  .refine(isValidTimeZone, {
    message: "must be a valid IANA time zone (e.g. America/New_York)",
  })
  .optional();
const optionalStorageDriver = z
  .string()
  .refine((value) => isStorageDriver(value.toLowerCase()), {
    message: `must be one of ${STORAGE_DRIVERS.join(", ")} (any other value behaves as "${DEFAULT_STORAGE_DRIVER}")`,
  })
  .optional();

export const envSchema = z.object({
  // Required
  DATABASE_URL: z
    .string({ required_error: "is required (PostgreSQL connection string)" })
    .regex(
      DATABASE_URL_PATTERN,
      "must be a PostgreSQL connection string (postgresql://user:password@host:5432/database)"
    ),
  AUTH_SECRET: z.string({
    required_error: "is required (random secret used to sign session tokens)",
  }),
  APP_URL: z
    .string({
      required_error: "is required (public URL of the app, used in e-mails and by the cron worker)",
    })
    .url("must be an absolute URL (e.g. https://acostaspool.com)"),

  // Runtime
  NODE_ENV: z
    .enum(NODE_ENVIRONMENTS, {
      errorMap: () => ({ message: `must be one of ${NODE_ENVIRONMENTS.join(", ")}` }),
    })
    .optional(),

  // Cron worker / internal endpoints
  CRON_SECRET: optionalString,

  // Edge / reverse proxy
  TRUSTED_PROXY_HOPS: optionalProxyHops,

  // Public integration links (/new-integrations/<token>)
  PUBLIC_INTEGRATION_TOKENS: optionalString,

  // Transactional e-mail
  SMTP_HOST: optionalString,
  SMTP_PORT: optionalPort,
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  SMTP_FROM: optionalString,
  CONTACT_INBOX_EMAIL: optionalEmail,

  // File storage
  STORAGE_DRIVER: optionalStorageDriver,
  AWS_REGION: optionalString,
  AWS_S3_BUCKET: optionalString,
  AWS_ACCESS_KEY_ID: optionalString,
  AWS_SECRET_ACCESS_KEY: optionalString,
  NEXT_PUBLIC_CDN_URL: optionalUrl,

  // Realtime notifications
  PUSHER_APP_ID: optionalString,
  PUSHER_KEY: optionalString,
  PUSHER_SECRET: optionalString,
  PUSHER_CLUSTER: optionalString,
  NEXT_PUBLIC_PUSHER_KEY: optionalString,
  NEXT_PUBLIC_PUSHER_CLUSTER: optionalString,
  NEXT_PUBLIC_NOTIFICATION_SOUND_URL: optionalString,

  // Google Maps
  GOOGLE_MAPS_SERVER_API_KEY: optionalString,
  GOOGLE_MAPS_API_KEY: optionalString,
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: optionalString,

  // Business settings
  BUSINESS_TIMEZONE: optionalTimeZone,
  NEXT_PUBLIC_BUSINESS_TIMEZONE: optionalTimeZone,

  // Public landing page
  NEXT_PUBLIC_LANDING_YOUTUBE_ID: optionalString,
  NEXT_PUBLIC_LANDING_SERVICES_BG_VIDEO_SRC: optionalString,
  NEXT_PUBLIC_LANDING_SERVICES_BG_VIDEO_ENABLED: optionalString,

  // Seed scripts (npm run db:seed)
  SEED_ADMIN_EMAIL: optionalEmail,
  SEED_ADMIN_PASSWORD: optionalString,
  SEED_TECH_EMAIL: optionalEmail,
  SEED_TECH_PASSWORD: optionalString,
  SEED_CUSTOMER_EMAIL: optionalEmail,
  SEED_CUSTOMER_PASSWORD: optionalString,

  // Test tooling (Playwright)
  E2E_BASE_URL: optionalUrl,
});

export type EnvVariableName = keyof z.infer<typeof envSchema>;
export const ENV_VARIABLE_NAMES: readonly EnvVariableName[] = envSchema.keyof().options;

export type EnvSource = Readonly<Record<string, string | undefined>>;
type NormalizedEnv = Partial<Record<EnvVariableName, string>>;

export type EnvIssueSeverity = "error" | "warning";
export type EnvIssue = {
  readonly name: string;
  readonly severity: EnvIssueSeverity;
  readonly message: string;
};

export type EnvValidationResult = {
  /** True when nothing blocks the app from working. */
  readonly ok: boolean;
  /** Names of blocking variables: missing, invalid, or required by another setting. */
  readonly missingRequired: readonly string[];
  /** Human-readable message for each blocking problem. */
  readonly errors: readonly string[];
  /** Human-readable message for each degraded (non-blocking) feature. */
  readonly warnings: readonly string[];
};

const envError = (name: string, message: string): EnvIssue => ({
  name,
  severity: "error",
  message,
});
const envWarning = (name: string, message: string): EnvIssue => ({
  name,
  severity: "warning",
  message,
});

/** Picks the known variables, trims them and drops blanks (`.env` placeholders). */
function normalizeSource(source: EnvSource): NormalizedEnv {
  return ENV_VARIABLE_NAMES.reduce<NormalizedEnv>((acc, name) => {
    const value = source[name]?.trim();
    return value ? { ...acc, [name]: value } : acc;
  }, {});
}

function missingNames(
  env: NormalizedEnv,
  names: readonly EnvVariableName[]
): readonly EnvVariableName[] {
  return names.filter((name) => !env[name]);
}

function schemaIssues(env: NormalizedEnv): readonly EnvIssue[] {
  const parsed = envSchema.safeParse(env);
  if (parsed.success) {
    return [];
  }
  return parsed.error.issues.map((issue) => {
    const name = String(issue.path[0] ?? "");
    const message = `${name} ${issue.message}`;
    return STARTUP_BLOCKING_VARIABLES.has(name)
      ? envError(name, message)
      : envWarning(name, message);
  });
}

/** Mirrors `@/lib/storage/object-store`: anything other than "s3" is local. */
export function resolveStorageDriver(env: EnvSource): StorageDriver {
  return env.STORAGE_DRIVER?.trim().toLowerCase() === S3_STORAGE_DRIVER
    ? S3_STORAGE_DRIVER
    : DEFAULT_STORAGE_DRIVER;
}

function storageIssues(env: NormalizedEnv): readonly EnvIssue[] {
  if (resolveStorageDriver(env) !== S3_STORAGE_DRIVER) {
    return [];
  }
  // Warning, not error: a missing bucket credential breaks uploads, but it must
  // never keep the whole web service from starting.
  return missingNames(env, S3_ENV_VARIABLES).map((name) =>
    envWarning(
      name,
      `${name} is required when STORAGE_DRIVER=s3 (uploads, avatars and invoice PDFs would fail)`
    )
  );
}

function authSecretIssues(env: NormalizedEnv): readonly EnvIssue[] {
  const secret = env.AUTH_SECRET;
  if (!secret || secret.length >= AUTH_SECRET_MIN_LENGTH) {
    return [];
  }
  // Warning, not error: rotating a short secret is the right fix, but a deploy
  // must not abort because of it (sessions would keep working).
  return [
    envWarning(
      "AUTH_SECRET",
      `AUTH_SECRET should be at least ${AUTH_SECRET_MIN_LENGTH} characters long (rotate it; current length ${secret.length})`
    ),
  ];
}

function emailIssues(env: NormalizedEnv): readonly EnvIssue[] {
  const missing = missingNames(env, SMTP_ENV_VARIABLES);
  if (missing.length === SMTP_ENV_VARIABLES.length) {
    return [
      envWarning(
        "SMTP",
        `SMTP is not configured (${SMTP_ENV_VARIABLES.join(", ")}): invitations, password resets, invoices and quote e-mails will not be sent`
      ),
    ];
  }
  if (missing.length > 0) {
    return [
      envWarning("SMTP", `SMTP is partially configured; missing ${missing.join(", ")}`),
    ];
  }
  if (!env.CONTACT_INBOX_EMAIL) {
    return [
      envWarning(
        "CONTACT_INBOX_EMAIL",
        "CONTACT_INBOX_EMAIL is not set: quote requests and public integration replies are delivered to SMTP_USER"
      ),
    ];
  }
  return [];
}

function cronIssues(env: NormalizedEnv): readonly EnvIssue[] {
  if (env.CRON_SECRET) {
    return [];
  }
  return [
    envWarning(
      "CRON_SECRET",
      "CRON_SECRET is not set: the route assistant auto-optimize endpoint rejects every call and the cron worker skips it"
    ),
  ];
}

function publicIntegrationIssues(env: NormalizedEnv): readonly EnvIssue[] {
  if (env.PUBLIC_INTEGRATION_TOKENS) {
    return [];
  }
  return [
    envWarning(
      "PUBLIC_INTEGRATION_TOKENS",
      "PUBLIC_INTEGRATION_TOKENS is not set: /new-integrations falls back to the token shipped in the source code; set it (comma-separated list) and rotate the old link"
    ),
  ];
}

function trustedProxyIssues(env: NormalizedEnv): readonly EnvIssue[] {
  if (env.NODE_ENV !== "production" || env.TRUSTED_PROXY_HOPS) {
    return [];
  }
  return [
    envWarning(
      "TRUSTED_PROXY_HOPS",
      "TRUSTED_PROXY_HOPS is not set: rate limiting assumes exactly one trusted proxy (Render). Set it to the number of proxies in front of the app"
    ),
  ];
}

function realtimeIssues(env: NormalizedEnv): readonly EnvIssue[] {
  const serverMissing = missingNames(env, PUSHER_SERVER_ENV_VARIABLES);
  const clientMissing = missingNames(env, PUSHER_CLIENT_ENV_VARIABLES);
  const nothingConfigured =
    serverMissing.length === PUSHER_SERVER_ENV_VARIABLES.length &&
    clientMissing.length === PUSHER_CLIENT_ENV_VARIABLES.length;
  if (nothingConfigured) {
    return [
      envWarning(
        "PUSHER",
        "Pusher is not configured (PUSHER_* and NEXT_PUBLIC_PUSHER_*): realtime notifications fall back to an in-memory bus that only reaches browsers connected to the same instance"
      ),
    ];
  }
  const partial = [
    ...(serverMissing.length > 0
      ? [
          envWarning(
            "PUSHER",
            `Pusher server credentials are incomplete; missing ${serverMissing.join(", ")} (the server falls back to the in-memory bus)`
          ),
        ]
      : []),
    ...(clientMissing.length > 0
      ? [
          envWarning(
            "NEXT_PUBLIC_PUSHER_KEY",
            `Pusher browser settings are incomplete; missing ${clientMissing.join(", ")} (browsers fall back to the SSE stream of the instance they hit)`
          ),
        ]
      : []),
  ];
  if (partial.length > 0) {
    return partial;
  }
  return [
    ...(env.PUSHER_KEY !== env.NEXT_PUBLIC_PUSHER_KEY
      ? [
          envWarning(
            "NEXT_PUBLIC_PUSHER_KEY",
            "NEXT_PUBLIC_PUSHER_KEY does not match PUSHER_KEY: browsers will subscribe to a different Pusher app"
          ),
        ]
      : []),
    ...(env.PUSHER_CLUSTER !== env.NEXT_PUBLIC_PUSHER_CLUSTER
      ? [
          envWarning(
            "NEXT_PUBLIC_PUSHER_CLUSTER",
            "NEXT_PUBLIC_PUSHER_CLUSTER does not match PUSHER_CLUSTER: browsers will connect to a different Pusher cluster"
          ),
        ]
      : []),
  ];
}

function mapsIssues(env: NormalizedEnv): readonly EnvIssue[] {
  const hasServerKey = GOOGLE_MAPS_SERVER_ENV_VARIABLES.some((name) => Boolean(env[name]));
  return [
    ...(hasServerKey
      ? []
      : [
          envWarning(
            "GOOGLE_MAPS_SERVER_API_KEY",
            "GOOGLE_MAPS_SERVER_API_KEY (or the GOOGLE_MAPS_API_KEY alias) is not set: geocoding and the route assistant are disabled"
          ),
        ]),
    ...(env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      ? []
      : [
          envWarning(
            "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
            "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set: address autocomplete is disabled in the browser"
          ),
        ]),
  ];
}

function timeZoneIssues(env: NormalizedEnv): readonly EnvIssue[] {
  const server = env.BUSINESS_TIMEZONE;
  const client = env.NEXT_PUBLIC_BUSINESS_TIMEZONE;
  if (!server || !client || server === client) {
    return [];
  }
  return [
    envWarning(
      "BUSINESS_TIMEZONE",
      `NEXT_PUBLIC_BUSINESS_TIMEZONE (${client}) takes precedence over BUSINESS_TIMEZONE (${server}); set both to the same zone`
    ),
  ];
}

const CROSS_FIELD_RULES: readonly ((env: NormalizedEnv) => readonly EnvIssue[])[] = [
  storageIssues,
  authSecretIssues,
  emailIssues,
  cronIssues,
  publicIntegrationIssues,
  trustedProxyIssues,
  realtimeIssues,
  mapsIssues,
  timeZoneIssues,
];

export function validateEnv(source: EnvSource = process.env): EnvValidationResult {
  const env = normalizeSource(source);
  const issues = [
    ...schemaIssues(env),
    ...CROSS_FIELD_RULES.flatMap((rule) => rule(env)),
  ];
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const missingRequired = Array.from(new Set(errors.map((issue) => issue.name)));
  return {
    ok: missingRequired.length === 0,
    missingRequired,
    errors: errors.map((issue) => issue.message),
    warnings: warnings.map((issue) => issue.message),
  };
}

export function formatEnvErrors(result: EnvValidationResult): string {
  const header = `Invalid environment configuration (${result.errors.length} problem(s)). Fix these variables and restart; see .env.example for the full list:`;
  const lines = result.errors.map((message) => `  - ${message}`);
  return [header, ...lines].join("\n");
}

export class EnvValidationError extends Error {
  readonly result: EnvValidationResult;

  constructor(result: EnvValidationResult) {
    super(formatEnvErrors(result));
    this.name = "EnvValidationError";
    this.result = result;
  }
}

/** Throws `EnvValidationError` when a blocking variable is missing or invalid. */
export function assertEnv(source: EnvSource = process.env): EnvValidationResult {
  const result = validateEnv(source);
  if (!result.ok) {
    throw new EnvValidationError(result);
  }
  return result;
}
