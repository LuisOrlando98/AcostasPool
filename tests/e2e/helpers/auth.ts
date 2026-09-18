import { request, type APIRequestContext, type Page } from "@playwright/test";
import {
  LOGIN_ENDPOINT,
  LOGIN_PATH,
  ROLE_HOME,
  SEED_CREDENTIALS,
  type Credentials,
  type Role,
} from "./constants";

export type StorageState = Awaited<ReturnType<APIRequestContext["storageState"]>>;

type LoginResponseBody = {
  ok?: boolean;
  role?: string;
  error?: string;
};

/** Selectors of the /login form (src/app/login/page.tsx). */
export const LOGIN_FORM = {
  email: "#login-email",
  password: "#login-password",
  submit: "form button[type='submit']",
} as const;

/**
 * Signs in through POST /api/auth/login (src/app/api/auth/login/route.ts) and
 * returns the resulting storage state (ap_session + ap_locale cookies).
 * The API path is used instead of the UI because it is faster and does not
 * depend on client-side hydration.
 */
export async function loginViaApi(
  baseURL: string,
  role: Role
): Promise<StorageState> {
  const api = await request.newContext({ baseURL });
  try {
    const response = await api.post(LOGIN_ENDPOINT, {
      data: { ...SEED_CREDENTIALS[role], remember: true },
    });
    const body = (await response.json().catch(() => ({}))) as LoginResponseBody;
    if (!response.ok() || body.ok !== true) {
      throw new Error(
        `API login failed for ${role} (HTTP ${response.status()}): ${body.error ?? "unknown error"}`
      );
    }
    if (body.role !== role) {
      throw new Error(
        `API login for ${role} resolved to role ${String(body.role)}`
      );
    }
    return await api.storageState();
  } finally {
    await api.dispose();
  }
}

/**
 * Same API login as `loginViaApi` but with explicit credentials, for accounts
 * that the suite creates itself (developer account of tests/e2e/dev-view.spec.ts)
 * and therefore are not part of SEED_CREDENTIALS.
 */
export async function loginWithCredentials(
  baseURL: string,
  credentials: Credentials
): Promise<StorageState> {
  const api = await request.newContext({ baseURL });
  try {
    const response = await api.post(LOGIN_ENDPOINT, {
      data: { ...credentials, remember: true },
    });
    const body = (await response.json().catch(() => ({}))) as LoginResponseBody;
    if (!response.ok() || body.ok !== true) {
      throw new Error(
        `API login failed for ${credentials.email} (HTTP ${response.status()}): ${body.error ?? "unknown error"}`
      );
    }
    return await api.storageState();
  } finally {
    await api.dispose();
  }
}

export type AuthStateCache = {
  readonly get: (role: Role) => Promise<StorageState>;
};

/**
 * Memoizes one API login per role for the lifetime of a worker so the suite
 * reuses the storage state instead of hitting the login rate limit
 * (15 attempts/min per IP, 8 per 5 min per e-mail).
 */
export function createAuthStateCache(baseURL: string): AuthStateCache {
  const statesByRole = new Map<Role, Promise<StorageState>>();
  return {
    get(role) {
      const cached = statesByRole.get(role);
      if (cached) {
        return cached;
      }
      const created = loginViaApi(baseURL, role);
      statesByRole.set(role, created);
      return created;
    },
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Matches the role landing page, with or without a query string. */
export function homeUrlPattern(role: Role): RegExp {
  return new RegExp(`${escapeRegExp(ROLE_HOME[role])}(\\?.*)?$`);
}

export async function submitLoginForm(
  page: Page,
  credentials: Credentials
): Promise<void> {
  await page.goto(LOGIN_PATH);
  await page.locator(LOGIN_FORM.email).fill(credentials.email);
  await page.locator(LOGIN_FORM.password).fill(credentials.password);
  await page.locator(LOGIN_FORM.submit).click();
}

/** Signs in through the /login UI and waits for the role landing page. */
export async function loginViaUi(page: Page, role: Role): Promise<void> {
  await submitLoginForm(page, SEED_CREDENTIALS[role]);
  await page.waitForURL(homeUrlPattern(role));
}
