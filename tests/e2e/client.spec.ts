import { test } from "./helpers/fixtures";
import { expectPageHeading, gotoOk } from "./helpers/assertions";
import { ROLE_HOME } from "./helpers/constants";
import { HEADINGS } from "./helpers/texts";

test.use({ role: "CUSTOMER" });

const CLIENT_PAGES: ReadonlyArray<{ path: string; heading: RegExp }> = [
  { path: ROLE_HOME.CUSTOMER, heading: HEADINGS.clientHome },
  { path: "/client/invoices", heading: HEADINGS.clientInvoices },
  { path: "/client/properties", heading: HEADINGS.clientProperties },
  { path: "/client/profile", heading: HEADINGS.clientProfile },
  { path: "/client/request", heading: HEADINGS.clientRequest },
];

test.describe("client portal pages", () => {
  for (const { path, heading } of CLIENT_PAGES) {
    test(`renders ${path}`, async ({ page }) => {
      await gotoOk(page, path);
      await expectPageHeading(page, heading);
    });
  }

  test("renders the seed job detail", async ({ page, seedJobId }) => {
    await gotoOk(page, `/client/jobs/${seedJobId}`);
    await expectPageHeading(page, HEADINGS.jobDetail);
  });
});
