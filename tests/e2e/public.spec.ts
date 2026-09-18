import { expect, test } from "./helpers/fixtures";
import { expectJson, expectPageHeading, gotoOk } from "./helpers/assertions";
import { LOGIN_FORM } from "./helpers/auth";
import { HTTP_OK, HTTP_UNAUTHORIZED, LOGIN_PATH } from "./helpers/constants";
import { HEADINGS } from "./helpers/texts";

const LANDING_PAGES = ["/", "/about", "/contact"] as const;

test.describe("public pages", () => {
  for (const path of LANDING_PAGES) {
    test(`renders ${path} with a hero heading`, async ({ page }) => {
      await gotoOk(page, path);

      const hero = page.locator("h1").first();
      await expect(hero).toBeVisible();
      await expect(hero).toHaveText(/\S/);
    });
  }

  test("renders /legal with the policies index", async ({ page }) => {
    await gotoOk(page, "/legal");
    await expectPageHeading(page, HEADINGS.legalIndex);
  });

  test("renders /login with the sign-in form", async ({ page }) => {
    await gotoOk(page, LOGIN_PATH);

    await expectPageHeading(page, HEADINGS.loginHero);
    await expect(page.locator(LOGIN_FORM.email)).toBeVisible();
    await expect(page.locator(LOGIN_FORM.password)).toBeVisible();
    await expect(page.locator(LOGIN_FORM.submit)).toBeEnabled();
  });

  test("renders /offline fallback page", async ({ page }) => {
    await gotoOk(page, "/offline");
    await expectPageHeading(page, HEADINGS.offline);
  });
});

test.describe("health endpoints", () => {
  test("GET /api/health returns status ok", async ({ request }) => {
    const response = await request.get("/api/health");

    const body = (await expectJson(response, HTTP_OK)) as {
      status?: string;
      timestamp?: string;
    };
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
  });

  test("GET /api/health/db answers JSON and is restricted to developer sessions", async ({
    request,
  }) => {
    // Current behaviour (src/app/api/health/db/route.ts): the DB probe is only
    // available to ADMIN accounts flagged as developer; anonymous callers get a
    // JSON 401 instead of the { status: "ok", database: "reachable" } payload.
    const response = await request.get("/api/health/db");

    const body = await expectJson(response, HTTP_UNAUTHORIZED);
    expect(body).toEqual({ error: "Unauthorized" });
  });
});
