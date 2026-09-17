/**
 * Tests de src/lib/routing/geo.ts (geocodeAddresses y geocodeProperties).
 * El módulo mantiene una caché global (con TTL y cota), así que se recarga con
 * vi.resetModules() antes de cada test para aislarlos.
 * No se hacen peticiones reales: fetch se sustituye con vi.stubGlobal y prisma
 * (@/lib/db) se mockea para verificar la persistencia de coordenadas.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeocodableProperty, GeoPoint } from "@/lib/routing/geo";

type GeoModule = typeof import("@/lib/routing/geo");

const dbMock = vi.hoisted(() => ({
  propertyUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { property: { update: dbMock.propertyUpdate } },
}));

const GOOGLE_GEOCODE_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";
const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_USER_AGENT = "AcostasPool-RouteAssistant/1.0";
const ADDRESS = "10731 SW 147th Ct, Miami, FL 33196";
const MIAMI_POINT: GeoPoint = { lat: 25.6549, lng: -80.431 };
const API_KEY = "google-key";
const SERVER_API_KEY = "server-key";
const HTTP_OK = 200;
const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;
const OUT_OF_RANGE_LATITUDE = 91;
const FETCH_DELAY_MS = 5;

const fetchMock = vi.fn<typeof fetch>();

/** Cuenta cuántas peticiones fetch hay en vuelo a la vez (respuesta fresca por llamada). */
function trackInFlightRequests(respond: () => Response) {
  const tracker = { inFlight: 0, maxInFlight: 0 };
  fetchMock.mockImplementation(async () => {
    tracker.inFlight += 1;
    tracker.maxInFlight = Math.max(tracker.maxInFlight, tracker.inFlight);
    await new Promise((resolve) => setTimeout(resolve, FETCH_DELAY_MS));
    tracker.inFlight -= 1;
    return respond();
  });
  return tracker;
}

function jsonResponse(body: unknown, status = HTTP_OK): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function googleResponse(location: unknown): Response {
  return jsonResponse({ results: [{ geometry: { location } }] });
}

function nominatimResponse(entries: Array<{ lat?: string; lon?: string }>): Response {
  return jsonResponse(entries);
}

function requestedUrl(callIndex = 0): URL {
  const call = fetchMock.mock.calls[callIndex];
  if (!call) {
    throw new Error(`fetch no fue invocado ${callIndex + 1} veces`);
  }
  return new URL(String(call[0]));
}

function requestedEndpoint(callIndex = 0): string {
  const url = requestedUrl(callIndex);
  return `${url.origin}${url.pathname}`;
}

async function loadGeoModule(): Promise<GeoModule> {
  vi.resetModules();
  return import("@/lib/routing/geo");
}

let geo: GeoModule;

beforeEach(async () => {
  fetchMock.mockReset();
  dbMock.propertyUpdate.mockReset();
  dbMock.propertyUpdate.mockResolvedValue({});
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GOOGLE_MAPS_SERVER_API_KEY", "");
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "");
  geo = await loadGeoModule();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("geocodeAddresses: entradas", () => {
  it("devuelve un mapa vacío sin llamar a fetch cuando no hay direcciones", async () => {
    const result = await geo.geocodeAddresses([]);

    expect(result.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("descarta direcciones vacías o compuestas solo por espacios", async () => {
    const result = await geo.geocodeAddresses(["", "   ", "\n\t"]);

    expect(result.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("recorta y deduplica direcciones; la clave del resultado es la dirección recortada", async () => {
    fetchMock.mockResolvedValue(nominatimResponse([{ lat: "25.65", lon: "-80.43" }]));

    const result = await geo.geocodeAddresses([`  ${ADDRESS}  `, ADDRESS]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(Array.from(result.keys())).toEqual([ADDRESS]);
    expect(result.get(ADDRESS)).toEqual({ lat: 25.65, lng: -80.43 });
  });

  it("geocodifica cada dirección distinta con su propia petición", async () => {
    fetchMock
      .mockResolvedValueOnce(nominatimResponse([{ lat: "1", lon: "2" }]))
      .mockResolvedValueOnce(nominatimResponse([{ lat: "3", lon: "4" }]));

    const result = await geo.geocodeAddresses(["Primera 1", "Segunda 2"]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.get("Primera 1")).toEqual({ lat: 1, lng: 2 });
    expect(result.get("Segunda 2")).toEqual({ lat: 3, lng: 4 });
  });
});

describe("geocodeAddresses sin API key (Nominatim)", () => {
  it("consulta Nominatim con q, format=jsonv2, limit=1 y User-Agent propio", async () => {
    fetchMock.mockResolvedValue(nominatimResponse([{ lat: "25.65", lon: "-80.43" }]));

    await geo.geocodeAddresses([ADDRESS]);

    const url = requestedUrl();
    expect(requestedEndpoint()).toBe(NOMINATIM_ENDPOINT);
    expect(url.searchParams.get("q")).toBe(ADDRESS);
    expect(url.searchParams.get("format")).toBe("jsonv2");
    expect(url.searchParams.get("limit")).toBe("1");
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init).toMatchObject({
      cache: "no-store",
      headers: { "User-Agent": NOMINATIM_USER_AGENT },
    });
  });

  it("convierte lat/lon de Nominatim (cadenas) a números", async () => {
    fetchMock.mockResolvedValue(
      nominatimResponse([{ lat: "25.6549", lon: "-80.4310" }])
    );

    const result = await geo.geocodeAddresses([ADDRESS]);

    expect(result.get(ADDRESS)).toEqual(MIAMI_POINT);
  });

  it("devuelve null cuando Nominatim no encuentra resultados", async () => {
    fetchMock.mockResolvedValue(nominatimResponse([]));

    const result = await geo.geocodeAddresses([ADDRESS]);

    expect(result.get(ADDRESS)).toBeNull();
  });

  it("devuelve null cuando la respuesta HTTP de Nominatim no es ok", async () => {
    fetchMock.mockResolvedValue(jsonResponse([], HTTP_TOO_MANY_REQUESTS));

    const result = await geo.geocodeAddresses([ADDRESS]);

    expect(result.get(ADDRESS)).toBeNull();
  });

  it("devuelve null cuando el cuerpo de Nominatim no es JSON válido", async () => {
    fetchMock.mockResolvedValue(new Response("<html/>", { status: HTTP_OK }));

    const result = await geo.geocodeAddresses([ADDRESS]);

    expect(result.get(ADDRESS)).toBeNull();
  });

  it("devuelve null cuando lat/lon no son numéricos", async () => {
    fetchMock.mockResolvedValue(nominatimResponse([{ lat: "norte", lon: "-80" }]));

    const result = await geo.geocodeAddresses([ADDRESS]);

    expect(result.get(ADDRESS)).toBeNull();
  });

  it("devuelve null cuando falta lon en el resultado", async () => {
    fetchMock.mockResolvedValue(nominatimResponse([{ lat: "25.65" }]));

    const result = await geo.geocodeAddresses([ADDRESS]);

    expect(result.get(ADDRESS)).toBeNull();
  });

  it("devuelve null cuando la latitud está fuera de rango", async () => {
    fetchMock.mockResolvedValue(
      nominatimResponse([{ lat: String(OUT_OF_RANGE_LATITUDE), lon: "0" }])
    );

    const result = await geo.geocodeAddresses([ADDRESS]);

    expect(result.get(ADDRESS)).toBeNull();
  });

  it("devuelve null y no propaga el error cuando fetch lanza", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const result = await geo.geocodeAddresses([ADDRESS]);

    expect(result.get(ADDRESS)).toBeNull();
  });
});

describe("geocodeAddresses con API key (Google primero)", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", API_KEY);
  });

  it("consulta Google con address y key, y no llama a Nominatim si hay resultado", async () => {
    fetchMock.mockResolvedValue(googleResponse(MIAMI_POINT));

    const result = await geo.geocodeAddresses([ADDRESS]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestedEndpoint()).toBe(GOOGLE_GEOCODE_ENDPOINT);
    const url = requestedUrl();
    expect(url.searchParams.get("address")).toBe(ADDRESS);
    expect(url.searchParams.get("key")).toBe(API_KEY);
    expect(result.get(ADDRESS)).toEqual(MIAMI_POINT);
  });

  it("acepta coordenadas de Google expresadas como cadenas numéricas", async () => {
    fetchMock.mockResolvedValue(googleResponse({ lat: "25.6549", lng: "-80.431" }));

    const result = await geo.geocodeAddresses([ADDRESS]);

    expect(result.get(ADDRESS)).toEqual(MIAMI_POINT);
  });

  it("prefiere GOOGLE_MAPS_SERVER_API_KEY sobre GOOGLE_MAPS_API_KEY", async () => {
    vi.stubEnv("GOOGLE_MAPS_SERVER_API_KEY", SERVER_API_KEY);
    fetchMock.mockResolvedValue(googleResponse(MIAMI_POINT));

    await geo.geocodeAddresses([ADDRESS]);

    expect(requestedUrl().searchParams.get("key")).toBe(SERVER_API_KEY);
  });

  // Bug corregido: la key se lee ya recortada desde getGoogleMapsServerApiKey,
  // el mismo helper que usan travel.ts y address.ts.
  it("recorta los espacios de la API key antes de enviarla a Google", async () => {
    vi.stubEnv("GOOGLE_MAPS_SERVER_API_KEY", `  ${SERVER_API_KEY}  `);
    fetchMock.mockResolvedValue(googleResponse(MIAMI_POINT));

    await geo.geocodeAddresses([ADDRESS]);

    expect(requestedUrl().searchParams.get("key")).toBe(SERVER_API_KEY);
  });

  it("recurre a Nominatim cuando la respuesta HTTP de Google no es ok", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ results: [] }, HTTP_FORBIDDEN))
      .mockResolvedValueOnce(nominatimResponse([{ lat: "1", lon: "2" }]));

    const result = await geo.geocodeAddresses([ADDRESS]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestedEndpoint(0)).toBe(GOOGLE_GEOCODE_ENDPOINT);
    expect(requestedEndpoint(1)).toBe(NOMINATIM_ENDPOINT);
    expect(result.get(ADDRESS)).toEqual({ lat: 1, lng: 2 });
  });

  it("recurre a Nominatim cuando Google no devuelve resultados", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(nominatimResponse([{ lat: "1", lon: "2" }]));

    const result = await geo.geocodeAddresses([ADDRESS]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.get(ADDRESS)).toEqual({ lat: 1, lng: 2 });
  });

  it("recurre a Nominatim cuando Google devuelve coordenadas fuera de rango", async () => {
    fetchMock
      .mockResolvedValueOnce(googleResponse({ lat: OUT_OF_RANGE_LATITUDE, lng: 0 }))
      .mockResolvedValueOnce(nominatimResponse([{ lat: "1", lon: "2" }]));

    const result = await geo.geocodeAddresses([ADDRESS]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.get(ADDRESS)).toEqual({ lat: 1, lng: 2 });
  });

  it("devuelve null cuando tanto Google como Nominatim fallan", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("oops", { status: HTTP_OK }))
      .mockResolvedValueOnce(nominatimResponse([]));

    const result = await geo.geocodeAddresses([ADDRESS]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.get(ADDRESS)).toBeNull();
  });
});

describe("geocodeAddresses: caché en memoria", () => {
  it("reutiliza el resultado para variantes de espacios y mayúsculas sin volver a fetch", async () => {
    fetchMock.mockResolvedValue(nominatimResponse([{ lat: "25.65", lon: "-80.43" }]));

    const first = await geo.geocodeAddresses([ADDRESS]);
    const second = await geo.geocodeAddresses([ADDRESS.toUpperCase().replace(/ /g, "   ")]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.get(ADDRESS)).toEqual({ lat: 25.65, lng: -80.43 });
    expect(Array.from(second.values())).toEqual([{ lat: 25.65, lng: -80.43 }]);
  });

  it("también cachea los resultados null y no reintenta en la siguiente llamada", async () => {
    fetchMock.mockResolvedValue(nominatimResponse([]));

    await geo.geocodeAddresses([ADDRESS]);
    const second = await geo.geocodeAddresses([ADDRESS]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.get(ADDRESS)).toBeNull();
  });

  it("la caché es independiente entre recargas del módulo", async () => {
    fetchMock.mockResolvedValue(nominatimResponse([{ lat: "1", lon: "1" }]));
    await geo.geocodeAddresses([ADDRESS]);

    const freshGeo = await loadGeoModule();
    await freshGeo.geocodeAddresses([ADDRESS]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("geocodeAddresses: concurrencia", () => {
  const ADDRESS_COUNT = 10;
  const addresses = Array.from({ length: ADDRESS_COUNT }, (_, index) => `Calle ${index}`);

  it("con API key geocodifica en paralelo hasta GEOCODE_CONCURRENCY peticiones", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", API_KEY);
    const tracker = trackInFlightRequests(() => googleResponse(MIAMI_POINT));

    const result = await geo.geocodeAddresses(addresses);

    expect(fetchMock).toHaveBeenCalledTimes(ADDRESS_COUNT);
    expect(tracker.maxInFlight).toBe(geo.GEOCODE_CONCURRENCY);
    expect(Array.from(result.values())).toEqual(addresses.map(() => MIAMI_POINT));
  });

  it("sin API key consulta Nominatim de una en una (política de 1 petición/s)", async () => {
    const tracker = trackInFlightRequests(() => nominatimResponse([{ lat: "1", lon: "2" }]));

    await geo.geocodeAddresses(addresses);

    expect(fetchMock).toHaveBeenCalledTimes(ADDRESS_COUNT);
    expect(geo.NOMINATIM_CONCURRENCY).toBe(1);
    expect(tracker.maxInFlight).toBe(geo.NOMINATIM_CONCURRENCY);
  });

  it("geocodifica una sola vez las variantes que normalizan a la misma clave en la misma llamada", async () => {
    fetchMock.mockResolvedValue(nominatimResponse([{ lat: "1", lon: "2" }]));

    const result = await geo.geocodeAddresses([ADDRESS, ADDRESS.toUpperCase()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.get(ADDRESS)).toEqual({ lat: 1, lng: 2 });
    expect(result.get(ADDRESS.toUpperCase())).toEqual({ lat: 1, lng: 2 });
  });
});

describe("geocodeAddresses: TTL y cota de la caché", () => {
  const START_TIME = new Date("2026-09-21T12:00:00.000Z");

  beforeEach(() => {
    vi.setSystemTime(START_TIME);
  });

  it("reutiliza un acierto dentro del TTL y vuelve a consultar cuando expira", async () => {
    fetchMock.mockImplementation(async () => nominatimResponse([{ lat: "1", lon: "2" }]));

    await geo.geocodeAddresses([ADDRESS]);
    vi.setSystemTime(new Date(START_TIME.getTime() + geo.GEOCODE_CACHE_TTL_MS - 1));
    await geo.geocodeAddresses([ADDRESS]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date(START_TIME.getTime() + geo.GEOCODE_CACHE_TTL_MS));
    const refreshed = await geo.geocodeAddresses([ADDRESS]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(refreshed.get(ADDRESS)).toEqual({ lat: 1, lng: 2 });
  });

  it("cachea los fallos solo durante el TTL corto y luego reintenta", async () => {
    fetchMock
      .mockResolvedValueOnce(nominatimResponse([]))
      .mockResolvedValueOnce(nominatimResponse([{ lat: "1", lon: "2" }]));

    const first = await geo.geocodeAddresses([ADDRESS]);
    vi.setSystemTime(
      new Date(START_TIME.getTime() + geo.GEOCODE_FAILURE_CACHE_TTL_MS - 1)
    );
    const second = await geo.geocodeAddresses([ADDRESS]);
    vi.setSystemTime(new Date(START_TIME.getTime() + geo.GEOCODE_FAILURE_CACHE_TTL_MS));
    const third = await geo.geocodeAddresses([ADDRESS]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(first.get(ADDRESS)).toBeNull();
    expect(second.get(ADDRESS)).toBeNull();
    expect(third.get(ADDRESS)).toEqual({ lat: 1, lng: 2 });
  });

  it("el TTL de los fallos es más corto que el de los aciertos", () => {
    expect(geo.GEOCODE_FAILURE_CACHE_TTL_MS).toBeLessThan(geo.GEOCODE_CACHE_TTL_MS);
  });

  it("expulsa la entrada más antigua al superar GEOCODE_CACHE_MAX_ENTRIES", async () => {
    fetchMock.mockImplementation(async () => nominatimResponse([{ lat: "1", lon: "2" }]));
    const addresses = Array.from(
      { length: geo.GEOCODE_CACHE_MAX_ENTRIES + 1 },
      (_, index) => `Calle ${index}`
    );

    await geo.geocodeAddresses(addresses);
    expect(fetchMock).toHaveBeenCalledTimes(addresses.length);

    // La segunda entrada sigue en caché...
    await geo.geocodeAddresses([addresses[1]]);
    expect(fetchMock).toHaveBeenCalledTimes(addresses.length);

    // ...pero la primera (la más antigua) fue expulsada y se vuelve a consultar.
    await geo.geocodeAddresses([addresses[0]]);
    expect(fetchMock).toHaveBeenCalledTimes(addresses.length + 1);
  });
});

describe("geocodeProperties", () => {
  const PROPERTY_ID = "prop-1";
  const OTHER_PROPERTY_ID = "prop-2";
  const OTHER_ADDRESS = "1 Ocean Dr, Miami Beach, FL 33139";
  const START_TIME = new Date("2026-09-21T12:00:00.000Z");
  const NOMINATIM_POINT: GeoPoint = { lat: 1, lng: 2 };

  function property(
    overrides: Partial<GeocodableProperty> & { id: string }
  ): GeocodableProperty {
    return { address: ADDRESS, lat: null, lng: null, geocodedAt: null, ...overrides };
  }

  function persistedProperty(id: string, geocodedAt: Date | null = START_TIME) {
    return property({ id, lat: MIAMI_POINT.lat, lng: MIAMI_POINT.lng, geocodedAt });
  }

  beforeEach(() => {
    vi.setSystemTime(START_TIME);
    fetchMock.mockImplementation(async () =>
      nominatimResponse([{ lat: String(NOMINATIM_POINT.lat), lon: String(NOMINATIM_POINT.lng) }])
    );
  });

  it("devuelve un mapa vacío sin consultar nada cuando no hay propiedades", async () => {
    const result = await geo.geocodeProperties([]);

    expect(result.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(dbMock.propertyUpdate).not.toHaveBeenCalled();
  });

  it("usa las coordenadas persistidas sin consultar la red ni escribir en la BD", async () => {
    const result = await geo.geocodeProperties([persistedProperty(PROPERTY_ID)]);

    expect(result.get(PROPERTY_ID)).toEqual(MIAMI_POINT);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(dbMock.propertyUpdate).not.toHaveBeenCalled();
  });

  it("acepta coordenadas persistidas sin geocodedAt (importadas) sin volver a geocodificar", async () => {
    const result = await geo.geocodeProperties([persistedProperty(PROPERTY_ID, null)]);

    expect(result.get(PROPERTY_ID)).toEqual(MIAMI_POINT);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("geocodifica solo las propiedades sin coordenadas y persiste lat, lng y geocodedAt", async () => {
    const result = await geo.geocodeProperties([
      persistedProperty(PROPERTY_ID),
      property({ id: OTHER_PROPERTY_ID, address: OTHER_ADDRESS }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestedUrl().searchParams.get("q")).toBe(OTHER_ADDRESS);
    expect(result.get(PROPERTY_ID)).toEqual(MIAMI_POINT);
    expect(result.get(OTHER_PROPERTY_ID)).toEqual(NOMINATIM_POINT);
    expect(dbMock.propertyUpdate).toHaveBeenCalledTimes(1);
    expect(dbMock.propertyUpdate).toHaveBeenCalledWith({
      where: { id: OTHER_PROPERTY_ID },
      data: { lat: NOMINATIM_POINT.lat, lng: NOMINATIM_POINT.lng, geocodedAt: START_TIME },
    });
  });

  it("no persiste los fallos y devuelve null para esa propiedad", async () => {
    fetchMock.mockImplementation(async () => nominatimResponse([]));

    const result = await geo.geocodeProperties([property({ id: PROPERTY_ID })]);

    expect(result.get(PROPERTY_ID)).toBeNull();
    expect(dbMock.propertyUpdate).not.toHaveBeenCalled();
  });

  it("deduplica las propiedades repetidas por id", async () => {
    const result = await geo.geocodeProperties([
      property({ id: PROPERTY_ID }),
      property({ id: PROPERTY_ID }),
    ]);

    expect(result.size).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(dbMock.propertyUpdate).toHaveBeenCalledTimes(1);
  });

  it("vuelve a geocodificar coordenadas persistidas más antiguas que el máximo permitido", async () => {
    const staleDate = new Date(
      START_TIME.getTime() - geo.PERSISTED_COORDINATES_MAX_AGE_MS - 1
    );

    const result = await geo.geocodeProperties([persistedProperty(PROPERTY_ID, staleDate)]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.get(PROPERTY_ID)).toEqual(NOMINATIM_POINT);
    expect(dbMock.propertyUpdate).toHaveBeenCalledWith({
      where: { id: PROPERTY_ID },
      data: { lat: NOMINATIM_POINT.lat, lng: NOMINATIM_POINT.lng, geocodedAt: START_TIME },
    });
  });

  it("conserva coordenadas persistidas justo dentro del máximo de antigüedad", async () => {
    const boundaryDate = new Date(
      START_TIME.getTime() - geo.PERSISTED_COORDINATES_MAX_AGE_MS
    );

    const result = await geo.geocodeProperties([persistedProperty(PROPERTY_ID, boundaryDate)]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.get(PROPERTY_ID)).toEqual(MIAMI_POINT);
  });

  it("vuelve a geocodificar coordenadas persistidas fuera de rango", async () => {
    const result = await geo.geocodeProperties([
      property({ id: PROPERTY_ID, lat: OUT_OF_RANGE_LATITUDE, lng: 0, geocodedAt: START_TIME }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.get(PROPERTY_ID)).toEqual(NOMINATIM_POINT);
  });

  it("devuelve null sin consultar la red para una propiedad con dirección vacía", async () => {
    const result = await geo.geocodeProperties([property({ id: PROPERTY_ID, address: "   " })]);

    expect(result.get(PROPERTY_ID)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(dbMock.propertyUpdate).not.toHaveBeenCalled();
  });

  it("no propaga un fallo al persistir y sigue devolviendo las coordenadas resueltas", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    dbMock.propertyUpdate.mockRejectedValue(new Error("db down"));

    const result = await geo.geocodeProperties([property({ id: PROPERTY_ID })]);

    expect(result.get(PROPERTY_ID)).toEqual(NOMINATIM_POINT);
    expect(consoleError).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it("espera a que terminen todas las escrituras antes de resolver", async () => {
    const PROPERTY_COUNT = 6;
    const properties = Array.from({ length: PROPERTY_COUNT }, (_, index) =>
      property({ id: `prop-${index}`, address: `Calle ${index}` })
    );

    const result = await geo.geocodeProperties(properties);

    expect(result.size).toBe(PROPERTY_COUNT);
    expect(dbMock.propertyUpdate).toHaveBeenCalledTimes(PROPERTY_COUNT);
  });
});
