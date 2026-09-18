import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/internal/routes/assistant/auto-optimize/route";

const siteSettingsMock = vi.hoisted(() => ({
  getRouteAssistantConfig: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/site-settings", () => siteSettingsMock);

const OPTIMIZE_URL =
  "http://localhost/api/internal/routes/assistant/auto-optimize";
const CRON_SECRET = "cron-secret-value";
/** Same length as the real secret: only a constant-time compare rejects it. */
const WRONG_SECRET_SAME_LENGTH = "cron-secret-valuf";
const SHORTER_SECRET = "cron";
const LONGER_SECRET = `${CRON_SECRET}-extra`;
const OK_STATUS = 200;
const UNAUTHORIZED_STATUS = 401;

function optimizeRequest(headers: Record<string, string> = {}) {
  return new Request(OPTIMIZE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({}),
  });
}

describe("POST auto-optimize authentication", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = CRON_SECRET;
    siteSettingsMock.getRouteAssistantConfig
      .mockReset()
      .mockResolvedValue({ dailyAutoOptimizeEnabled: false });
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET;
      return;
    }
    process.env.CRON_SECRET = originalSecret;
  });

  it("accepts the configured secret", async () => {
    const response = await POST(
      optimizeRequest({ "x-cron-secret": ` ${CRON_SECRET} ` })
    );

    expect(response.status).toBe(OK_STATUS);
    expect(siteSettingsMock.getRouteAssistantConfig).toHaveBeenCalledTimes(1);
  });

  it("rejects a wrong secret of the same length", async () => {
    const response = await POST(
      optimizeRequest({ "x-cron-secret": WRONG_SECRET_SAME_LENGTH })
    );

    expect(WRONG_SECRET_SAME_LENGTH).toHaveLength(CRON_SECRET.length);
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
    expect(siteSettingsMock.getRouteAssistantConfig).not.toHaveBeenCalled();
  });

  it("rejects secrets that differ in length, in both directions", async () => {
    const shorter = await POST(
      optimizeRequest({ "x-cron-secret": SHORTER_SECRET })
    );
    const longer = await POST(optimizeRequest({ "x-cron-secret": LONGER_SECRET }));

    expect(shorter.status).toBe(UNAUTHORIZED_STATUS);
    expect(longer.status).toBe(UNAUTHORIZED_STATUS);
  });

  it("rejects a request without the header", async () => {
    const response = await POST(optimizeRequest());

    expect(response.status).toBe(UNAUTHORIZED_STATUS);
  });

  it("rejects every request while CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;

    const response = await POST(
      optimizeRequest({ "x-cron-secret": CRON_SECRET })
    );

    expect(response.status).toBe(UNAUTHORIZED_STATUS);
  });
});
