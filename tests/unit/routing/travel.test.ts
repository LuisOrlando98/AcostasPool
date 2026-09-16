/**
 * Tests de caracterización de src/lib/routing/travel.ts.
 * Fijan el comportamiento ACTUAL de getAddressPairKey y getTravelMetricsForPairs.
 * El módulo mantiene una caché global con TTL, así que se recarga con
 * vi.resetModules() antes de cada test para aislarlos.
 * No se hacen peticiones reales: fetch se sustituye con vi.stubGlobal.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeoPoint } from "@/lib/routing/geo";
import type { AddressPairInput } from "@/lib/routing/travel";

type TravelModule = typeof import("@/lib/routing/travel");

const DISTANCE_MATRIX_ENDPOINT =
  "https://maps.googleapis.com/maps/api/distancematrix/json";
const ORIGIN_ADDRESS = "10731 SW 147th Ct, Miami, FL 33196";
const DESTINATION_ADDRESS = "1 Ocean Dr, Miami Beach, FL 33139";
const API_KEY = "google-key";
const SERVER_API_KEY = "server-key";
const HTTP_OK = 200;
const HTTP_SERVER_ERROR = 500;
const CACHE_TTL_MS = 3 * 60 * 1000;
const DEFAULT_DRIVE_MINUTES = 15;
const MIN_ESTIMATED_MINUTES = 4;
const METERS_PER_MILE = 1609.344;
const SECONDS_PER_MINUTE = 60;

// Puntos sobre el mismo meridiano: la distancia haversine es proporcional a Δlat
// (1° de latitud ≈ 69.09 millas con radio terrestre 3958.8 mi).
const EQUATOR: GeoPoint = { lat: 0, lng: 0 };
const ONE_DEGREE_NORTH: GeoPoint = { lat: 1, lng: 0 };
const ONE_DEGREE_MILES = 69.09;
const ONE_DEGREE_MINUTES = 177;
const SHORT_HOP: GeoPoint = { lat: 0.01, lng: 0 };
const SHORT_HOP_MILES = 0.69;
const NEGLIGIBLE_HOP: GeoPoint = { lat: 0.0002, lng: 0 };

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = HTTP_OK): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function distanceMatrixResponse(element: Record<string, unknown>, status = HTTP_OK): Response {
  return jsonResponse({ status: "OK", rows: [{ elements: [element] }] }, status);
}

function requestedUrl(callIndex = 0): URL {
  const call = fetchMock.mock.calls[callIndex];
  if (!call) {
    throw new Error(`fetch no fue invocado ${callIndex + 1} veces`);
  }
  return new URL(String(call[0]));
}

function pair(overrides: Partial<AddressPairInput> = {}): AddressPairInput {
  return {
    fromAddress: ORIGIN_ADDRESS,
    toAddress: DESTINATION_ADDRESS,
    ...overrides,
  };
}

async function loadTravelModule(): Promise<TravelModule> {
  vi.resetModules();
  return import("@/lib/routing/travel");
}

let travel: TravelModule;

beforeEach(async () => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GOOGLE_MAPS_SERVER_API_KEY", "");
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "");
  travel = await loadTravelModule();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("getAddressPairKey", () => {
  it("normaliza espacios y mayúsculas y une ambas direcciones con ::", () => {
    const key = travel.getAddressPairKey("  10731 SW   147th Ct ", "\n1 OCEAN Dr\t");

    expect(key).toBe("10731 sw 147th ct::1 ocean dr");
  });

  it("es direccional: A→B y B→A producen claves distintas", () => {
    const forward = travel.getAddressPairKey("A", "B");
    const backward = travel.getAddressPairKey("B", "A");

    expect(forward).toBe("a::b");
    expect(backward).toBe("b::a");
    expect(forward).not.toBe(backward);
  });
});

describe("getTravelMetricsForPairs sin API key (estimación local)", () => {
  it("devuelve un mapa vacío sin llamar a fetch cuando no hay pares", async () => {
    const result = await travel.getTravelMetricsForPairs([]);

    expect(result.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("omite los pares con alguna dirección en blanco", async () => {
    const result = await travel.getTravelMetricsForPairs([
      pair({ fromAddress: "   " }),
      pair({ toAddress: "" }),
    ]);

    expect(result.size).toBe(0);
  });

  it("marca como SAME_ADDRESS los pares cuyas direcciones coinciden tras normalizar", async () => {
    const result = await travel.getTravelMetricsForPairs([
      pair({ fromAddress: "  1 Ocean   Dr ", toAddress: "1 OCEAN DR" }),
    ]);

    expect(result.get("1 ocean dr::1 ocean dr")).toEqual({
      durationMinutes: 0,
      distanceMiles: 0,
      source: "SAME_ADDRESS",
    });
  });

  it("usa 15 minutos y distancia null cuando faltan coordenadas, sin llamar a fetch", async () => {
    const result = await travel.getTravelMetricsForPairs([
      pair(),
      pair({ toAddress: "Solo origen", fromCoordinates: EQUATOR, toCoordinates: null }),
    ]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.get(travel.getAddressPairKey(ORIGIN_ADDRESS, DESTINATION_ADDRESS))).toEqual({
      durationMinutes: DEFAULT_DRIVE_MINUTES,
      distanceMiles: null,
      source: "ESTIMATED",
    });
    expect(result.get(travel.getAddressPairKey(ORIGIN_ADDRESS, "Solo origen"))).toMatchObject({
      durationMinutes: DEFAULT_DRIVE_MINUTES,
      distanceMiles: null,
    });
  });

  it("estima con haversine a 27 mph y factor de tráfico 1.15", async () => {
    const result = await travel.getTravelMetricsForPairs([
      pair({ fromCoordinates: EQUATOR, toCoordinates: ONE_DEGREE_NORTH }),
    ]);

    expect(Array.from(result.values())).toEqual([
      {
        durationMinutes: ONE_DEGREE_MINUTES,
        distanceMiles: ONE_DEGREE_MILES,
        source: "ESTIMATED",
      },
    ]);
  });

  it("aplica un mínimo de 4 minutos en trayectos cortos", async () => {
    const result = await travel.getTravelMetricsForPairs([
      pair({ fromCoordinates: EQUATOR, toCoordinates: SHORT_HOP }),
    ]);

    expect(Array.from(result.values())).toEqual([
      { durationMinutes: MIN_ESTIMATED_MINUTES, distanceMiles: SHORT_HOP_MILES, source: "ESTIMATED" },
    ]);
  });

  it("trata distancias ≤ 0.02 millas como SAME_ADDRESS aunque las direcciones difieran", async () => {
    const result = await travel.getTravelMetricsForPairs([
      pair({ fromCoordinates: EQUATOR, toCoordinates: NEGLIGIBLE_HOP }),
    ]);

    expect(Array.from(result.values())).toEqual([
      { durationMinutes: 0, distanceMiles: 0, source: "SAME_ADDRESS" },
    ]);
  });

  it("deduplica pares por clave y conserva el primero", async () => {
    const result = await travel.getTravelMetricsForPairs([
      pair({ fromCoordinates: EQUATOR, toCoordinates: ONE_DEGREE_NORTH }),
      pair({
        fromAddress: ORIGIN_ADDRESS.toUpperCase(),
        toAddress: `  ${DESTINATION_ADDRESS}`,
        fromCoordinates: null,
        toCoordinates: null,
      }),
    ]);

    expect(result.size).toBe(1);
    expect(Array.from(result.values())[0]).toMatchObject({
      durationMinutes: ONE_DEGREE_MINUTES,
      distanceMiles: ONE_DEGREE_MILES,
    });
  });
});

describe("getTravelMetricsForPairs con API key (Google Distance Matrix)", () => {
  const FIVE_MILES_METERS = 5 * METERS_PER_MILE;
  const LIVE_DURATION_MINUTES = 21;
  const BASE_DURATION_MINUTES = 12;
  const liveElement = {
    status: "OK",
    distance: { value: FIVE_MILES_METERS },
    duration: { value: BASE_DURATION_MINUTES * SECONDS_PER_MINUTE },
    duration_in_traffic: { value: LIVE_DURATION_MINUTES * SECONDS_PER_MINUTE },
  };

  beforeEach(() => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", API_KEY);
  });

  it("consulta el Distance Matrix con origins, destinations, tráfico y unidades imperiales", async () => {
    fetchMock.mockResolvedValue(distanceMatrixResponse(liveElement));

    await travel.getTravelMetricsForPairs([pair()]);

    const url = requestedUrl();
    expect(`${url.origin}${url.pathname}`).toBe(DISTANCE_MATRIX_ENDPOINT);
    expect(url.searchParams.get("origins")).toBe(ORIGIN_ADDRESS);
    expect(url.searchParams.get("destinations")).toBe(DESTINATION_ADDRESS);
    expect(url.searchParams.get("departure_time")).toBe("now");
    expect(url.searchParams.get("traffic_model")).toBe("best_guess");
    expect(url.searchParams.get("units")).toBe("imperial");
    expect(url.searchParams.get("region")).toBe("us");
    expect(url.searchParams.get("key")).toBe(API_KEY);
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init).toMatchObject({ cache: "no-store" });
  });

  it("prefiere duration_in_traffic y convierte metros a millas con dos decimales", async () => {
    fetchMock.mockResolvedValue(distanceMatrixResponse(liveElement));

    const result = await travel.getTravelMetricsForPairs([pair()]);

    expect(Array.from(result.values())).toEqual([
      { durationMinutes: LIVE_DURATION_MINUTES, distanceMiles: 5, source: "LIVE_TRAFFIC" },
    ]);
  });

  it("usa duration cuando no hay duration_in_traffic", async () => {
    fetchMock.mockResolvedValue(
      distanceMatrixResponse({ ...liveElement, duration_in_traffic: undefined })
    );

    const result = await travel.getTravelMetricsForPairs([pair()]);

    expect(Array.from(result.values())[0]).toMatchObject({
      durationMinutes: BASE_DURATION_MINUTES,
      source: "LIVE_TRAFFIC",
    });
  });

  it("devuelve distancia null si Google no informa distance pero sí duración", async () => {
    fetchMock.mockResolvedValue(
      distanceMatrixResponse({ ...liveElement, distance: undefined })
    );

    const result = await travel.getTravelMetricsForPairs([pair()]);

    expect(Array.from(result.values())).toEqual([
      { durationMinutes: LIVE_DURATION_MINUTES, distanceMiles: null, source: "LIVE_TRAFFIC" },
    ]);
  });

  it("prefiere GOOGLE_MAPS_SERVER_API_KEY sobre GOOGLE_MAPS_API_KEY y la recorta", async () => {
    vi.stubEnv("GOOGLE_MAPS_SERVER_API_KEY", `  ${SERVER_API_KEY} `);
    fetchMock.mockResolvedValue(distanceMatrixResponse(liveElement));

    await travel.getTravelMetricsForPairs([pair()]);

    expect(requestedUrl().searchParams.get("key")).toBe(SERVER_API_KEY);
  });

  it("no consulta a Google cuando las direcciones coinciden", async () => {
    const result = await travel.getTravelMetricsForPairs([
      pair({ toAddress: ORIGIN_ADDRESS }),
    ]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(Array.from(result.values())[0]).toMatchObject({ source: "SAME_ADDRESS" });
  });

  it("vuelve a la estimación local cuando el elemento no tiene status OK", async () => {
    fetchMock.mockResolvedValue(
      distanceMatrixResponse({ ...liveElement, status: "ZERO_RESULTS" })
    );

    const result = await travel.getTravelMetricsForPairs([
      pair({ fromCoordinates: EQUATOR, toCoordinates: ONE_DEGREE_NORTH }),
    ]);

    expect(Array.from(result.values())).toEqual([
      { durationMinutes: ONE_DEGREE_MINUTES, distanceMiles: ONE_DEGREE_MILES, source: "ESTIMATED" },
    ]);
  });

  it("vuelve a la estimación local cuando la respuesta HTTP no es ok", async () => {
    fetchMock.mockResolvedValue(distanceMatrixResponse(liveElement, HTTP_SERVER_ERROR));

    const result = await travel.getTravelMetricsForPairs([pair()]);

    expect(Array.from(result.values())).toEqual([
      { durationMinutes: DEFAULT_DRIVE_MINUTES, distanceMiles: null, source: "ESTIMATED" },
    ]);
  });

  it("vuelve a la estimación local cuando el cuerpo no es JSON válido", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: HTTP_OK }));

    const result = await travel.getTravelMetricsForPairs([pair()]);

    expect(Array.from(result.values())[0]).toMatchObject({ source: "ESTIMATED" });
  });

  it("vuelve a la estimación local cuando fetch lanza una excepción", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const result = await travel.getTravelMetricsForPairs([pair()]);

    expect(Array.from(result.values())).toEqual([
      { durationMinutes: DEFAULT_DRIVE_MINUTES, distanceMiles: null, source: "ESTIMATED" },
    ]);
  });

  it("resuelve todos los pares distintos con una petición por par", async () => {
    fetchMock.mockResolvedValue(distanceMatrixResponse(liveElement));
    const pairCount = 8;
    const pairs = Array.from({ length: pairCount }, (_, index) =>
      pair({ toAddress: `Destino ${index}` })
    );

    const result = await travel.getTravelMetricsForPairs(pairs);

    expect(fetchMock).toHaveBeenCalledTimes(pairCount);
    expect(result.size).toBe(pairCount);
  });
});

describe("getTravelMetricsForPairs: caché con TTL", () => {
  const START_TIME = new Date("2026-09-21T12:00:00.000Z");

  beforeEach(() => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", API_KEY);
    vi.setSystemTime(START_TIME);
    fetchMock.mockResolvedValue(
      distanceMatrixResponse({ status: "OK", duration: { value: 600 } })
    );
  });

  it("reutiliza la métrica dentro del TTL sin volver a llamar a fetch", async () => {
    await travel.getTravelMetricsForPairs([pair()]);
    vi.setSystemTime(new Date(START_TIME.getTime() + CACHE_TTL_MS - 1));
    const second = await travel.getTravelMetricsForPairs([pair()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(Array.from(second.values())[0]).toMatchObject({ source: "LIVE_TRAFFIC" });
  });

  it("vuelve a consultar cuando el TTL de 3 minutos ha expirado", async () => {
    await travel.getTravelMetricsForPairs([pair()]);
    vi.setSystemTime(new Date(START_TIME.getTime() + CACHE_TTL_MS));
    await travel.getTravelMetricsForPairs([pair()]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("la caché se indexa solo por direcciones e ignora coordenadas distintas", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "");
    const first = await travel.getTravelMetricsForPairs([
      pair({ fromCoordinates: EQUATOR, toCoordinates: ONE_DEGREE_NORTH }),
    ]);
    const second = await travel.getTravelMetricsForPairs([
      pair({ fromCoordinates: EQUATOR, toCoordinates: SHORT_HOP }),
    ]);

    expect(Array.from(first.values())[0]).toMatchObject({ distanceMiles: ONE_DEGREE_MILES });
    expect(Array.from(second.values())[0]).toMatchObject({ distanceMiles: ONE_DEGREE_MILES });
  });

  it("también cachea el fallback estimado cuando Google falla", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    await travel.getTravelMetricsForPairs([pair()]);
    await travel.getTravelMetricsForPairs([pair()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
