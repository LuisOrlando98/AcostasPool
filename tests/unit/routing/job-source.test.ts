/**
 * Tests de src/lib/routing/job-source.ts.
 * prisma (@/lib/db) y geocodeProperties (@/lib/routing/geo) se mockean: aquí se
 * verifica la consulta, el filtrado previo a la geocodificación, la resolución
 * de técnicos y el mapeo a RouteAssistantJob; la geocodificación en sí se cubre
 * en geo.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GeoPoint } from "@/lib/routing/geo";
import type { RouteAssistantTechnician } from "@/lib/routing/planner";
import {
  buildRecurringRouteGroupId,
  buildRecurringRouteGroupLabel,
  CUSTOM_SERVICE_PLAN_NAME,
  GLOBAL_RECURRING_PLAN_OPTIONS,
} from "@/lib/jobs/recurring-plan-templates";

const dbMock = vi.hoisted(() => ({
  jobFindMany: vi.fn(),
  technicianFindMany: vi.fn(),
}));

const geoMock = vi.hoisted(() => ({
  geocodeProperties: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    job: { findMany: dbMock.jobFindMany },
    technician: { findMany: dbMock.technicianFindMany },
  },
}));

vi.mock("@/lib/routing/geo", () => ({
  geocodeProperties: geoMock.geocodeProperties,
}));

import {
  findRouteAssistantTechnicians,
  getEffectiveTechnicianId,
  getRouteAssistantTechnicianIds,
  loadRouteAssistantJobs,
  loadRouteAssistantJobsByIds,
  ROUTE_ASSISTANT_JOB_STATUSES,
  routeAssistantJobSelect,
  toAssistantJobStatus,
  type RouteAssistantJobRecord,
} from "@/lib/routing/job-source";

const GLOBAL_PLAN_NAME = GLOBAL_RECURRING_PLAN_OPTIONS[0].name;
const TECH_A: RouteAssistantTechnician = { id: "tech-a", name: "Ana" };
const TECH_B: RouteAssistantTechnician = { id: "tech-b", name: "Bruno" };
const MIAMI_POINT: GeoPoint = { lat: 25.65, lng: -80.43 };
const SCHEDULED_DATE = new Date("2026-09-21T13:00:00.000Z");
const SERVICE_MINUTES = 45;
const ACTIVE_TECHNICIAN_SELECT = {
  id: true,
  user: { select: { fullName: true } },
};

function record(
  overrides: Partial<RouteAssistantJobRecord> & { id: string }
): RouteAssistantJobRecord {
  return {
    scheduledDate: SCHEDULED_DATE,
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

function technicianRow(technician: RouteAssistantTechnician) {
  return { id: technician.id, user: { fullName: technician.name } };
}

beforeEach(() => {
  dbMock.jobFindMany.mockReset();
  dbMock.technicianFindMany.mockReset();
  geoMock.geocodeProperties.mockReset();
  dbMock.jobFindMany.mockResolvedValue([]);
  dbMock.technicianFindMany.mockResolvedValue([]);
  geoMock.geocodeProperties.mockResolvedValue(new Map());
});

describe("constantes y helpers puros", () => {
  it("considera los estados SCHEDULED, PENDING, ON_THE_WAY e IN_PROGRESS", () => {
    expect(ROUTE_ASSISTANT_JOB_STATUSES).toEqual([
      "SCHEDULED",
      "PENDING",
      "ON_THE_WAY",
      "IN_PROGRESS",
    ]);
  });

  it("el select de la propiedad incluye el nombre y las coordenadas persistidas", () => {
    expect(routeAssistantJobSelect.property.select).toEqual({
      id: true,
      name: true,
      address: true,
      lat: true,
      lng: true,
      geocodedAt: true,
    });
  });

  it("el select incluye el estado, el orden actual y el nombre del técnico asignado", () => {
    expect(routeAssistantJobSelect.status).toBe(true);
    expect(routeAssistantJobSelect.sortOrder).toBe(true);
    expect(routeAssistantJobSelect.technician.select).toEqual({
      id: true,
      user: { select: { fullName: true } },
    });
  });

  it("toAssistantJobStatus conserva los estados del asistente y degrada el resto", () => {
    expect(toAssistantJobStatus("ON_THE_WAY")).toBe("ON_THE_WAY");
    expect(toAssistantJobStatus("IN_PROGRESS")).toBe("IN_PROGRESS");
    expect(toAssistantJobStatus("COMPLETED")).toBe("SCHEDULED");
  });

  it("getEffectiveTechnicianId prefiere el técnico del plan sobre el asignado", () => {
    const withPlan = record({
      id: "r1",
      technicianId: TECH_A.id,
      plan: { id: "plan-1", name: GLOBAL_PLAN_NAME, technicianId: TECH_B.id },
    });
    const withoutPlanTechnician = record({
      id: "r2",
      technicianId: TECH_A.id,
      plan: { id: "plan-2", name: GLOBAL_PLAN_NAME, technicianId: null },
    });

    expect(getEffectiveTechnicianId(withPlan)).toBe(TECH_B.id);
    expect(getEffectiveTechnicianId(withoutPlanTechnician)).toBe(TECH_A.id);
    expect(getEffectiveTechnicianId(record({ id: "r3" }))).toBeNull();
  });

  it("getRouteAssistantTechnicianIds deduplica, descarta nulos y conserva el orden", () => {
    const records = [
      record({ id: "r1", plan: { id: "plan-1", name: GLOBAL_PLAN_NAME, technicianId: TECH_B.id } }),
      record({ id: "r2", technicianId: TECH_A.id }),
      record({ id: "r3" }),
      record({ id: "r4", technicianId: TECH_B.id }),
    ];

    expect(getRouteAssistantTechnicianIds(records)).toEqual([TECH_B.id, TECH_A.id]);
  });
});

describe("findRouteAssistantTechnicians", () => {
  it("devuelve [] sin consultar cuando la lista de ids está vacía", async () => {
    const result = await findRouteAssistantTechnicians([]);

    expect(result).toEqual([]);
    expect(dbMock.technicianFindMany).not.toHaveBeenCalled();
  });

  it("limita la consulta a los ids indicados y solo a usuarios activos", async () => {
    dbMock.technicianFindMany.mockResolvedValue([technicianRow(TECH_A)]);

    const result = await findRouteAssistantTechnicians([TECH_A.id, TECH_B.id]);

    expect(dbMock.technicianFindMany).toHaveBeenCalledWith({
      where: { user: { isActive: true }, id: { in: [TECH_A.id, TECH_B.id] } },
      orderBy: { user: { fullName: "asc" } },
      select: ACTIVE_TECHNICIAN_SELECT,
    });
    expect(result).toEqual([TECH_A]);
  });

  it("con null devuelve todos los técnicos activos", async () => {
    dbMock.technicianFindMany.mockResolvedValue([technicianRow(TECH_A), technicianRow(TECH_B)]);

    const result = await findRouteAssistantTechnicians(null);

    expect(dbMock.technicianFindMany).toHaveBeenCalledWith({
      where: { user: { isActive: true } },
      orderBy: { user: { fullName: "asc" } },
      select: ACTIVE_TECHNICIAN_SELECT,
    });
    expect(result).toEqual([TECH_A, TECH_B]);
  });
});

describe("loadRouteAssistantJobs: consulta y cortocircuitos", () => {
  it("consulta los trabajos con el where indicado, el select compartido y el orden por fecha y sortOrder", async () => {
    const where = { status: { in: [...ROUTE_ASSISTANT_JOB_STATUSES] } };

    await loadRouteAssistantJobs({ where, technicians: [TECH_A] });

    expect(dbMock.jobFindMany).toHaveBeenCalledWith({
      where,
      orderBy: [{ scheduledDate: "asc" }, { sortOrder: "asc" }],
      select: routeAssistantJobSelect,
    });
  });

  it("devuelve jobs vacío sin geocodificar cuando no hay registros", async () => {
    const result = await loadRouteAssistantJobs({ where: {}, technicians: [TECH_A] });

    expect(result).toEqual({ records: [], technicians: [TECH_A], jobs: [] });
    expect(geoMock.geocodeProperties).not.toHaveBeenCalled();
  });

  it("devuelve jobs vacío sin geocodificar cuando no hay técnicos", async () => {
    const loaded = record({ id: "r1", technicianId: TECH_A.id });
    dbMock.jobFindMany.mockResolvedValue([loaded]);

    const result = await loadRouteAssistantJobs({ where: {}, technicians: [] });

    expect(result).toEqual({ records: [loaded], technicians: [], jobs: [] });
    expect(geoMock.geocodeProperties).not.toHaveBeenCalled();
    expect(dbMock.technicianFindMany).not.toHaveBeenCalled();
  });

  it("aplica el filtro antes de geocodificar y solo geocodifica las propiedades filtradas", async () => {
    const kept = record({ id: "kept" });
    const dropped = record({ id: "dropped" });
    dbMock.jobFindMany.mockResolvedValue([dropped, kept]);

    const result = await loadRouteAssistantJobs({
      where: {},
      technicians: [TECH_A],
      filter: (candidate) => candidate.id === "kept",
    });

    expect(geoMock.geocodeProperties).toHaveBeenCalledTimes(1);
    expect(geoMock.geocodeProperties).toHaveBeenCalledWith([kept.property]);
    expect(result.records).toEqual([kept]);
    expect(result.jobs.map((job) => job.id)).toEqual(["kept"]);
  });

  it("resuelve los técnicos activos referenciados por los trabajos cuando no se indican", async () => {
    dbMock.jobFindMany.mockResolvedValue([
      record({ id: "r1", plan: { id: "plan-1", name: GLOBAL_PLAN_NAME, technicianId: TECH_B.id } }),
      record({ id: "r2", technicianId: TECH_A.id }),
      record({ id: "r3" }),
    ]);
    dbMock.technicianFindMany.mockResolvedValue([technicianRow(TECH_A)]);

    const result = await loadRouteAssistantJobs({ where: {} });

    expect(dbMock.technicianFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user: { isActive: true }, id: { in: [TECH_B.id, TECH_A.id] } },
      })
    );
    expect(result.technicians).toEqual([TECH_A]);
    expect(result.jobs).toHaveLength(3);
  });

  it("sin técnicos indicados ni referenciados no consulta técnicos ni geocodifica", async () => {
    dbMock.jobFindMany.mockResolvedValue([record({ id: "r1" })]);

    const result = await loadRouteAssistantJobs({ where: {} });

    expect(dbMock.technicianFindMany).not.toHaveBeenCalled();
    expect(geoMock.geocodeProperties).not.toHaveBeenCalled();
    expect(result.technicians).toEqual([]);
    expect(result.jobs).toEqual([]);
  });
});

describe("loadRouteAssistantJobs: mapeo a RouteAssistantJob", () => {
  it("mapea un trabajo de plan global con técnico bloqueado, grupo y coordenadas por id de propiedad", async () => {
    const loaded = record({
      id: "r1",
      technicianId: TECH_A.id,
      estimatedDurationMinutes: SERVICE_MINUTES,
      plan: { id: "plan-1", name: GLOBAL_PLAN_NAME, technicianId: TECH_B.id },
    });
    dbMock.jobFindMany.mockResolvedValue([loaded]);
    geoMock.geocodeProperties.mockResolvedValue(new Map([[loaded.property.id, MIAMI_POINT]]));

    const { jobs } = await loadRouteAssistantJobs({ where: {}, technicians: [TECH_A, TECH_B] });

    expect(jobs).toEqual([
      {
        id: "r1",
        customerName: "Ana García",
        address: loaded.property.address,
        propertyName: null,
        status: "SCHEDULED",
        technicianId: TECH_A.id,
        currentTechnicianId: TECH_A.id,
        currentTechnicianName: null,
        currentSortOrder: null,
        planName: GLOBAL_PLAN_NAME,
        routeGroupId: buildRecurringRouteGroupId({
          planName: GLOBAL_PLAN_NAME,
          technicianId: TECH_B.id,
        }),
        routeGroupLabel: buildRecurringRouteGroupLabel({
          planName: GLOBAL_PLAN_NAME,
          technicianName: TECH_B.name,
        }),
        lockedTechnicianId: TECH_B.id,
        scheduledDate: SCHEDULED_DATE,
        estimatedDurationMinutes: SERVICE_MINUTES,
        coordinates: MIAMI_POINT,
      },
    ]);
  });

  it("un plan no global agrupa por el técnico asignado pero no bloquea la asignación", async () => {
    const loaded = record({
      id: "r1",
      technicianId: TECH_A.id,
      plan: { id: "plan-1", name: CUSTOM_SERVICE_PLAN_NAME, technicianId: null },
    });
    dbMock.jobFindMany.mockResolvedValue([loaded]);

    const { jobs } = await loadRouteAssistantJobs({ where: {}, technicians: [TECH_A] });

    expect(jobs[0]).toMatchObject({
      planName: CUSTOM_SERVICE_PLAN_NAME,
      routeGroupId: buildRecurringRouteGroupId({
        planName: CUSTOM_SERVICE_PLAN_NAME,
        technicianId: TECH_A.id,
      }),
      routeGroupLabel: buildRecurringRouteGroupLabel({
        planName: CUSTOM_SERVICE_PLAN_NAME,
        technicianName: TECH_A.name,
      }),
      lockedTechnicianId: null,
    });
  });

  it("sin plan deja planName, grupo y bloqueo a null, y coordinates null si no se resolvió", async () => {
    dbMock.jobFindMany.mockResolvedValue([record({ id: "r1", technicianId: TECH_A.id })]);

    const { jobs } = await loadRouteAssistantJobs({ where: {}, technicians: [TECH_A] });

    expect(jobs[0]).toMatchObject({
      planName: null,
      routeGroupId: null,
      routeGroupLabel: null,
      lockedTechnicianId: null,
      coordinates: null,
    });
  });

  it("etiqueta como Unassigned cuando el técnico del plan no está entre los técnicos recibidos", async () => {
    dbMock.jobFindMany.mockResolvedValue([
      record({
        id: "r1",
        plan: { id: "plan-1", name: GLOBAL_PLAN_NAME, technicianId: TECH_B.id },
      }),
    ]);

    const { jobs } = await loadRouteAssistantJobs({ where: {}, technicians: [TECH_A] });

    expect(jobs[0].routeGroupLabel).toBe(
      buildRecurringRouteGroupLabel({ planName: GLOBAL_PLAN_NAME, technicianName: null })
    );
    expect(jobs[0].lockedTechnicianId).toBe(TECH_B.id);
  });
});

describe("loadRouteAssistantJobs: campos nuevos y tope de filas", () => {
  it("propaga el nombre de la propiedad, el estado y el estado actual en base de datos", async () => {
    dbMock.jobFindMany.mockResolvedValue([
      record({
        id: "r1",
        status: "ON_THE_WAY",
        sortOrder: 545,
        technicianId: TECH_A.id,
        technician: { id: TECH_A.id, user: { fullName: TECH_A.name } },
        property: {
          id: "property-r1",
          name: "Casa del lago",
          address: "Address r1",
          lat: null,
          lng: null,
          geocodedAt: null,
        },
      }),
    ]);

    const { jobs } = await loadRouteAssistantJobs({ where: {}, technicians: [TECH_A] });

    expect(jobs[0]).toMatchObject({
      propertyName: "Casa del lago",
      status: "ON_THE_WAY",
      currentTechnicianId: TECH_A.id,
      currentTechnicianName: TECH_A.name,
      currentSortOrder: 545,
    });
  });

  it("pasa el tope de filas a la consulta solo cuando se indica", async () => {
    await loadRouteAssistantJobs({ where: {}, technicians: [TECH_A], take: 25 });

    expect(dbMock.jobFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 25 }));

    dbMock.jobFindMany.mockClear();
    await loadRouteAssistantJobs({ where: {}, technicians: [TECH_A] });

    expect(dbMock.jobFindMany.mock.calls[0][0]).not.toHaveProperty("take");
  });
});

describe("loadRouteAssistantJobsByIds", () => {
  it("consulta solo los ids indicados, con el tope justo y sin filtros extra", async () => {
    dbMock.jobFindMany.mockResolvedValue([record({ id: "r1", technicianId: TECH_A.id })]);

    const { jobs } = await loadRouteAssistantJobsByIds(["r1", "r2"], [TECH_A]);

    expect(dbMock.jobFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["r1", "r2"] } }, take: 2 })
    );
    expect(jobs.map((job) => job.id)).toEqual(["r1"]);
  });

  it("sin ids no consulta nada", async () => {
    const result = await loadRouteAssistantJobsByIds([], [TECH_A]);

    expect(dbMock.jobFindMany).not.toHaveBeenCalled();
    expect(result).toEqual({ records: [], technicians: [TECH_A], jobs: [] });
  });
});
