import type { APIRequestContext } from "@playwright/test";
import { expect, test } from "./helpers/fixtures";
import { expectNoNextError, expectPageHeading, gotoOk } from "./helpers/assertions";
import {
  HTTP_OK,
  ROLE_HOME,
  SEED_CREDENTIALS,
  SEED_CUSTOMER_NAME,
} from "./helpers/constants";
import { ACTIONS, FEEDBACK, HEADINGS, LABELS } from "./helpers/texts";

test.use({ role: "ADMIN" });

const ADMIN_PAGES: ReadonlyArray<{ path: string; heading: RegExp }> = [
  { path: ROLE_HOME.ADMIN, heading: HEADINGS.adminDashboard },
  { path: "/admin/customers", heading: HEADINGS.adminCustomers },
  { path: "/admin/customers/assignments", heading: HEADINGS.adminCustomers },
  { path: "/admin/routes", heading: HEADINGS.adminRoutes },
  { path: "/admin/routes/assistant", heading: HEADINGS.adminRouteAssistant },
  { path: "/admin/invoices", heading: HEADINGS.adminInvoices },
  { path: "/admin/technicians", heading: HEADINGS.adminTechnicians },
  { path: "/admin/reports", heading: HEADINGS.adminReports },
  { path: "/admin/notifications", heading: HEADINGS.adminNotifications },
  { path: "/admin/settings", heading: HEADINGS.adminSettings },
  { path: "/admin/help", heading: HEADINGS.adminHelp },
  { path: "/admin/agreement-service", heading: HEADINGS.adminAgreement },
  { path: "/account", heading: HEADINGS.account },
];

/** Customer rows are clickable <tr role="button"> (CustomersOverview.tsx). */
const CUSTOMER_ROW = 'tr[role="button"]';
const CUSTOMER_DETAIL_URL = /\/admin\/customers\/([a-z0-9]+)(\?.*)?$/i;
const CUSTOMER_CREATED_URL = /feedback=customer-created/;
const CUSTOMER_FORM_FIELDS = {
  firstName: 'input[name="nombre"]',
  lastName: 'input[name="apellidos"]',
} as const;
const INVOICE_CUSTOMER_SELECT = 'select[name="customerId"]';
const INVOICE_LINE = {
  description: "E2E smoke service",
  quantity: "1",
  unitPrice: "100",
} as const;
const CSV_CONTENT_TYPE = "text/csv";
const JOBS_CSV_HEADER = "Job ID";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE_LENGTH = "YYYY-MM-DD".length;
const SEED_DRAFT_INVOICE_ROW = new RegExp(
  `"${SEED_CUSTOMER_NAME}","DRAFT",`,
  "g"
);

function customersSearchUrl(query: string): string {
  return `/admin/customers?q=${encodeURIComponent(query)}`;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, ISO_DATE_LENGTH);
}

/** Invoice export covering yesterday..tomorrow so a just-created row is included. */
function invoicesExportUrl(): string {
  const now = Date.now();
  const params = new URLSearchParams({
    type: "invoices",
    from: toIsoDate(new Date(now - ONE_DAY_MS)),
    to: toIsoDate(new Date(now + ONE_DAY_MS)),
  });
  return `/api/reports/export?${params.toString()}`;
}

async function countSeedDraftInvoices(
  request: APIRequestContext
): Promise<number> {
  const response = await request.get(invoicesExportUrl());
  expect(response.status(), "invoice export status").toBe(HTTP_OK);
  const csv = await response.text();
  return (csv.match(SEED_DRAFT_INVOICE_ROW) ?? []).length;
}

test.describe("admin pages", () => {
  for (const { path, heading } of ADMIN_PAGES) {
    test(`renders ${path}`, async ({ page }) => {
      await gotoOk(page, path);
      await expectPageHeading(page, heading);
    });
  }
});

test.describe("seed customer", () => {
  test("opens the detail page from the customers list", async ({ page }) => {
    // The list filter matches nombre/apellidos/email with a single `contains`,
    // so the seed e-mail is the most selective query.
    await gotoOk(page, customersSearchUrl(SEED_CREDENTIALS.CUSTOMER.email));

    await page
      .locator(CUSTOMER_ROW, { hasText: SEED_CUSTOMER_NAME })
      .first()
      .click();
    await page.waitForURL(CUSTOMER_DETAIL_URL);

    const customerId = CUSTOMER_DETAIL_URL.exec(page.url())?.[1];
    expect(customerId, "customer id taken from the detail URL").toBeTruthy();
    await expectPageHeading(page, HEADINGS.adminCustomerDetail);
    await expectNoNextError(page);

    await gotoOk(page, `/admin/customers/${customerId}`);
    await expectPageHeading(page, HEADINGS.adminCustomerDetail);
  });
});

test.describe("admin write flows", () => {
  test("creates a customer from the UI and lists it", async ({ page }) => {
    const suffix = `${Date.now()}`;
    const firstName = "E2E";
    const lastName = `Smoke ${suffix}`;

    await gotoOk(page, "/admin/customers");
    await page.getByRole("button", { name: ACTIONS.newCustomer }).click();
    const form = page
      .locator("form")
      .filter({ has: page.locator(CUSTOMER_FORM_FIELDS.firstName) });
    await expect(form).toBeVisible();
    await form.locator(CUSTOMER_FORM_FIELDS.firstName).fill(firstName);
    await form.locator(CUSTOMER_FORM_FIELDS.lastName).fill(lastName);
    await form.getByRole("button", { name: ACTIONS.createCustomer }).click();

    await page.waitForURL(CUSTOMER_CREATED_URL);
    await expect(page.getByText(FEEDBACK.customerCreated)).toBeVisible();
    await expectNoNextError(page);

    await gotoOk(page, customersSearchUrl(suffix));
    await expect(
      page.locator(CUSTOMER_ROW, { hasText: `${firstName} ${lastName}` })
    ).toHaveCount(1);
  });

  test("creates a draft invoice for the seed customer", async ({
    page,
    request,
  }) => {
    const draftsBefore = await countSeedDraftInvoices(request);

    await gotoOk(page, "/admin/invoices");
    await page.getByRole("button", { name: ACTIONS.newInvoice }).click();
    // NewInvoiceModal renders a role="dialog" portal; the <form> inside has no
    // box of its own, so every check is scoped to the dialog.
    const dialog = page.getByRole("dialog");
    const customerSelect = dialog.locator(INVOICE_CUSTOMER_SELECT);
    await expect(customerSelect).toBeVisible();
    // Selecting the customer resets the line items, so it goes first.
    await customerSelect.selectOption({ label: SEED_CUSTOMER_NAME });
    await dialog
      .getByLabel(LABELS.description)
      .first()
      .fill(INVOICE_LINE.description);
    await dialog
      .getByLabel(LABELS.quantity)
      .first()
      .fill(INVOICE_LINE.quantity);
    await dialog
      .getByLabel(LABELS.unitPrice)
      .first()
      .fill(INVOICE_LINE.unitPrice);
    await dialog.getByRole("button", { name: ACTIONS.createInvoice }).click();

    // The modal unmounts through onCreated once the server action resolves.
    await expect(dialog).toHaveCount(0);
    await expect
      .poll(() => countSeedDraftInvoices(request), {
        message: "draft invoices for the seed customer in the CSV export",
      })
      .toBe(draftsBefore + 1);
    await expectNoNextError(page);
  });

  test("exports the jobs report as CSV", async ({ request }) => {
    const response = await request.get("/api/reports/export?type=jobs");

    expect(response.status()).toBe(HTTP_OK);
    expect(response.headers()["content-type"] ?? "").toContain(CSV_CONTENT_TYPE);
    const [headerLine] = (await response.text()).split("\n");
    expect(headerLine).toContain(JOBS_CSV_HEADER);
  });
});
