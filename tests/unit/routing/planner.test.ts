/**
 * Tests de caracterización de src/lib/routing/planner.ts.
 * Fijan el comportamiento ACTUAL de buildRouteAssistantPlans antes del refactor.
 *
 * Estrategia de aislamiento:
 * - Se mockea @/lib/routing/travel con un spy que por defecto delega en la
 *   implementación real (sin API key => estimación local determinista).
 * - fetch se sustituye por un stub que rechaza, para garantizar que ninguna
 *   ruta de código hace peticiones reales.
 * - La caché de travel se indexa por dirección, así que cada dirección de las
 *   fixtures siempre se usa con las mismas coordenadas.
 * - Las fechas se construyen en BUSINESS_TIMEZONE con luxon para que los
 *   resultados no dependan del huso horario de la máquina.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DateTime } from "luxon";
import { BUSINESS_TIMEZONE } from "@/lib/timezone";
import type { GeoPoint } from "@/lib/routing/geo";
import {
  buildFixedOrderPlan,
  buildRouteAssistantPlans,
  buildSequentialTravelPairs,
  DEFAULT_ROUTE_ASSISTANT_STRATEGIES,
  DEFAULT_ROUTE_ORIGIN_ADDRESS,
  type RouteAssistantJob,
  type RouteAssistantPlan,
  type RouteAssistantStrategy,
  type RouteAssistantTechnician,
  type RouteAssistantTechnicianPlan,
} from "@/lib/routing/planner";
import {
  getAddressPairKey,
  type AddressPairInput,
  type TravelMetric,
} from "@/lib/routing/travel";

type TravelModule = typeof import("@/lib/routing/travel");
type TravelMetricsFn = (pairs: AddressPairInput[]) => Promise<Map<string, TravelMetric>>;

const travelMock = vi.hoisted(() => ({
  getTravelMetricsForPairs: vi.fn<TravelMetricsFn>(),
}));

vi.mock("@/lib/routing/travel", async (importOriginal) => {
  const actual = await importOriginal<TravelModule>();
  return { ...actual, getTravelMetricsForPairs: travelMock.getTravelMetricsForPairs };
});

const PLAN_DAY = { year: 2026, month: 9, day: 21 };
const DEFAULT_DRIVE_MINUTES = 15;
const DEFAULT_SERVICE_MINUTES = 60;
const MIN_SERVICE_MINUTES = 30;
/** `sortOrder` = minuto del día en que empieza el servicio. */
const NINE_AM_MINUTES = 9 * 60;

type Place = { address: string; point: GeoPoint };

// Todos los puntos están sobre el mismo meridiano: la distancia haversine es
// proporcional a Δlat (0.01° ≈ 0.69 mi ≈ 4 min mínimo; 0.05° ≈ 3.45 mi ≈ 9 min).
const ORIGIN: Place = { address: "Base Origin Yard", point: { lat: 25.65, lng: -80.43 } };
const NEAR: Place = { address: "Near Stop", point: { lat: 25.66, lng: -80.43 } };
const MID: Place = { address: "Mid Stop", point: { lat: 25.7, lng: -80.43 } };
const FAR: Place = { address: "Far Stop", point: { lat: 25.8, lng: -80.43 } };
const CLUSTER_A1: Place = { address: "Cluster A1", point: { lat: 25.8, lng: -80.3 } };
const CLUSTER_A2: Place = { address: "Cluster A2", point: { lat: 25.801, lng: -80.3 } };
const CLUSTER_CANDIDATE: Place = {
  address: "Cluster Candidate",
  point: { lat: 25.8005, lng: -80.3 },
};

const TECH_A: RouteAssistantTechnician = { id: "tech-a", name: "Ana" };
const TECH_B: RouteAssistantTechnician = { id: "tech-b", name: "Bruno" };

function atBusinessTime(hour: number, minute = 0): Date {
  return DateTime.fromObject({ ...PLAN_DAY, hour, minute }, { zone: BUSINESS_TIMEZONE }).toJSDate();
}

function makeJob(overrides: Partial<RouteAssistantJob> & { id: string }): RouteAssistantJob {
  return {
    customerName: `Cliente ${overrides.id}`,
    address: `Address ${overrides.id}`,
    propertyName: null,
    status: "SCHEDULED",
    technicianId: null,
    currentTechnicianId: null,
    currentTechnicianName: null,
    currentSortOrder: null,
    planName: null,
    routeGroupId: null,
    routeGroupLabel: null,
    lockedTechnicianId: null,
    scheduledDate: atBusinessTime(9),
    estimatedDurationMinutes: null,
    coordinates: null,
    ...overrides,
  };
}

function placeJob(
  id: string,
  place: Place,
  overrides: Partial<RouteAssistantJob> = {}
): RouteAssistantJob {
  return makeJob({ id, address: place.address, coordinates: place.point, ...overrides });
}

function planFor(plans: RouteAssistantPlan[], strategy: RouteAssistantStrategy): RouteAssistantPlan {
  const plan = plans.find((candidate) => candidate.strategy === strategy);
  if (!plan) {
    throw new Error(`No hay plan para la estrategia ${strategy}`);
  }
  return plan;
}

function routeFor(plan: RouteAssistantPlan, technicianId: string): RouteAssistantTechnicianPlan {
  const route = plan.routes.find((candidate) => candidate.technicianId === technicianId);
  if (!route) {
    throw new Error(`No hay ruta para el técnico ${technicianId}`);
  }
  return route;
}

function stopJobIds(route: RouteAssistantTechnicianPlan): string[] {
  return route.stops.map((stop) => stop.jobId);
}

function stubTravelTable(entries: Array<[from: string, to: string, metric: TravelMetric]>) {
  const table = new Map(entries.map(([from, to, metric]) => [getAddressPairKey(from, to), metric]));
  travelMock.getTravelMetricsForPairs.mockImplementation(async (pairs) =>
    new Map(
      pairs.flatMap((candidate) => {
        const key = getAddressPairKey(candidate.fromAddress, candidate.toAddress);
        const metric = table.get(key);
        return metric ? [[key, metric] as const] : [];
      })
    )
  );
}

function liveMetric(durationMinutes: number, distanceMiles: number): TravelMetric {
  return { durationMinutes, distanceMiles, source: "LIVE_TRAFFIC" };
}

function requestedPairs(): Array<{ from: string; to: string }> {
  return travelMock.getTravelMetricsForPairs.mock.calls.flatMap(([pairs]) =>
    pairs.map((candidate) => ({ from: candidate.fromAddress, to: candidate.toAddress }))
  );
}

beforeEach(async () => {
  const actual = await vi.importActual<TravelModule>("@/lib/routing/travel");
  travelMock.getTravelMetricsForPairs.mockReset();
  travelMock.getTravelMetricsForPairs.mockImplementation(actual.getTravelMetricsForPairs);
  vi.stubEnv("GOOGLE_MAPS_SERVER_API_KEY", "");
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "");
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("fetch no permitido en tests del planner")))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("buildRouteAssistantPlans: entradas y estrategias", () => {
  it("devuelve una lista vacía cuando no hay trabajos", async () => {
    const plans = await buildRouteAssistantPlans({ jobs: [], technicians: [TECH_A] });

    expect(plans).toEqual([]);
    expect(travelMock.getTravelMetricsForPairs).not.toHaveBeenCalled();
  });

  it("devuelve una lista vacía cuando no hay técnicos", async () => {
    const plans = await buildRouteAssistantPlans({ jobs: [makeJob({ id: "j1" })], technicians: [] });

    expect(plans).toEqual([]);
  });

  it("genera un plan por estrategia por defecto en el orden BALANCED, SHORT_DRIVE, KEEP_ASSIGNMENTS", async () => {
    const plans = await buildRouteAssistantPlans({ jobs: [makeJob({ id: "j1" })], technicians: [TECH_A] });

    expect(DEFAULT_ROUTE_ASSISTANT_STRATEGIES).toEqual(["BALANCED", "SHORT_DRIVE", "KEEP_ASSIGNMENTS"]);
    expect(plans.map((plan) => plan.strategy)).toEqual(DEFAULT_ROUTE_ASSISTANT_STRATEGIES);
  });

  it("respeta la lista de estrategias indicada y usa el origen por defecto", async () => {
    const plans = await buildRouteAssistantPlans({
      jobs: [makeJob({ id: "j1" })],
      technicians: [TECH_A],
      strategies: ["SHORT_DRIVE"],
    });

    expect(DEFAULT_ROUTE_ORIGIN_ADDRESS).toBe("10731 SW 147th Ct, Miami, FL 33196");
    expect(plans).toHaveLength(1);
    expect(plans[0].strategy).toBe("SHORT_DRIVE");
    expect(plans[0].routes[0].originAddress).toBe(DEFAULT_ROUTE_ORIGIN_ADDRESS);
  });

  it("propaga el originAddress personalizado a cada ruta", async () => {
    const plans = await buildRouteAssistantPlans({
      jobs: [makeJob({ id: "j1" })],
      technicians: [TECH_A],
      originAddress: "Custom Yard",
      strategies: ["BALANCED"],
    });

    expect(plans[0].routes[0].originAddress).toBe("Custom Yard");
  });
});

describe("buildRouteAssistantPlans: una parada sin coordenadas", () => {
  it("usa 15 min de conducción, 60 de servicio y calcula llegada, regreso y totales", async () => {
    const job = makeJob({ id: "j1", scheduledDate: atBusinessTime(9) });

    const [plan] = await buildRouteAssistantPlans({
      jobs: [job],
      technicians: [TECH_A],
      strategies: ["BALANCED"],
    });
    const route = routeFor(plan, TECH_A.id);

    expect(route.stops).toEqual([
      {
        jobId: "j1",
        customerName: "Cliente j1",
        address: "Address j1",
        propertyName: null,
        planName: null,
        routeGroupId: null,
        routeGroupLabel: null,
        technicianId: TECH_A.id,
        technicianName: TECH_A.name,
        order: 1,
        scheduledTime: "09:00",
        // Llega 5 min antes de la hora citada y espera para empezar a las 09:00.
        estimatedArrivalTime: "08:55",
        serviceStartTime: "09:00",
        estimatedDriveMinutesFromPrevious: DEFAULT_DRIVE_MINUTES,
        estimatedServiceMinutes: DEFAULT_SERVICE_MINUTES,
        distanceMilesFromPrevious: null,
        delayMinutes: null,
        driveSource: "ESTIMATED",
        status: "SCHEDULED",
        currentTechnicianId: null,
        currentTechnicianName: null,
        currentSortOrder: null,
        hasCoordinates: false,
      },
    ]);
    expect(route).toMatchObject({
      routeGroupIds: [],
      routeGroupLabels: [],
      totalDriveMinutes: 2 * DEFAULT_DRIVE_MINUTES,
      returnDriveMinutes: DEFAULT_DRIVE_MINUTES,
      totalServiceMinutes: DEFAULT_SERVICE_MINUTES,
      totalRouteMinutes: 2 * DEFAULT_DRIVE_MINUTES + DEFAULT_SERVICE_MINUTES,
      returnDistanceMiles: null,
      returnDriveSource: "ESTIMATED",
      estimatedReturnTime: "10:15",
      conflicts: 0,
    });
    expect(plan.summary).toEqual({
      totalStops: 1,
      totalDriveMinutes: 30,
      totalServiceMinutes: 60,
      totalRouteMinutes: 90,
      conflicts: 0,
      loadSpread: 0,
    });
    expect(plan.updates).toEqual([
      { jobId: "j1", technicianId: TECH_A.id, sortOrder: NINE_AM_MINUTES },
    ]);
    expect(plan.unassigned).toEqual([]);
  });

  it("aplica un mínimo de 30 minutos de servicio y respeta duraciones mayores", async () => {
    const [plan] = await buildRouteAssistantPlans({
      jobs: [
        makeJob({ id: "short", estimatedDurationMinutes: 10, scheduledDate: atBusinessTime(9) }),
        makeJob({ id: "long", estimatedDurationMinutes: 90, scheduledDate: atBusinessTime(13) }),
      ],
      technicians: [TECH_A],
      strategies: ["BALANCED"],
    });
    const route = routeFor(plan, TECH_A.id);

    expect(route.stops.map((stop) => [stop.jobId, stop.estimatedServiceMinutes])).toEqual([
      ["short", MIN_SERVICE_MINUTES],
      ["long", 90],
    ]);
    expect(route.totalServiceMinutes).toBe(MIN_SERVICE_MINUTES + 90);
  });

  it("nunca arranca antes de las 08:00: una cita a las 07:00 llega a las 08:15 con 75 min de retraso", async () => {
    const [plan] = await buildRouteAssistantPlans({
      jobs: [makeJob({ id: "early", scheduledDate: atBusinessTime(7) })],
      technicians: [TECH_A],
      strategies: ["BALANCED"],
    });
    const [stop] = routeFor(plan, TECH_A.id).stops;

    expect(stop.scheduledTime).toBe("07:00");
    expect(stop.estimatedArrivalTime).toBe("08:15");
    expect(stop.serviceStartTime).toBe("08:15");
    expect(stop.delayMinutes).toBe(75);
    expect(plan.summary.conflicts).toBe(1);
  });

  it("arranca 20 minutos antes de la primera cita y espera hasta la hora citada", async () => {
    const [plan] = await buildRouteAssistantPlans({
      jobs: [makeJob({ id: "late-morning", scheduledDate: atBusinessTime(10) })],
      technicians: [TECH_A],
      strategies: ["BALANCED"],
    });
    const [stop] = routeFor(plan, TECH_A.id).stops;

    expect(stop.estimatedArrivalTime).toBe("09:55");
    expect(stop.serviceStartTime).toBe("10:00");
    expect(stop.delayMinutes).toBeNull();
  });

  // Bug corregido: antes cualquier hora posterior a medianoche se recortaba a
  // 23:59; ahora se devuelve la hora real y la ruta se marca con overflowsDay.
  it("devuelve la hora real del día siguiente y marca overflowsDay", async () => {
    const [plan] = await buildRouteAssistantPlans({
      jobs: [makeJob({ id: "night", scheduledDate: atBusinessTime(23, 30) })],
      technicians: [TECH_A],
      strategies: ["BALANCED"],
    });
    const route = routeFor(plan, TECH_A.id);

    expect(route.stops[0].scheduledTime).toBe("23:30");
    expect(route.stops[0].serviceStartTime).toBe("23:30");
    expect(route.estimatedReturnTime).toBe("00:45");
    expect(route.overflowsDay).toBe(true);
  });

  it("no marca overflowsDay en una ruta que termina antes de medianoche", async () => {
    const [plan] = await buildRouteAssistantPlans({
      jobs: [makeJob({ id: "day", scheduledDate: atBusinessTime(9) })],
      technicians: [TECH_A],
      strategies: ["BALANCED"],
    });

    expect(routeFor(plan, TECH_A.id).overflowsDay).toBeUndefined();
  });
});

describe("buildRouteAssistantPlans: retrasos y conflictos", () => {
  it("cuenta un conflicto cuando el retraso supera los 25 minutos", async () => {
    const [plan] = await buildRouteAssistantPlans({
      jobs: [
        makeJob({ id: "first", scheduledDate: atBusinessTime(8) }),
        makeJob({ id: "second", scheduledDate: atBusinessTime(8) }),
      ],
      technicians: [TECH_A],
      strategies: ["BALANCED"],
    });
    const route = routeFor(plan, TECH_A.id);

    expect(stopJobIds(route)).toEqual(["first", "second"]);
    expect(route.stops.map((stop) => [stop.estimatedArrivalTime, stop.delayMinutes])).toEqual([
      ["08:15", 15],
      ["09:30", 90],
    ]);
    expect(route.conflicts).toBe(1);
    expect(route.estimatedReturnTime).toBe("10:45");
    expect(plan.summary.conflicts).toBe(1);
  });
});

describe("buildRouteAssistantPlans: asignación de técnicos", () => {
  it("lockedTechnicianId fuerza la asignación en todas las estrategias", async () => {
    const jobs = [
      makeJob({ id: "l1", lockedTechnicianId: TECH_B.id }),
      makeJob({ id: "l2", lockedTechnicianId: TECH_B.id }),
    ];

    const plans = await buildRouteAssistantPlans({ jobs, technicians: [TECH_A, TECH_B] });

    for (const plan of plans) {
      expect(plan.routes).toHaveLength(1);
      expect(stopJobIds(routeFor(plan, TECH_B.id))).toEqual(["l1", "l2"]);
    }
  });

  it("ignora un lockedTechnicianId que no está entre los técnicos disponibles", async () => {
    const jobs = [makeJob({ id: "ghost", lockedTechnicianId: "no-existe", technicianId: TECH_B.id })];

    const plans = await buildRouteAssistantPlans({ jobs, technicians: [TECH_A, TECH_B] });

    expect(planFor(plans, "KEEP_ASSIGNMENTS").routes[0].technicianId).toBe(TECH_B.id);
    expect(planFor(plans, "BALANCED").routes[0].technicianId).toBe(TECH_A.id);
  });

  it("KEEP_ASSIGNMENTS conserva technicianId mientras BALANCED reparte la carga", async () => {
    const jobs = [
      makeJob({ id: "k1", technicianId: TECH_B.id }),
      makeJob({ id: "k2", technicianId: TECH_B.id }),
    ];

    const plans = await buildRouteAssistantPlans({ jobs, technicians: [TECH_A, TECH_B] });
    const keep = planFor(plans, "KEEP_ASSIGNMENTS");
    const balanced = planFor(plans, "BALANCED");

    expect(keep.routes).toHaveLength(1);
    expect(stopJobIds(routeFor(keep, TECH_B.id))).toEqual(["k1", "k2"]);
    expect(stopJobIds(routeFor(balanced, TECH_A.id))).toEqual(["k1"]);
    expect(stopJobIds(routeFor(balanced, TECH_B.id))).toEqual(["k2"]);
    expect(balanced.summary.loadSpread).toBe(0);
  });

  it("SHORT_DRIVE prioriza la cercanía al centroide y BALANCED la carga", async () => {
    const jobs = [
      placeJob("a1", CLUSTER_A1, { lockedTechnicianId: TECH_A.id }),
      placeJob("a2", CLUSTER_A2, { lockedTechnicianId: TECH_A.id }),
      placeJob("candidate", CLUSTER_CANDIDATE),
    ];

    const plans = await buildRouteAssistantPlans({
      jobs,
      technicians: [TECH_A, TECH_B],
      originCoordinates: ORIGIN.point,
      originAddress: ORIGIN.address,
    });
    const shortDrive = planFor(plans, "SHORT_DRIVE");
    const balanced = planFor(plans, "BALANCED");
    const keep = planFor(plans, "KEEP_ASSIGNMENTS");

    expect(shortDrive.routes).toHaveLength(1);
    expect(stopJobIds(routeFor(shortDrive, TECH_A.id))).toContain("candidate");
    expect(stopJobIds(routeFor(balanced, TECH_B.id))).toEqual(["candidate"]);
    // KEEP_ASSIGNMENTS no auto-asigna: el trabajo sin técnico queda fuera.
    expect(keep.unassigned.map((stop) => stop.jobId)).toEqual(["candidate"]);
    expect(keep.routes.map((route) => route.technicianId)).toEqual([TECH_A.id]);
  });

  it("excluye de routes y updates a los técnicos sin paradas", async () => {
    const [plan] = await buildRouteAssistantPlans({
      jobs: [makeJob({ id: "solo" })],
      technicians: [TECH_A, TECH_B],
      strategies: ["BALANCED"],
    });

    expect(plan.routes.map((route) => route.technicianId)).toEqual([TECH_A.id]);
    expect(plan.updates).toEqual([
      { jobId: "solo", technicianId: TECH_A.id, sortOrder: NINE_AM_MINUTES },
    ]);
  });

  // Bug corregido: loadSpread se calcula sobre todos los técnicos antes de
  // descartar las rutas vacías, así que un técnico sin trabajos sí cuenta.
  it("loadSpread cuenta a los técnicos que quedan sin paradas", async () => {
    const jobs = [
      makeJob({ id: "l1", lockedTechnicianId: TECH_B.id }),
      makeJob({ id: "l2", lockedTechnicianId: TECH_B.id }),
    ];

    const [plan] = await buildRouteAssistantPlans({
      jobs,
      technicians: [TECH_A, TECH_B],
      strategies: ["BALANCED"],
    });

    expect(plan.summary.loadSpread).toBe(2);
  });
});

describe("buildRouteAssistantPlans: orden de paradas y agregados", () => {
  it("ordena las paradas por vecino más cercano partiendo del origen", async () => {
    const jobs = [placeJob("far", FAR), placeJob("mid", MID), placeJob("near", NEAR)];

    const [plan] = await buildRouteAssistantPlans({
      jobs,
      technicians: [TECH_A],
      originAddress: ORIGIN.address,
      originCoordinates: ORIGIN.point,
      strategies: ["BALANCED"],
    });
    const route = routeFor(plan, TECH_A.id);

    expect(stopJobIds(route)).toEqual(["near", "mid", "far"]);
    expect(route.stops.map((stop) => stop.order)).toEqual([1, 2, 3]);
    // sortOrder = minuto del día del inicio de servicio (09:00, 10:07, 11:25).
    expect(plan.updates).toEqual([
      { jobId: "near", technicianId: TECH_A.id, sortOrder: NINE_AM_MINUTES },
      { jobId: "mid", technicianId: TECH_A.id, sortOrder: 10 * 60 + 7 },
      { jobId: "far", technicianId: TECH_A.id, sortOrder: 11 * 60 + 25 },
    ]);
  });

  it("acumula conducción, distancias, retrasos y regreso a lo largo de la ruta", async () => {
    const jobs = [placeJob("far", FAR), placeJob("mid", MID), placeJob("near", NEAR)];

    const [plan] = await buildRouteAssistantPlans({
      jobs,
      technicians: [TECH_A],
      originAddress: ORIGIN.address,
      originCoordinates: ORIGIN.point,
      strategies: ["BALANCED"],
    });
    const route = routeFor(plan, TECH_A.id);

    expect(
      route.stops.map((stop) => ({
        drive: stop.estimatedDriveMinutesFromPrevious,
        miles: stop.distanceMilesFromPrevious,
        arrival: stop.estimatedArrivalTime,
        delay: stop.delayMinutes,
      }))
    ).toEqual([
      { drive: 4, miles: 0.69, arrival: "08:44", delay: null },
      { drive: 7, miles: 2.76, arrival: "10:07", delay: 67 },
      { drive: 18, miles: 6.91, arrival: "11:25", delay: 145 },
    ]);
    expect(route).toMatchObject({
      returnDriveMinutes: 26,
      returnDistanceMiles: 10.36,
      estimatedReturnTime: "12:51",
      totalDriveMinutes: 55,
      totalServiceMinutes: 180,
      totalRouteMinutes: 235,
      conflicts: 2,
    });
    expect(plan.summary).toMatchObject({ totalStops: 3, conflicts: 2, loadSpread: 0 });
  });

  it("deduplica routeGroupIds y routeGroupLabels y descarta los nulos", async () => {
    const jobs = [
      makeJob({ id: "g1", routeGroupId: "grp-1", routeGroupLabel: "Lunes" }),
      makeJob({ id: "g2", routeGroupId: "grp-1", routeGroupLabel: "Lunes" }),
      makeJob({ id: "g3", routeGroupId: "grp-2", routeGroupLabel: null }),
      makeJob({ id: "g4" }),
    ];

    const [plan] = await buildRouteAssistantPlans({
      jobs,
      technicians: [TECH_A],
      strategies: ["BALANCED"],
    });
    const route = routeFor(plan, TECH_A.id);

    expect(route.routeGroupIds).toEqual(["grp-1", "grp-2"]);
    expect(route.routeGroupLabels).toEqual(["Lunes"]);
    expect(route.stops.map((stop) => stop.routeGroupLabel)).toEqual(["Lunes", "Lunes", null, null]);
  });

  it("usa su propia estimación haversine cuando travel no devuelve métrica para el par", async () => {
    const jobs = [makeJob({ id: "blank", address: "", coordinates: NEAR.point })];

    const [plan] = await buildRouteAssistantPlans({
      jobs,
      technicians: [TECH_A],
      originAddress: ORIGIN.address,
      originCoordinates: ORIGIN.point,
      strategies: ["BALANCED"],
    });
    const route = routeFor(plan, TECH_A.id);

    expect(route.stops[0]).toMatchObject({
      estimatedDriveMinutesFromPrevious: 4,
      distanceMilesFromPrevious: 0.69,
      driveSource: "ESTIMATED",
    });
    expect(route).toMatchObject({
      returnDriveMinutes: 4,
      returnDistanceMiles: 0.69,
      estimatedReturnTime: "10:04",
    });
  });
});

describe("buildRouteAssistantPlans: integración con métricas de travel", () => {
  it("solicita origen→parada, parada↔parada y parada→origen cuando hay dos o más paradas", async () => {
    const jobs = [placeJob("a", NEAR), placeJob("b", MID)];

    await buildRouteAssistantPlans({
      jobs,
      technicians: [TECH_A],
      originAddress: ORIGIN.address,
      originCoordinates: ORIGIN.point,
      strategies: ["BALANCED"],
    });

    expect(travelMock.getTravelMetricsForPairs).toHaveBeenCalledTimes(1);
    expect(requestedPairs()).toEqual([
      { from: ORIGIN.address, to: NEAR.address },
      { from: ORIGIN.address, to: MID.address },
      { from: NEAR.address, to: MID.address },
      { from: MID.address, to: NEAR.address },
      { from: NEAR.address, to: ORIGIN.address },
      { from: MID.address, to: ORIGIN.address },
    ]);
    const [firstPair] = travelMock.getTravelMetricsForPairs.mock.calls[0][0];
    expect(firstPair).toMatchObject({ fromCoordinates: ORIGIN.point, toCoordinates: NEAR.point });
  });

  // Bug corregido: con una sola parada se piden origen→parada y parada→origen,
  // así que el regreso puede usar tráfico en vivo cuando hay API key.
  it("con una sola parada también solicita el tramo de regreso al origen", async () => {
    await buildRouteAssistantPlans({
      jobs: [placeJob("single", NEAR)],
      technicians: [TECH_A],
      originAddress: ORIGIN.address,
      originCoordinates: ORIGIN.point,
      strategies: ["BALANCED"],
    });

    expect(requestedPairs()).toEqual([
      { from: ORIGIN.address, to: NEAR.address },
      { from: NEAR.address, to: ORIGIN.address },
    ]);
  });

  it("con una sola parada usa la métrica LIVE_TRAFFIC de travel también para el regreso", async () => {
    const yard = "Single Yard";
    const stopA = "Single Stop A";
    stubTravelTable([
      [yard, stopA, liveMetric(9, 3.3)],
      [stopA, yard, liveMetric(11, 4.4)],
    ]);

    const [plan] = await buildRouteAssistantPlans({
      jobs: [makeJob({ id: "a", address: stopA })],
      technicians: [TECH_A],
      originAddress: yard,
      strategies: ["BALANCED"],
    });
    const route = routeFor(plan, TECH_A.id);

    expect(route.stops[0]).toMatchObject({
      estimatedDriveMinutesFromPrevious: 9,
      driveSource: "LIVE_TRAFFIC",
    });
    expect(route).toMatchObject({
      returnDriveMinutes: 11,
      returnDistanceMiles: 4.4,
      returnDriveSource: "LIVE_TRAFFIC",
      totalDriveMinutes: 9 + 11,
      estimatedReturnTime: "10:11",
    });
  });

  it("prefiere las métricas LIVE_TRAFFIC de travel sobre la estimación propia", async () => {
    const yard = "Live Yard";
    const stopA = "Live Stop A";
    const stopB = "Live Stop B";
    stubTravelTable([
      [yard, stopA, liveMetric(12, 5.5)],
      [yard, stopB, liveMetric(30, 14)],
      [stopA, stopB, liveMetric(7, 2.2)],
      [stopB, stopA, liveMetric(7, 2.2)],
      [stopA, yard, liveMetric(12, 5.5)],
      [stopB, yard, liveMetric(20, 9.9)],
    ]);

    const [plan] = await buildRouteAssistantPlans({
      jobs: [makeJob({ id: "a", address: stopA }), makeJob({ id: "b", address: stopB })],
      technicians: [TECH_A],
      originAddress: yard,
      strategies: ["BALANCED"],
    });
    const route = routeFor(plan, TECH_A.id);

    expect(stopJobIds(route)).toEqual(["a", "b"]);
    expect(
      route.stops.map((stop) => [
        stop.estimatedDriveMinutesFromPrevious,
        stop.distanceMilesFromPrevious,
        stop.driveSource,
      ])
    ).toEqual([
      [12, 5.5, "LIVE_TRAFFIC"],
      [7, 2.2, "LIVE_TRAFFIC"],
    ]);
    expect(route).toMatchObject({
      returnDriveMinutes: 20,
      returnDistanceMiles: 9.9,
      returnDriveSource: "LIVE_TRAFFIC",
      totalDriveMinutes: 12 + 7 + 20,
    });
  });

  it("completa con la estimación propia los pares que travel no resuelve", async () => {
    const yard = "Partial Yard";
    const stopA = "Partial Stop A";
    stubTravelTable([[yard, stopA, liveMetric(9, 3.3)]]);

    const [plan] = await buildRouteAssistantPlans({
      jobs: [makeJob({ id: "a", address: stopA })],
      technicians: [TECH_A],
      originAddress: yard,
      strategies: ["BALANCED"],
    });
    const route = routeFor(plan, TECH_A.id);

    expect(route.stops[0]).toMatchObject({
      estimatedDriveMinutesFromPrevious: 9,
      distanceMilesFromPrevious: 3.3,
      driveSource: "LIVE_TRAFFIC",
    });
    expect(route).toMatchObject({
      returnDriveMinutes: DEFAULT_DRIVE_MINUTES,
      returnDistanceMiles: null,
      returnDriveSource: "ESTIMATED",
    });
  });
});

describe("buildRouteAssistantPlans: campos nuevos de cada parada", () => {
  it("propaga propertyName, status y el estado actual en base de datos", async () => {
    const job = makeJob({
      id: "j1",
      propertyName: "Casa del lago",
      status: "IN_PROGRESS",
      technicianId: TECH_A.id,
      currentTechnicianId: TECH_A.id,
      currentTechnicianName: TECH_A.name,
      currentSortOrder: 540,
      coordinates: NEAR.point,
    });

    const [plan] = await buildRouteAssistantPlans({
      jobs: [job],
      technicians: [TECH_A],
      strategies: ["KEEP_ASSIGNMENTS"],
    });

    expect(routeFor(plan, TECH_A.id).stops[0]).toMatchObject({
      propertyName: "Casa del lago",
      status: "IN_PROGRESS",
      currentTechnicianId: TECH_A.id,
      currentTechnicianName: TECH_A.name,
      currentSortOrder: 540,
      hasCoordinates: true,
    });
  });
});

describe("buildRouteAssistantPlans: trabajos sin asignar", () => {
  it("KEEP_ASSIGNMENTS deja sin asignar los trabajos sin técnico", async () => {
    const jobs = [
      makeJob({ id: "assigned", technicianId: TECH_A.id }),
      makeJob({ id: "orphan", scheduledDate: atBusinessTime(11) }),
    ];

    const [plan] = await buildRouteAssistantPlans({
      jobs,
      technicians: [TECH_A],
      strategies: ["KEEP_ASSIGNMENTS"],
    });

    expect(stopJobIds(routeFor(plan, TECH_A.id))).toEqual(["assigned"]);
    expect(plan.unassigned).toHaveLength(1);
    expect(plan.unassigned[0]).toMatchObject({
      jobId: "orphan",
      technicianId: "",
      technicianName: "",
      order: 1,
      scheduledTime: "11:00",
      serviceStartTime: "11:00",
      estimatedDriveMinutesFromPrevious: 0,
      distanceMilesFromPrevious: null,
      delayMinutes: null,
    });
    expect(plan.unassigned[0].driveSource).toBeUndefined();
    expect(plan.updates.map((update) => update.jobId)).toEqual(["assigned"]);
    expect(plan.summary.totalStops).toBe(1);
  });

  it("KEEP_ASSIGNMENTS deja sin asignar a los trabajos de un técnico fuera de alcance", async () => {
    const [plan] = await buildRouteAssistantPlans({
      jobs: [makeJob({ id: "other", technicianId: "tech-fuera" })],
      technicians: [TECH_A],
      strategies: ["KEEP_ASSIGNMENTS"],
    });

    expect(plan.routes).toEqual([]);
    expect(plan.unassigned.map((stop) => stop.jobId)).toEqual(["other"]);
  });

  it("las estrategias automáticas reparten todos los trabajos", async () => {
    const plans = await buildRouteAssistantPlans({
      jobs: [makeJob({ id: "orphan" })],
      technicians: [TECH_A],
      strategies: ["BALANCED", "SHORT_DRIVE"],
    });

    for (const plan of plans) {
      expect(plan.unassigned).toEqual([]);
    }
  });
});

describe("buildSequentialTravelPairs", () => {
  const origin = { address: ORIGIN.address, coordinates: ORIGIN.point };

  it("no pide ningún tramo sin paradas", () => {
    expect(buildSequentialTravelPairs([], origin)).toEqual([]);
  });

  it("pide solo origen -> 1 -> 2 -> origen", () => {
    const stops = [placeJob("a", NEAR), placeJob("b", MID)];

    expect(
      buildSequentialTravelPairs(stops, origin).map((pair) => [
        pair.fromAddress,
        pair.toAddress,
      ])
    ).toEqual([
      [ORIGIN.address, NEAR.address],
      [NEAR.address, MID.address],
      [MID.address, ORIGIN.address],
    ]);
  });
});

describe("buildFixedOrderPlan", () => {
  const originInput = {
    originAddress: ORIGIN.address,
    originCoordinates: ORIGIN.point,
  };

  it("respeta el orden recibido aunque no sea el óptimo y marca la estrategia MANUAL", async () => {
    const jobs = [placeJob("near", NEAR), placeJob("mid", MID), placeJob("far", FAR)];

    const plan = await buildFixedOrderPlan({
      ...originInput,
      jobs,
      routes: [{ technician: TECH_A, jobIds: ["far", "near", "mid"] }],
    });

    expect(plan.strategy).toBe("MANUAL");
    expect(stopJobIds(routeFor(plan, TECH_A.id))).toEqual(["far", "near", "mid"]);
    expect(routeFor(plan, TECH_A.id).stops.map((stop) => stop.order)).toEqual([1, 2, 3]);
    expect(plan.updates.map((update) => update.jobId)).toEqual(["far", "near", "mid"]);
    expect(plan.updates.every((update) => update.technicianId === TECH_A.id)).toBe(true);
  });

  it("solicita únicamente los tramos consecutivos", async () => {
    const jobs = [placeJob("near", NEAR), placeJob("mid", MID)];

    await buildFixedOrderPlan({
      ...originInput,
      jobs,
      routes: [{ technician: TECH_A, jobIds: ["near", "mid"] }],
    });

    expect(travelMock.getTravelMetricsForPairs).toHaveBeenCalledTimes(1);
    expect(requestedPairs()).toEqual([
      { from: ORIGIN.address, to: NEAR.address },
      { from: NEAR.address, to: MID.address },
      { from: MID.address, to: ORIGIN.address },
    ]);
  });

  it("reparte las paradas entre varias rutas y deja fuera los trabajos no incluidos", async () => {
    const jobs = [
      placeJob("near", NEAR),
      placeJob("mid", MID),
      placeJob("far", FAR),
    ];

    const plan = await buildFixedOrderPlan({
      ...originInput,
      jobs,
      routes: [
        { technician: TECH_A, jobIds: ["near"] },
        { technician: TECH_B, jobIds: ["mid"] },
      ],
    });

    expect(stopJobIds(routeFor(plan, TECH_A.id))).toEqual(["near"]);
    expect(stopJobIds(routeFor(plan, TECH_B.id))).toEqual(["mid"]);
    expect(plan.unassigned.map((stop) => stop.jobId)).toEqual(["far"]);
    expect(plan.summary.totalStops).toBe(2);
    expect(plan.summary.loadSpread).toBe(0);
  });

  it("ignora los ids que no corresponden a ningún trabajo cargado", async () => {
    const plan = await buildFixedOrderPlan({
      ...originInput,
      jobs: [placeJob("near", NEAR)],
      routes: [{ technician: TECH_A, jobIds: ["near", "no-existe"] }],
    });

    expect(stopJobIds(routeFor(plan, TECH_A.id))).toEqual(["near"]);
    expect(plan.unassigned).toEqual([]);
  });

  it("sin paradas devuelve un plan vacío sin rutas", async () => {
    const plan = await buildFixedOrderPlan({
      ...originInput,
      jobs: [],
      routes: [{ technician: TECH_A, jobIds: [] }],
    });

    expect(plan.routes).toEqual([]);
    expect(plan.updates).toEqual([]);
    expect(plan.summary.totalStops).toBe(0);
  });
});
