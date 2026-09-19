/**
 * Tests de GET/POST /api/admin/routes/assistant/settings: el POST acepta un
 * cambio parcial, guarda la configuración completa y deja rastro en AuditLog.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_SESSION, ORIGIN_ADDRESS, postRequest, TECHNICIAN_SESSION } from "./fixtures";

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }));
const auditMock = vi.hoisted(() => ({ logAuditEvent: vi.fn() }));
const settingsMock = vi.hoisted(() => ({
  getRouteAssistantConfig: vi.fn(),
  saveRouteAssistantConfig: vi.fn(),
  ROUTE_ORIGIN_ADDRESS_MIN_LENGTH: 5,
  ROUTE_ORIGIN_ADDRESS_MAX_LENGTH: 160,
}));

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/auth/session", () => sessionMock);
vi.mock("@/lib/audit/log", () => auditMock);
vi.mock("@/lib/site-settings", () => settingsMock);

import { GET, POST } from "@/app/api/admin/routes/assistant/settings/route";

const SETTINGS_PATH = "/api/admin/routes/assistant/settings";
const NEW_ORIGIN = "2 Depot Ave, Miami, FL 33196";
const CURRENT_CONFIG = {
  dailyAutoOptimizeEnabled: false,
  originAddress: ORIGIN_ADDRESS,
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionMock.getSession.mockResolvedValue(ADMIN_SESSION);
  settingsMock.getRouteAssistantConfig.mockResolvedValue(CURRENT_CONFIG);
  settingsMock.saveRouteAssistantConfig.mockResolvedValue(undefined);
});

describe("settings: autenticación", () => {
  it("responde 401 sin sesión de administrador", async () => {
    sessionMock.getSession.mockResolvedValue(TECHNICIAN_SESSION);

    expect((await GET()).status).toBe(401);
    expect((await POST(postRequest(SETTINGS_PATH, {}))).status).toBe(401);
  });

  it("GET devuelve la configuración con el origen", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(CURRENT_CONFIG);
  });
});

describe("POST settings: validación", () => {
  it("rechaza un origen demasiado corto o campos desconocidos", async () => {
    expect((await POST(postRequest(SETTINGS_PATH, { originAddress: "abc" }))).status).toBe(400);
    expect((await POST(postRequest(SETTINGS_PATH, { unknown: true }))).status).toBe(400);
    expect(settingsMock.saveRouteAssistantConfig).not.toHaveBeenCalled();
  });

  it("rechaza un origen más largo que el máximo", async () => {
    const response = await POST(
      postRequest(SETTINGS_PATH, { originAddress: "x".repeat(161) })
    );

    expect(response.status).toBe(400);
  });
});

describe("POST settings: guardado y auditoría", () => {
  it("guarda el origen recortado y registra la auditoría", async () => {
    const response = await POST(
      postRequest(SETTINGS_PATH, { originAddress: `  ${NEW_ORIGIN}  ` })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      config: { dailyAutoOptimizeEnabled: false, originAddress: NEW_ORIGIN },
    });
    expect(settingsMock.saveRouteAssistantConfig).toHaveBeenCalledWith({
      dailyAutoOptimizeEnabled: false,
      originAddress: NEW_ORIGIN,
    });
    expect(auditMock.logAuditEvent).toHaveBeenCalledWith({
      userId: ADMIN_SESSION.sub,
      action: "ROUTE_ASSISTANT_SETTINGS",
      entity: "SiteSettings",
      metadata: { dailyAutoOptimizeEnabled: false, originAddress: NEW_ORIGIN },
    });
  });

  it("un cambio parcial conserva el resto de la configuración", async () => {
    await POST(postRequest(SETTINGS_PATH, { dailyAutoOptimizeEnabled: true }));

    expect(settingsMock.saveRouteAssistantConfig).toHaveBeenCalledWith({
      dailyAutoOptimizeEnabled: true,
      originAddress: ORIGIN_ADDRESS,
    });
  });

  it("responde 500 sin auditar cuando el guardado falla", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    settingsMock.saveRouteAssistantConfig.mockRejectedValue(new Error("db down"));

    const response = await POST(
      postRequest(SETTINGS_PATH, { dailyAutoOptimizeEnabled: true })
    );

    expect(response.status).toBe(500);
    expect(auditMock.logAuditEvent).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "route-assistant settings: save failed",
      expect.objectContaining({ userId: ADMIN_SESSION.sub })
    );
    consoleError.mockRestore();
  });
});
