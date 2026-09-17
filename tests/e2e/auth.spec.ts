import { expect, test } from "./helpers/fixtures";
import { expectNoNextError, expectPageHeading } from "./helpers/assertions";
import { homeUrlPattern, loginViaUi, submitLoginForm } from "./helpers/auth";
import {
  ALL_ROLES,
  HTTP_OK,
  INVALID_CREDENTIALS,
  LOGIN_PATH,
  ROLE_HOME,
  UNAUTHORIZED_PATH,
  type Role,
} from "./helpers/constants";
import { FEEDBACK, HEADINGS } from "./helpers/texts";

const ROLE_HEADINGS: Readonly<Record<Role, RegExp>> = {
  ADMIN: HEADINGS.adminDashboard,
  TECH: HEADINGS.techHome,
  CUSTOMER: HEADINGS.clientHome,
};

test.describe("login through the UI", () => {
  for (const role of ALL_ROLES) {
    test(`${role} lands on ${ROLE_HOME[role]} after signing in`, async ({
      page,
    }) => {
      await loginViaUi(page, role);

      await expect(page).toHaveURL(homeUrlPattern(role));
      await expectPageHeading(page, ROLE_HEADINGS[role]);
      await expectNoNextError(page);
    });
  }

  test("shows an error message with invalid credentials", async ({ page }) => {
    await submitLoginForm(page, INVALID_CREDENTIALS);

    await expect(page.getByText(FEEDBACK.loginError)).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(LOGIN_PATH);
    await expectNoNextError(page);
  });
});

test.describe("route protection", () => {
  for (const role of ALL_ROLES) {
    const path = ROLE_HOME[role];
    test(`redirects anonymous visitors from ${path} to /login`, async ({
      page,
    }) => {
      const response = await page.goto(path);

      expect(response?.status()).toBe(HTTP_OK);
      expect(new URL(page.url()).pathname).toBe(LOGIN_PATH);
      await expectNoNextError(page);
    });
  }

  test("keeps the requested path in ?next= when redirecting to /login", async ({
    page,
  }) => {
    // Route protection lives in src/proxy.ts (Next 16 proxy convention); the
    // former root-level middleware.ts was never bundled and dropped ?next=.
    await page.goto(ROLE_HOME.ADMIN);

    const url = new URL(page.url());
    expect(url.pathname).toBe(LOGIN_PATH);
    expect(url.searchParams.get("next")).toBe(ROLE_HOME.ADMIN);
  });

  test.describe("as TECH", () => {
    test.use({ role: "TECH" });

    test("sends a technician visiting /admin to /unauthorized", async ({
      page,
    }) => {
      const response = await page.goto(ROLE_HOME.ADMIN);

      expect(response?.status()).toBe(HTTP_OK);
      const url = new URL(page.url());
      expect(url.pathname).toBe(UNAUTHORIZED_PATH);
      expect(url.searchParams.get("next")).toBe(ROLE_HOME.TECH);
      await expectPageHeading(page, HEADINGS.unauthorized);
      await expectNoNextError(page);
    });
  });
});
