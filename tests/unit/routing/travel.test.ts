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
const DESTINATION_SEPARATOR = "|";
const MAX_DESTINATIONS_PER_REQUEST = 25;
const MAX_ELEMENTS_PER_REQUEST = 100;
const FIVE_MILES_METERS = 5 * METERS_PER_MILE;
const FIVE_MILES = 5;
const LIVE_DURATION_MINUTES = 21;
const BASE_DURATION_MINUTES = 12;
const liveElement = {
  status: "OK",
  distance: { value: FIVE_MILES_METERS },
  duration: { value: BASE_DURATION_MINUTES * SECONDS_PER_MINUTE },
  duration_in_traffic: { value: LIVE_DURATION_MINUTES * SECONDS_PER_MINUTE },
};

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
const consoleErrorSpy = vi
  .spyOn(console, "error")
  .mockImplementation(() => undefined);

function jsonResponse(body: unknown, status = HTTP_OK): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function distanceMatrixResponse(element: Record<string, unknown>, status = HTTP_OK): Response {
  return jsonResponse({ status: "OK", rows: [{ elements: [element] }] }, status);
}

function matrixRowResponse(elements: Record<string, unknown>[]): Response {
  return jsonResponse({ status: "OK", rows: [{ elements }] });
}

function originsOf(url: URL): string[] {
  return (url.searchParams.get("origins") ?? "").split(DESTINATION_SEPARATOR);
}

function destinationsOf(url: URL): string[] {
  return (url.searchParams.get("destinations") ?? "").split(DESTINATION_SEPARATOR);
}

/** Responde a cada petición con un elemento OK por destino solicitado. */
function respondPerDestination(element: Record<string, unknown>): void {
  fetchMock.mockImplementation(async (input) =>
    matrixRowResponse(
      destinationsOf(new URL(String(input))).map(() => element)
    )
  );
}

function createDeferredResponse() {
  let settle: (value: Response) => void = () => undefined;
  const promise = new Promise<Response>((resolve) => {
    settle = resolve;
  });
  return { promise, resolve: (value: Response) => settle(value) };
}

function requestedUrls(): URL[] {
  return fetchMock.mock.calls.map((call) => new URL(String(call[0])));
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
  consoleErrorSpy.mockClear();
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

  it("resuelve todos los destinos de un mismo origen en una sola petición", async () => {
    respondPerDestination(liveElement);
    const pairCount = 8;
    const pairs = Array.from({ length: pairCount }, (_, index) =>
      pair({ toAddress: `Destino ${index}` })
    );

    const result = await travel.getTravelMetricsForPairs(pairs);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(destinationsOf(requestedUrl())).toHaveLength(pairCount);
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

describe("getTravelMetricsForPairs: agrupación por origen", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", API_KEY);
    respondPerDestination(liveElement);
  });

  it("emite una petición por origen distinto con un único origen cada una", async () => {
    const origins = ["Origen A", "Origen B", "Origen C"];
    const destinationsPerOrigin = 4;
    const pairs = origins.flatMap((fromAddress) =>
      Array.from({ length: destinationsPerOrigin }, (_, index) =>
        pair({ fromAddress, toAddress: `Destino ${index}` })
      )
    );

    const result = await travel.getTravelMetricsForPairs(pairs);

    expect(fetchMock).toHaveBeenCalledTimes(origins.length);
    expect(result.size).toBe(origins.length * destinationsPerOrigin);
    const requestedOrigins = requestedUrls().map((url) => originsOf(url));
    expect(requestedOrigins.map((list) => list.length)).toEqual([1, 1, 1]);
    expect(requestedOrigins.flat().sort()).toEqual([...origins].sort());
    expect(
      requestedUrls().map((url) => destinationsOf(url).length)
    ).toEqual([destinationsPerOrigin, destinationsPerOrigin, destinationsPerOrigin]);
  });

  it("agrupa el mismo origen aunque difieran espacios y mayúsculas", async () => {
    await travel.getTravelMetricsForPairs([
      pair({ fromAddress: ORIGIN_ADDRESS, toAddress: "Destino 1" }),
      pair({ fromAddress: `  ${ORIGIN_ADDRESS.toUpperCase()} `, toAddress: "Destino 2" }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(destinationsOf(requestedUrl())).toEqual(["Destino 1", "Destino 2"]);
  });

  it("trocea a 25 destinos por petición y nunca supera los 100 elementos", async () => {
    const destinationCount = 57;
    const pairs = Array.from({ length: destinationCount }, (_, index) =>
      pair({ toAddress: `Destino ${index}` })
    );

    const result = await travel.getTravelMetricsForPairs(pairs);

    const sizes = requestedUrls().map((url) => destinationsOf(url).length);
    expect(sizes).toEqual([
      MAX_DESTINATIONS_PER_REQUEST,
      MAX_DESTINATIONS_PER_REQUEST,
      destinationCount - 2 * MAX_DESTINATIONS_PER_REQUEST,
    ]);
    for (const url of requestedUrls()) {
      expect(destinationsOf(url).length).toBeLessThanOrEqual(MAX_DESTINATIONS_PER_REQUEST);
      expect(originsOf(url).length * destinationsOf(url).length).toBeLessThanOrEqual(
        MAX_ELEMENTS_PER_REQUEST
      );
    }
    expect(result.size).toBe(destinationCount);
  });

  it("mantiene departure_time=now y el resto de parámetros en el lote agrupado", async () => {
    await travel.getTravelMetricsForPairs([
      pair({ toAddress: "Destino 1" }),
      pair({ toAddress: "Destino 2" }),
    ]);

    const url = requestedUrl();
    expect(`${url.origin}${url.pathname}`).toBe(DISTANCE_MATRIX_ENDPOINT);
    expect(url.searchParams.get("departure_time")).toBe("now");
    expect(url.searchParams.get("traffic_model")).toBe("best_guess");
    expect(url.searchParams.get("units")).toBe("imperial");
    expect(url.searchParams.get("region")).toBe("us");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ cache: "no-store" });
  });

  it("estima solo los pares sin datos ante elementos ZERO_RESULTS o NOT_FOUND", async () => {
    fetchMock.mockResolvedValue(
      matrixRowResponse([
        liveElement,
        { status: "ZERO_RESULTS" },
        { status: "NOT_FOUND" },
      ])
    );
    const pairs = [
      pair({
        toAddress: "Destino vivo",
        fromCoordinates: EQUATOR,
        toCoordinates: ONE_DEGREE_NORTH,
      }),
      pair({
        toAddress: "Destino sin ruta",
        fromCoordinates: EQUATOR,
        toCoordinates: ONE_DEGREE_NORTH,
      }),
      pair({
        toAddress: "Destino inexistente",
        fromCoordinates: EQUATOR,
        toCoordinates: SHORT_HOP,
      }),
    ];

    const result = await travel.getTravelMetricsForPairs(pairs);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.get(travel.getAddressPairKey(ORIGIN_ADDRESS, "Destino vivo"))).toEqual({
      durationMinutes: LIVE_DURATION_MINUTES,
      distanceMiles: FIVE_MILES,
      source: "LIVE_TRAFFIC",
    });
    expect(result.get(travel.getAddressPairKey(ORIGIN_ADDRESS, "Destino sin ruta"))).toEqual({
      durationMinutes: ONE_DEGREE_MINUTES,
      distanceMiles: ONE_DEGREE_MILES,
      source: "ESTIMATED",
    });
    expect(result.get(travel.getAddressPairKey(ORIGIN_ADDRESS, "Destino inexistente"))).toEqual({
      durationMinutes: MIN_ESTIMATED_MINUTES,
      distanceMiles: SHORT_HOP_MILES,
      source: "ESTIMATED",
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("estima los pares sin elemento cuando la fila viene incompleta", async () => {
    fetchMock.mockResolvedValue(matrixRowResponse([liveElement]));

    const result = await travel.getTravelMetricsForPairs([
      pair({ toAddress: "Destino vivo" }),
      pair({
        toAddress: "Destino ausente",
        fromCoordinates: EQUATOR,
        toCoordinates: ONE_DEGREE_NORTH,
      }),
    ]);

    expect(result.get(travel.getAddressPairKey(ORIGIN_ADDRESS, "Destino vivo"))).toMatchObject({
      source: "LIVE_TRAFFIC",
    });
    expect(result.get(travel.getAddressPairKey(ORIGIN_ADDRESS, "Destino ausente"))).toEqual({
      durationMinutes: ONE_DEGREE_MINUTES,
      distanceMiles: ONE_DEGREE_MILES,
      source: "ESTIMATED",
    });
  });
});

describe("getTravelMetricsForPairs: registro de fallos por lote", () => {
  const BATCH_PAIRS = 3;

  beforeEach(() => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", API_KEY);
  });

  function batchPairs(fromAddress: string): AddressPairInput[] {
    return Array.from({ length: BATCH_PAIRS }, (_, index) =>
      pair({ fromAddress, toAddress: `Destino ${index}` })
    );
  }

  it("registra un único console.error por lote fallido, no uno por par", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const result = await travel.getTravelMetricsForPairs(batchPairs(ORIGIN_ADDRESS));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(result.size).toBe(BATCH_PAIRS);
    expect(Array.from(result.values()).every((metric) => metric.source === "ESTIMATED")).toBe(true);
  });

  it("no incluye la API key ni las direcciones en el mensaje", async () => {
    fetchMock.mockResolvedValue(distanceMatrixResponse(liveElement, HTTP_SERVER_ERROR));

    await travel.getTravelMetricsForPairs([pair()]);

    const message = String(consoleErrorSpy.mock.calls[0]?.[0] ?? "");
    expect(message).toContain("[routing/travel]");
    expect(message).toContain(String(HTTP_SERVER_ERROR));
    expect(message).not.toContain(API_KEY);
    expect(message).not.toContain(ORIGIN_ADDRESS);
    expect(message).not.toContain(DESTINATION_ADDRESS);
  });

  it("registra un aviso por cada lote fallido cuando hay varios orígenes", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    await travel.getTravelMetricsForPairs([
      ...batchPairs("Origen A"),
      ...batchPairs("Origen B"),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
  });
});

describe("getTravelMetricsForPairs: coalescing de peticiones en vuelo", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", API_KEY);
  });

  it("dos llamadas concurrentes al mismo par comparten una única petición", async () => {
    const deferred = createDeferredResponse();
    fetchMock.mockReturnValue(deferred.promise);

    const first = travel.getTravelMetricsForPairs([pair()]);
    const second = travel.getTravelMetricsForPairs([pair()]);
    deferred.resolve(distanceMatrixResponse(liveElement));
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(Array.from(firstResult.values())[0]).toEqual({
      durationMinutes: LIVE_DURATION_MINUTES,
      distanceMiles: FIVE_MILES,
      source: "LIVE_TRAFFIC",
    });
    expect(Array.from(secondResult.values())[0]).toEqual(
      Array.from(firstResult.values())[0]
    );
  });

  it("solo consulta los pares que todavía no están en vuelo", async () => {
    const deferred = createDeferredResponse();
    fetchMock.mockReturnValueOnce(deferred.promise);
    respondPerDestination(liveElement);

    const first = travel.getTravelMetricsForPairs([
      pair({ toAddress: "Destino 1" }),
      pair({ toAddress: "Destino 2" }),
    ]);
    const second = travel.getTravelMetricsForPairs([
      pair({ toAddress: "Destino 2" }),
      pair({ toAddress: "Destino 3" }),
    ]);
    deferred.resolve(matrixRowResponse([liveElement, liveElement]));
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(destinationsOf(requestedUrl(1))).toEqual(["Destino 3"]);
    expect(firstResult.size).toBe(2);
    expect(secondResult.get(travel.getAddressPairKey(ORIGIN_ADDRESS, "Destino 2"))).toMatchObject({
      source: "LIVE_TRAFFIC",
    });
  });

  it("libera la petición en vuelo al terminar y luego sirve desde la caché", async () => {
    respondPerDestination(liveElement);

    await travel.getTravelMetricsForPairs([pair()]);
    await travel.getTravelMetricsForPairs([pair()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("getTravelMetricsForPairs: cota de la caché en memoria", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", API_KEY);
    fetchMock.mockResolvedValue(distanceMatrixResponse(liveElement));
  });

  /** Pares con origen y destino iguales: se cachean sin consultar a Google. */
  function fillerPairs(count: number): AddressPairInput[] {
    return Array.from({ length: count }, (_, index) => ({
      fromAddress: `Relleno ${index}`,
      toAddress: `Relleno ${index}`,
    }));
  }

  it("conserva las entradas mientras no se alcanza el tope", async () => {
    await travel.getTravelMetricsForPairs([pair()]);
    await travel.getTravelMetricsForPairs(
      fillerPairs(travel.TRAVEL_CACHE_MAX_ENTRIES - 2)
    );
    await travel.getTravelMetricsForPairs([pair()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("expulsa las entradas más antiguas en lugar de crecer sin límite", async () => {
    await travel.getTravelMetricsForPairs([pair()]);
    const fillers = await travel.getTravelMetricsForPairs(
      fillerPairs(travel.TRAVEL_CACHE_MAX_ENTRIES)
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fillers.size).toBe(travel.TRAVEL_CACHE_MAX_ENTRIES);

    await travel.getTravelMetricsForPairs([pair()]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("helpers exportados para el planificador", () => {
  const HALF_TURN_DEGREES = 180;

  it("expone 15 minutos como conducción por defecto", () => {
    expect(travel.DEFAULT_DRIVE_MINUTES).toBe(DEFAULT_DRIVE_MINUTES);
  });

  it("toRadians convierte grados a radianes", () => {
    expect(travel.toRadians(HALF_TURN_DEGREES)).toBeCloseTo(Math.PI, 10);
    expect(travel.toRadians(0)).toBe(0);
  });

  it("haversineMiles mide ≈ 69.09 millas por grado de latitud", () => {
    expect(travel.haversineMiles(EQUATOR, ONE_DEGREE_NORTH)).toBeCloseTo(ONE_DEGREE_MILES, 2);
    expect(travel.haversineMiles(EQUATOR, EQUATOR)).toBe(0);
  });

  it("estimateDriveMinutes devuelve 15 minutos cuando falta alguna coordenada", () => {
    expect(travel.estimateDriveMinutes(null, ONE_DEGREE_NORTH)).toBe(DEFAULT_DRIVE_MINUTES);
    expect(travel.estimateDriveMinutes(EQUATOR, null)).toBe(DEFAULT_DRIVE_MINUTES);
  });

  it("estimateDriveMinutes aplica 27 mph, factor 1.15 y un mínimo de 4 minutos", () => {
    expect(travel.estimateDriveMinutes(EQUATOR, ONE_DEGREE_NORTH)).toBe(ONE_DEGREE_MINUTES);
    expect(travel.estimateDriveMinutes(EQUATOR, SHORT_HOP)).toBe(MIN_ESTIMATED_MINUTES);
    expect(travel.estimateDriveMinutes(EQUATOR, NEGLIGIBLE_HOP)).toBe(MIN_ESTIMATED_MINUTES);
  });
});

describe("mapWithConcurrency", () => {
  const CONCURRENCY = 3;
  const TASK_DELAY_MS = 5;
  const ITEM_COUNT = 10;

  it("devuelve una lista vacía sin ejecutar tareas cuando no hay elementos", async () => {
    const task = vi.fn(async (value: number) => value);

    const result = await travel.mapWithConcurrency([], CONCURRENCY, task);

    expect(result).toEqual([]);
    expect(task).not.toHaveBeenCalled();
  });

  it("conserva el orden de los resultados aunque las tareas terminen desordenadas", async () => {
    const delays = [30, 5, 15, 1];

    const result = await travel.mapWithConcurrency(delays, CONCURRENCY, async (delay) => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return delay * 2;
    });

    expect(result).toEqual([60, 10, 30, 2]);
  });

  it("nunca supera la concurrencia indicada y procesa todos los elementos", async () => {
    const tracker = { inFlight: 0, maxInFlight: 0 };
    const items = Array.from({ length: ITEM_COUNT }, (_, index) => index);

    const result = await travel.mapWithConcurrency(items, CONCURRENCY, async (item) => {
      tracker.inFlight += 1;
      tracker.maxInFlight = Math.max(tracker.maxInFlight, tracker.inFlight);
      await new Promise((resolve) => setTimeout(resolve, TASK_DELAY_MS));
      tracker.inFlight -= 1;
      return item;
    });

    expect(result).toEqual(items);
    expect(tracker.maxInFlight).toBe(CONCURRENCY);
  });

  it("propaga el error cuando una tarea rechaza", async () => {
    await expect(
      travel.mapWithConcurrency([1, 2], CONCURRENCY, async (value) => {
        if (value === 2) {
          throw new Error("boom");
        }
        return value;
      })
    ).rejects.toThrow("boom");
  });
});
