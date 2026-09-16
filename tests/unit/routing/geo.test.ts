/**
 * Tests de caracterización de src/lib/routing/geo.ts.
 * Fijan el comportamiento ACTUAL de geocodeAddresses antes del refactor.
 * El módulo mantiene una caché global sin TTL, así que se recarga con
 * vi.resetModules() antes de cada test para aislarlos.
 * No se hacen peticiones reales: fetch se sustituye con vi.stubGlobal.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeoPoint } from "@/lib/routing/geo";

type GeoModule = typeof import("@/lib/routing/geo");

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

const fetchMock = vi.fn<typeof fetch>();

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
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GOOGLE_MAPS_SERVER_API_KEY", "");
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "");
  geo = await loadGeoModule();
});

afterEach(() => {
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

  // Sospecha de bug: geocodeSingle comprueba key.trim() pero envía la key SIN
  // recortar (a diferencia de travel.ts y address.ts, que sí la recortan).
  it.fails("recorta los espacios de la API key antes de enviarla a Google", async () => {
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
