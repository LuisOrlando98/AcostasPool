import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { loginWithCredentials } from "./helpers/auth";
import { expectPageHeading, gotoOk } from "./helpers/assertions";
import { DEFAULT_BASE_URL, ROLE_HOME } from "./helpers/constants";
import { HEADINGS } from "./helpers/texts";
import {
  DEVELOPER_CREDENTIALS,
  ensureDeveloperUser,
  restoreDeveloperUser,
  type DeveloperFixture,
} from "./helpers/developer";

/**
 * Vista de desarrollador: el conmutador del sidebar cambia entre administrador,
 * técnico y cliente sin cerrar sesión, y la franja devuelve siempre a
 * administrador. La cuenta se crea aquí porque el acceso depende de que el
 * correo esté en DEFAULT_DEVELOPER_EMAILS, no de la semilla.
 */

const SWITCHER = '[data-testid="dev-view-switcher"]';
const BANNER = '[data-testid="dev-view-banner"]';
const APPLY_BUTTON = '[data-testid="dev-view-apply"]';
const BACK_BUTTON = '[data-testid="dev-view-back"]';
const TARGET_SELECT = `${SWITCHER} select`;

function roleButton(role: "ADMIN" | "TECH" | "CUSTOMER") {
  return `${SWITCHER} [data-role="${role}"]`;
}

test.describe.configure({ mode: "serial" });

let fixture: DeveloperFixture;
let context: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser }, workerInfo) => {
  fixture = await ensureDeveloperUser();
  const baseURL = workerInfo.project.use.baseURL ?? DEFAULT_BASE_URL;
  const storageState = await loginWithCredentials(baseURL, DEVELOPER_CREDENTIALS);
  context = await browser.newContext({ baseURL, storageState, serviceWorkers: "block" });
  page = await context.newPage();
});

test.afterAll(async () => {
  await context?.close();
  if (fixture) {
    await restoreDeveloperUser(fixture);
  }
});

/** Elige rol + objetivo en el conmutador y espera la vista resultante. */
async function switchTo(
  role: "TECH" | "CUSTOMER",
  targetUserId: string,
  home: string
): Promise<void> {
  await page.locator(roleButton(role)).click();
  await expect(page.locator(roleButton(role))).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(TARGET_SELECT)).toBeEnabled();
  await page.locator(TARGET_SELECT).selectOption(targetUserId);
  await page.locator(APPLY_BUTTON).click();
  await page.waitForURL(new RegExp(`${home}(\\?.*)?$`));
}

test.describe("developer view switcher", () => {
  test("renders /admin with the switcher and no active view", async () => {
    await gotoOk(page, ROLE_HOME.ADMIN);

    await expectPageHeading(page, HEADINGS.adminDashboard);
    await expect(page.locator(SWITCHER)).toBeVisible();
    await expect(page.locator(BANNER)).toHaveCount(0);
  });

  test("switches to the technician view and keeps the switcher visible", async () => {
    await switchTo("TECH", fixture.technicianUserId, ROLE_HOME.TECH);

    await expectPageHeading(page, HEADINGS.techHome);
    await expect(page.locator(BANNER)).toBeVisible();
    await expect(page.locator(SWITCHER)).toBeVisible();
  });

  test("returns to the administrator view from the banner", async () => {
    await page.locator(BACK_BUTTON).click();
    await page.waitForURL(new RegExp(`${ROLE_HOME.ADMIN}(\\?.*)?$`));

    await expectPageHeading(page, HEADINGS.adminDashboard);
    await expect(page.locator(BANNER)).toHaveCount(0);
  });

  test("switches to the client view", async () => {
    await switchTo("CUSTOMER", fixture.customerUserId, ROLE_HOME.CUSTOMER);

    await expectPageHeading(page, HEADINGS.clientHome);
    await expect(page.locator(BANNER)).toBeVisible();
  });

  test("returns to the administrator view from the client view", async () => {
    await page.locator(BACK_BUTTON).click();
    await page.waitForURL(new RegExp(`${ROLE_HOME.ADMIN}(\\?.*)?$`));

    await expectPageHeading(page, HEADINGS.adminDashboard);
    await expect(page.locator(BANNER)).toHaveCount(0);
  });
});
