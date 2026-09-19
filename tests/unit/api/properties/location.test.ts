/**
 * Tests de PATCH /api/admin/properties/[id]/location: valida la entrada, limita
 * la frecuencia por usuario, geocodifica cuando solo llega la dirección, acepta
 * coordenadas manuales y deja rastro en AuditLog. prisma, la sesión, la
 * geocodificación, el rate limit y la auditoría se mockean.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }));
const auditMock = vi.hoisted(() => ({ logAuditEvent: vi.fn() }));
const geoMock = vi.hoisted(() => ({ geocodeAddresses: vi.fn() }));
const rateLimitMock = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const dbMock = vi.hoisted(() => ({
  propertyFindUnique: vi.fn(),
  propertyUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    property: {
      findUnique: dbMock.propertyFindUnique,
      update: dbMock.propertyUpdate,
    },
  },
}));
vi.mock("@/lib/auth/session", () => sessionMock);
vi.mock("@/lib/audit/log", () => auditMock);
vi.mock("@/lib/routing/geo", () => geoMock);
vi.mock("@/lib/security/rate-limit", () => rateLimitMock);

import { PATCH } from "@/app/api/admin/properties/[id]/location/route";

const ADMIN_SESSION = { sub: "admin-1", role: "ADMIN" };
const TECHNICIAN_SESSION = { sub: "tech-user-1", role: "TECHNICIAN" };
const PROPERTY_ID = "property-1";
const CURRENT_ADDRESS = "1 Old Rd, Miami, FL 33196";
const NEW_ADDRESS = "742 Evergreen Ter, Miami, FL 33196";
const POINT = { lat: 25.65, lng: -80.43 };
const MS_PER_MINUTE = 60_000;
const LOCATION_RATE_LIMIT = 30;
const LOCATION_WINDOW_MS = 5 * MS_PER_MINUTE;
const MAX_ADDRESS_LENGTH = 200;
const ALLOWED_RATE_LIMIT = { allowed: true, remaining: 29, retryAfterSeconds: 300 };
const BLOCKED_RATE_LIMIT = { allowed: false, remaining: 0, retryAfterSeconds: 120 };

const CURRENT_PROPERTY = {
  id: PROPERTY_ID,
  address: CURRENT_ADDRESS,
  lat: null,
  lng: null,
  geocodedAt: null,
};

type PropertyUpdateArgs = {
  data: {
    address?: string;
    lat: number | null;
    lng: number | null;
    geocodedAt: Date | null;
  };
};

function patchRequest(body: unknown) {
  return new Request(
    `http://localhost/api/admin/properties/${PROPERTY_ID}/location`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

function patchLocation(body: unknown, id = PROPERTY_ID) {
  return PATCH(patchRequest(body), { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionMock.getSession.mockResolvedValue(ADMIN_SESSION);
  rateLimitMock.checkRateLimit.mockResolvedValue(ALLOWED_RATE_LIMIT);
  geoMock.geocodeAddresses.mockResolvedValue(new Map([[NEW_ADDRESS, POINT]]));
  dbMock.propertyFindUnique.mockResolvedValue(CURRENT_PROPERTY);
  dbMock.propertyUpdate.mockImplementation(async ({ data }: PropertyUpdateArgs) => ({
    ...CURRENT_PROPERTY,
    ...data,
  }));
});

describe("PATCH location: autenticación y frecuencia", () => {
  it("responde 401 sin sesión de administrador", async () => {
    sessionMock.getSession.mockResolvedValue(TECHNICIAN_SESSION);

    const response = await patchLocation({ address: NEW_ADDRESS });

    expect(response.status).toBe(401);
    expect(dbMock.propertyFindUnique).not.toHaveBeenCalled();
  });

  it("responde 401 sin sesión", async () => {
    sessionMock.getSession.mockResolvedValue(null);

    expect((await patchLocation({ address: NEW_ADDRESS })).status).toBe(401);
  });

  it("responde 429 con RATE_LIMITED cuando se supera el límite por usuario", async () => {
    rateLimitMock.checkRateLimit.mockResolvedValue(BLOCKED_RATE_LIMIT);

    const response = await patchLocation({ address: NEW_ADDRESS });

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: "Too many requests",
      code: "RATE_LIMITED",
    });
    expect(rateLimitMock.checkRateLimit).toHaveBeenCalledWith({
      key: `property-location:${ADMIN_SESSION.sub}`,
      limit: LOCATION_RATE_LIMIT,
      windowMs: LOCATION_WINDOW_MS,
    });
    expect(dbMock.propertyUpdate).not.toHaveBeenCalled();
  });
});

describe("PATCH location: validación", () => {
  it("rechaza un cuerpo sin dirección ni coordenadas", async () => {
    const response = await patchLocation({});

    expect(response.status).toBe(400);
    expect(rateLimitMock.checkRateLimit).not.toHaveBeenCalled();
    expect(dbMock.propertyUpdate).not.toHaveBeenCalled();
  });

  it("rechaza media coordenada: lat sin lng y lng sin lat", async () => {
    expect((await patchLocation({ lat: POINT.lat })).status).toBe(400);
    expect((await patchLocation({ lng: POINT.lng })).status).toBe(400);
  });

  it("rechaza coordenadas fuera de rango", async () => {
    expect((await patchLocation({ lat: 91, lng: POINT.lng })).status).toBe(400);
    expect((await patchLocation({ lat: POINT.lat, lng: -181 })).status).toBe(400);
  });

  it("rechaza direcciones fuera de longitud y campos desconocidos", async () => {
    expect((await patchLocation({ address: "abc" })).status).toBe(400);
    expect(
      (await patchLocation({ address: "x".repeat(MAX_ADDRESS_LENGTH + 1) })).status
    ).toBe(400);
    expect(
      (await patchLocation({ address: NEW_ADDRESS, unknown: true })).status
    ).toBe(400);
  });
});

describe("PATCH location: propiedad inexistente", () => {
  it("responde 404 con PROPERTY_NOT_FOUND sin escribir ni auditar", async () => {
    dbMock.propertyFindUnique.mockResolvedValue(null);

    const response = await patchLocation({ address: NEW_ADDRESS });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Property not found",
      code: "PROPERTY_NOT_FOUND",
    });
    expect(dbMock.propertyUpdate).not.toHaveBeenCalled();
    expect(auditMock.logAuditEvent).not.toHaveBeenCalled();
  });
});

describe("PATCH location: dirección geocodificada", () => {
  it("guarda la dirección recortada con las coordenadas resueltas", async () => {
    const response = await patchLocation({ address: `  ${NEW_ADDRESS}  ` });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.geocoded).toBe(true);
    expect(body.property).toEqual({
      id: PROPERTY_ID,
      address: NEW_ADDRESS,
      lat: POINT.lat,
      lng: POINT.lng,
      geocodedAt: expect.any(String),
    });
    expect(geoMock.geocodeAddresses).toHaveBeenCalledWith([NEW_ADDRESS]);
    expect(dbMock.propertyUpdate).toHaveBeenCalledWith({
      where: { id: PROPERTY_ID },
      data: {
        address: NEW_ADDRESS,
        lat: POINT.lat,
        lng: POINT.lng,
        geocodedAt: expect.any(Date),
      },
      select: expect.anything(),
    });
  });

  it("guarda la dirección y responde geocoded false cuando no se resuelve", async () => {
    geoMock.geocodeAddresses.mockResolvedValue(new Map([[NEW_ADDRESS, null]]));

    const response = await patchLocation({ address: NEW_ADDRESS });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      geocoded: false,
      property: {
        id: PROPERTY_ID,
        address: NEW_ADDRESS,
        lat: null,
        lng: null,
        geocodedAt: null,
      },
    });
  });
});

describe("PATCH location: coordenadas manuales", () => {
  it("guarda lat y lng tal cual, con fecha, sin llamar al geocodificador", async () => {
    const response = await patchLocation({ lat: POINT.lat, lng: POINT.lng });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.geocoded).toBe(true);
    expect(body.property).toEqual({
      id: PROPERTY_ID,
      address: CURRENT_ADDRESS,
      lat: POINT.lat,
      lng: POINT.lng,
      geocodedAt: expect.any(String),
    });
    expect(geoMock.geocodeAddresses).not.toHaveBeenCalled();
    expect(dbMock.propertyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { lat: POINT.lat, lng: POINT.lng, geocodedAt: expect.any(Date) },
      })
    );
  });

  it("actualiza también la dirección cuando llega con las coordenadas", async () => {
    await patchLocation({ address: NEW_ADDRESS, lat: POINT.lat, lng: POINT.lng });

    expect(geoMock.geocodeAddresses).not.toHaveBeenCalled();
    expect(dbMock.propertyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          address: NEW_ADDRESS,
          lat: POINT.lat,
          lng: POINT.lng,
          geocodedAt: expect.any(Date),
        },
      })
    );
  });
});

describe("PATCH location: auditoría y fallos", () => {
  it("registra la acción con el antes y el después de dirección y coordenadas", async () => {
    await patchLocation({ address: NEW_ADDRESS });

    expect(auditMock.logAuditEvent).toHaveBeenCalledWith({
      userId: ADMIN_SESSION.sub,
      action: "PROPERTY_LOCATION_UPDATED",
      entity: "Property",
      entityId: PROPERTY_ID,
      metadata: {
        before: { address: CURRENT_ADDRESS, lat: null, lng: null },
        after: { address: NEW_ADDRESS, lat: POINT.lat, lng: POINT.lng },
      },
    });
  });

  it("responde 500 sin auditar cuando la escritura falla", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    dbMock.propertyUpdate.mockRejectedValue(new Error("db down"));

    const response = await patchLocation({ address: NEW_ADDRESS });

    expect(response.status).toBe(500);
    expect(auditMock.logAuditEvent).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "property location: update failed",
      expect.objectContaining({ propertyId: PROPERTY_ID })
    );
    consoleError.mockRestore();
  });
});
