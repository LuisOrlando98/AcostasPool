export type Role = "ADMIN" | "TECH" | "CUSTOMER";

export type Credentials = {
  readonly email: string;
  readonly password: string;
};

const DEFAULT_SEED_CREDENTIALS: Readonly<Record<Role, Credentials>> = {
  ADMIN: { email: "admin@acostaspool.test", password: "Admin123!" },
  TECH: { email: "tech@acostaspool.test", password: "Tech123!" },
  CUSTOMER: { email: "cliente@acostaspool.test", password: "Client123!" },
};

/**
 * Seed credentials (scripts/seed.cjs). The SEED_* variables from .env override
 * the defaults so the suite follows a custom seed without code changes.
 */
export const SEED_CREDENTIALS: Readonly<Record<Role, Credentials>> = {
  ADMIN: {
    email: process.env.SEED_ADMIN_EMAIL ?? DEFAULT_SEED_CREDENTIALS.ADMIN.email,
    password:
      process.env.SEED_ADMIN_PASSWORD ?? DEFAULT_SEED_CREDENTIALS.ADMIN.password,
  },
  TECH: {
    email: process.env.SEED_TECH_EMAIL ?? DEFAULT_SEED_CREDENTIALS.TECH.email,
    password:
      process.env.SEED_TECH_PASSWORD ?? DEFAULT_SEED_CREDENTIALS.TECH.password,
  },
  CUSTOMER: {
    email:
      process.env.SEED_CUSTOMER_EMAIL ?? DEFAULT_SEED_CREDENTIALS.CUSTOMER.email,
    password:
      process.env.SEED_CUSTOMER_PASSWORD ??
      DEFAULT_SEED_CREDENTIALS.CUSTOMER.password,
  },
};

export const INVALID_CREDENTIALS: Credentials = {
  email: "nobody@acostaspool.test",
  password: "WrongPass123!",
};

/** Mirrors ROLE_REDIRECTS in src/lib/auth/config.ts. */
export const ROLE_HOME: Readonly<Record<Role, string>> = {
  ADMIN: "/admin",
  TECH: "/tech",
  CUSTOMER: "/client",
};

export const ALL_ROLES: readonly Role[] = ["ADMIN", "TECH", "CUSTOMER"];

/** Display name of the seeded customer ("Cliente" + "Demo"). */
export const SEED_CUSTOMER_NAME = "Cliente Demo";

export const DEFAULT_BASE_URL = "http://localhost:3000";

export const LOGIN_ENDPOINT = "/api/auth/login";
export const LOGIN_PATH = "/login";
export const UNAUTHORIZED_PATH = "/unauthorized";

export const HTTP_OK = 200;
export const HTTP_UNAUTHORIZED = 401;
