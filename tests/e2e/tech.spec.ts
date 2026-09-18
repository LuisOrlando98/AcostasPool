import { expect, test } from "./helpers/fixtures";
import { expectPageHeading, gotoOk } from "./helpers/assertions";
import { ROLE_HOME, SEED_CUSTOMER_NAME } from "./helpers/constants";
import { HEADINGS } from "./helpers/texts";

test.use({ role: "TECH" });

const ACCOUNT_PATH = "/account";

test.describe("technician pages", () => {
  test("renders /tech with the route heading", async ({ page }) => {
    await gotoOk(page, ROLE_HOME.TECH);
    await expectPageHeading(page, HEADINGS.techHome);
  });

  test("renders /tech/history", async ({ page }) => {
    await gotoOk(page, "/tech/history");
    await expectPageHeading(page, HEADINGS.techHistory);
  });

  test("renders /tech/calendar with the seed job on today", async ({
    page,
    seedJobId,
  }) => {
    // The fixture keeps the seed job scheduled today, so the calendar opens on
    // today and lists it with a link to its detail.
    await gotoOk(page, "/tech/calendar");
    await expectPageHeading(page, HEADINGS.techCalendar);

    const today = page.locator('table a[aria-current="date"]');
    await expect(today).toHaveCount(1);
    await expect(page.locator(`a[href="/tech/jobs/${seedJobId}"]`).first()).toBeVisible();
  });

  test("renders next month from the calendar navigation", async ({ page }) => {
    await gotoOk(page, "/tech/calendar");
    await page.locator('nav a[href*="month="]').last().click();
    await page.waitForURL(/\/tech\/calendar\?month=\d{4}-\d{2}/);

    await expectPageHeading(page, HEADINGS.techCalendar);
    await expect(page.locator('table a[aria-current="date"]')).toHaveCount(1);
  });

  test("redirects /tech/profile to the shared account page", async ({
    page,
  }) => {
    // src/app/tech/profile/page.tsx redirects to /account.
    await gotoOk(page, "/tech/profile");

    expect(new URL(page.url()).pathname).toBe(ACCOUNT_PATH);
    await expectPageHeading(page, HEADINGS.account);
  });

  test("opens the seed job detail from the route", async ({
    page,
    seedJobId,
  }) => {
    await gotoOk(page, ROLE_HOME.TECH);

    const href = `/tech/jobs/${seedJobId}`;
    const jobLink = page.locator(`a[href="${href}"]`).first();
    await expect(jobLink).toHaveAttribute("href", href);

    await gotoOk(page, href);
    await expectPageHeading(page, HEADINGS.techJobDetail);
    await expect(page.getByText(SEED_CUSTOMER_NAME).first()).toBeVisible();
  });
});
