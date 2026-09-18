import { expect, test } from "./helpers/fixtures";
import { expectJson } from "./helpers/assertions";
import { HTTP_OK, HTTP_UNAUTHORIZED, SEED_CREDENTIALS } from "./helpers/constants";

type MeResponse = {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    avatarUrl: string | null;
    isDeveloper: boolean;
  } | null;
};

type UnreadResponse = { unread: number };

test.describe("API with an ADMIN session", () => {
  test.use({ role: "ADMIN" });

  test("GET /api/auth/me returns the signed-in admin", async ({ request }) => {
    const response = await request.get("/api/auth/me");

    const body = (await expectJson(response, HTTP_OK)) as MeResponse;
    expect(body.user).not.toBeNull();
    expect(body.user?.email).toBe(SEED_CREDENTIALS.ADMIN.email);
    expect(body.user?.role).toBe("ADMIN");
    expect(typeof body.user?.id).toBe("string");
  });

  test("GET /api/notifications/unread returns a JSON counter", async ({
    request,
  }) => {
    const response = await request.get("/api/notifications/unread");

    const body = (await expectJson(response, HTTP_OK)) as UnreadResponse;
    expect(Number.isInteger(body.unread)).toBe(true);
    expect(body.unread).toBeGreaterThanOrEqual(0);
  });

  test("GET /api/health/db rejects a non-developer admin", async ({
    request,
  }) => {
    // The seeded admin is not flagged as developer, so the endpoint answers 401.
    const response = await request.get("/api/health/db");

    const body = await expectJson(response, HTTP_UNAUTHORIZED);
    expect(body).toEqual({ error: "Unauthorized" });
  });
});

test.describe("API without a session", () => {
  test("GET /api/auth/me answers 200 with user: null", async ({ request }) => {
    // Current behaviour (src/app/api/auth/me/route.ts): anonymous callers get
    // HTTP 200 and { user: null } instead of a 401. The layout components
    // (UserMenu, SidebarAccount, NotificationsBell) rely on this contract.
    const response = await request.get("/api/auth/me");

    const body = (await expectJson(response, HTTP_OK)) as MeResponse;
    expect(body).toEqual({ user: null });
    expect(response.status()).not.toBe(HTTP_UNAUTHORIZED);
  });

  test("GET /api/notifications/unread answers zero for anonymous callers", async ({
    request,
  }) => {
    const response = await request.get("/api/notifications/unread");

    const body = (await expectJson(response, HTTP_OK)) as UnreadResponse;
    expect(body).toEqual({ unread: 0 });
  });
});
