import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { loginWithCredentials, type StorageState } from "./helpers/auth";
import { expectPageHeading, gotoOk } from "./helpers/assertions";
import { DEFAULT_BASE_URL, ROLE_HOME } from "./helpers/constants";
import { HEADINGS } from "./helpers/texts";
import {
  DEVELOPER_CREDENTIALS,
  DEV_TEST_PROPERTY_ADDRESS,
  DEV_TEST_PROPERTY_NAME,
  cleanupDeveloperUser,
  ensureDeveloperUser,
  signLegacySessionToken,
  type DeveloperFixture,
} from "./helpers/developer";

/**
 * Vista de desarrollador: el conmutador de la cabecera cambia entre
 * administrador, técnico y cliente sin cerrar sesión ni usar credenciales
 * ajenas (la sesión sigue siendo la del desarrollador; solo cambia el rol).
 *
 * La cuenta se crea aquí porque el acceso depende de que el correo esté en
 * DEFAULT_DEVELOPER_EMAILS, no de la semilla.
 */

const SWITCHER = '[data-testid="dev-view-switcher"]';
const SEGMENTED = '[data-testid="dev-view-segmented"]';
const MENU_TRIGGER = '[data-testid="dev-view-menu-trigger"]';
const MENU = '[data-testid="dev-view-menu"]';
const AUTH_COOKIE_NAME = "ap_session";
const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;

type SwitchableRole = "ADMIN" | "TECH" | "CUSTOMER";

function segmentedOption(role: SwitchableRole) {
  return `${SEGMENTED} [data-role="${role}"]`;
}

function menuOption(role: SwitchableRole) {
  return `${MENU} [data-role="${role}"]`;
}

function homePattern(home: string): RegExp {
  return new RegExp(`${home}(\\?.*)?$`);
}

test.describe.configure({ mode: "serial" });

let fixture: DeveloperFixture;
let storageState: StorageState;
let baseURL: string;
let context: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser }, workerInfo) => {
  fixture = await ensureDeveloperUser();
  baseURL = workerInfo.project.use.baseURL ?? DEFAULT_BASE_URL;
  storageState = await loginWithCredentials(baseURL, DEVELOPER_CREDENTIALS);
  context = await browser.newContext({ baseURL, storageState, serviceWorkers: "block" });
  page = await context.newPage();
});

test.afterAll(async () => {
  await context?.close();
  if (fixture) {
    await cleanupDeveloperUser(fixture);
  }
});

/** Pulsa una vista en el control de la cabecera y espera la página resultante. */
async function switchTo(role: SwitchableRole, home: string): Promise<void> {
  await page.locator(segmentedOption(role)).click();
  await page.waitForURL(homePattern(home));
  await expect(page.locator(segmentedOption(role))).toHaveAttribute(
    "aria-checked",
    "true"
  );
}

test.describe("developer view switcher", () => {
  test("renders the header control on /admin with the administrator view marked", async () => {
    await gotoOk(page, ROLE_HOME.ADMIN);

    await expectPageHeading(page, HEADINGS.adminDashboard);
    await expect(page.locator(SWITCHER)).toBeVisible();
    await expect(page.locator(segmentedOption("ADMIN"))).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  test("switches to the technician view and keeps the control visible", async () => {
    await switchTo("TECH", ROLE_HOME.TECH);

    await expectPageHeading(page, HEADINGS.techHome);
    await expect(page.locator(SEGMENTED)).toBeVisible();
  });

  test("switches to the client view and shows the developer's test property", async () => {
    await switchTo("CUSTOMER", ROLE_HOME.CUSTOMER);

    await expectPageHeading(page, HEADINGS.clientHome);

    await gotoOk(page, "/client/properties");
    await expectPageHeading(page, HEADINGS.clientProperties);
    await expect(page.getByText(DEV_TEST_PROPERTY_NAME).first()).toBeVisible();
    await expect(page.getByText(DEV_TEST_PROPERTY_ADDRESS).first()).toBeVisible();
  });

  test("returns to the administrator view", async () => {
    await switchTo("ADMIN", ROLE_HOME.ADMIN);

    await expectPageHeading(page, HEADINGS.adminDashboard);
  });

  test("switches with a session token issued before the dev claim existed", async () => {
    const legacyToken = await signLegacySessionToken(fixture.userId);
    await context.clearCookies({ name: AUTH_COOKIE_NAME });
    await context.addCookies([
      { name: AUTH_COOKIE_NAME, value: legacyToken, url: baseURL, httpOnly: true },
    ]);

    await gotoOk(page, ROLE_HOME.ADMIN);
    await switchTo("TECH", ROLE_HOME.TECH);

    await expectPageHeading(page, HEADINGS.techHome);
  });
});

test.describe("developer view switcher on mobile", () => {
  let mobileContext: BrowserContext;
  let mobilePage: Page;

  test.beforeAll(async ({ browser }) => {
    mobileContext = await browser.newContext({
      baseURL,
      storageState,
      viewport: MOBILE_VIEWPORT,
      serviceWorkers: "block",
    });
    mobilePage = await mobileContext.newPage();
  });

  test.afterAll(async () => {
    await mobileContext?.close();
  });

  test("opens the icon menu and switches to the technician view", async () => {
    await gotoOk(mobilePage, ROLE_HOME.ADMIN);

    const trigger = mobilePage.locator(MENU_TRIGGER);
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    await expect(mobilePage.locator(SEGMENTED)).toBeHidden();

    await trigger.click();
    await expect(mobilePage.locator(MENU)).toBeVisible();
    await expect(mobilePage.locator(menuOption("ADMIN"))).toHaveAttribute(
      "aria-checked",
      "true"
    );

    await mobilePage.locator(menuOption("TECH")).click();
    await mobilePage.waitForURL(homePattern(ROLE_HOME.TECH));

    await expectPageHeading(mobilePage, HEADINGS.techHome);
    await expect(mobilePage.locator(MENU_TRIGGER)).toBeVisible();
  });
});
