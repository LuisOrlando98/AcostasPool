import { expect, type APIResponse, type Page, type Response } from "@playwright/test";
import { HTTP_OK } from "./constants";

/** Next.js dev overlay custom element (never expected, even in dev). */
const NEXT_ERROR_OVERLAY = "nextjs-portal";
/** Heading rendered by Next.js default error page (404/500). */
const NEXT_ERROR_HEADING = "h1.next-error-h1";
/** Text of the production client-side error boundary. */
const APPLICATION_ERROR_TEXT = /Application error/i;
const JSON_CONTENT_TYPE = "application/json";

export async function expectNoNextError(page: Page): Promise<void> {
  await expect(page.locator(NEXT_ERROR_OVERLAY)).toHaveCount(0);
  await expect(page.locator(NEXT_ERROR_HEADING)).toHaveCount(0);
  await expect(page.getByText(APPLICATION_ERROR_TEXT)).toHaveCount(0);
}

/** Navigates to `path`, asserts a final HTTP 200 and no Next.js error UI. */
export async function gotoOk(page: Page, path: string): Promise<Response> {
  const response = await page.goto(path);
  if (!response) {
    throw new Error(`Navigation to ${path} produced no response`);
  }
  expect(response.status(), `HTTP status for ${path}`).toBe(HTTP_OK);
  await expectNoNextError(page);
  return response;
}

export async function expectPageHeading(page: Page, name: RegExp): Promise<void> {
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

/** Asserts status + JSON content type and returns the parsed body. */
export async function expectJson(
  response: APIResponse,
  status: number
): Promise<unknown> {
  expect(response.status(), `HTTP status for ${response.url()}`).toBe(status);
  expect(response.headers()["content-type"] ?? "").toContain(JSON_CONTENT_TYPE);
  return response.json();
}
