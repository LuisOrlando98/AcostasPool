/**
 * Fixtures compartidas por los tests de los endpoints del asistente de rutas.
 * Solo datos y helpers de petición: los `vi.mock` viven en cada test, porque el
 * registro de módulos de vitest es por archivo.
 */
import type { RouteAssistantJobRecord } from "@/lib/routing/job-source";

export const ADMIN_SESSION = { sub: "admin-1", role: "ADMIN" };
export const TECHNICIAN_SESSION = { sub: "tech-user-1", role: "TECHNICIAN" };

export const TECH_A = { id: "tech-a", name: "Ana" };
export const TECH_B = { id: "tech-b", name: "Bruno" };

export const PLAN_DATE = "2026-09-21";
export const ORIGIN_ADDRESS = "1 Yard Rd, Miami, FL 33196";
/** 2026-09-21 09:00 en la zona horaria del negocio (America/New_York). */
export const SCHEDULED_AT = new Date("2026-09-21T13:00:00.000Z");

export const ALLOWED_RATE_LIMIT = {
  allowed: true,
  remaining: 19,
  retryAfterSeconds: 300,
};
export const BLOCKED_RATE_LIMIT = {
  allowed: false,
  remaining: 0,
  retryAfterSeconds: 120,
};

export function technicianRow(technician: { id: string; name: string }) {
  return { id: technician.id, user: { fullName: technician.name } };
}

export function jobRecord(
  overrides: Partial<RouteAssistantJobRecord> & { id: string }
): RouteAssistantJobRecord {
  return {
    scheduledDate: SCHEDULED_AT,
    technicianId: null,
    estimatedDurationMinutes: null,
    sortOrder: null,
    status: "SCHEDULED",
    customer: { nombre: "Ana", apellidos: "García" },
    property: {
      id: `property-${overrides.id}`,
      name: null,
      address: `Address ${overrides.id}`,
      lat: null,
      lng: null,
      geocodedAt: null,
    },
    technician: null,
    plan: null,
    ...overrides,
  };
}

export function postRequest(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
