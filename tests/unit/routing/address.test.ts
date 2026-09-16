/**
 * Tests de caracterización de src/lib/routing/address.ts.
 * Fijan el comportamiento ACTUAL de normalizePropertyAddress antes del refactor.
 * No se hacen peticiones reales: fetch se sustituye con vi.stubGlobal.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizePropertyAddress } from "@/lib/routing/address";

const GEOCODE_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";
const RAW_ADDRESS = "  123   Main St,\n Miami,\t  FL  ";
const NORMALIZED_ADDRESS = "123 Main St, Miami, FL";
const FORMATTED_ADDRESS = "123 Main St, Miami, FL 33101, USA";
const API_KEY = "test-google-key";
const SERVER_API_KEY = "server-google-key";
const HTTP_OK = 200;
const HTTP_SERVER_ERROR = 500;

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = HTTP_OK): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function geocodeResponse(formattedAddress: unknown): Response {
  return jsonResponse({
    status: "OK",
    results: [{ formatted_address: formattedAddress }],
  });
}

function requestedUrl(callIndex = 0): URL {
  const call = fetchMock.mock.calls[callIndex];
  if (!call) {
    throw new Error(`fetch no fue invocado ${callIndex + 1} veces`);
  }
  return new URL(String(call[0]));
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GOOGLE_MAPS_SERVER_API_KEY", "");
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("normalizePropertyAddress sin API key de Google", () => {
  it("devuelve cadena vacía para una entrada vacía", async () => {
    const result = await normalizePropertyAddress("");

    expect(result).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("devuelve cadena vacía cuando la entrada solo contiene espacios", async () => {
    const result = await normalizePropertyAddress(" \n\t  ");

    expect(result).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("recorta extremos y colapsa espacios internos sin llamar a Google", async () => {
    const result = await normalizePropertyAddress(RAW_ADDRESS);

    expect(result).toBe(NORMALIZED_ADDRESS);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("devuelve la dirección intacta cuando ya está normalizada", async () => {
    const result = await normalizePropertyAddress(NORMALIZED_ADDRESS);

    expect(result).toBe(NORMALIZED_ADDRESS);
  });

  it("trata una API key compuesta solo por espacios como ausente", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "   ");

    const result = await normalizePropertyAddress(RAW_ADDRESS);

    expect(result).toBe(NORMALIZED_ADDRESS);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("normalizePropertyAddress con API key de Google", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", API_KEY);
  });

  it("envía la dirección normalizada, la key y region=us al endpoint de geocode", async () => {
    fetchMock.mockResolvedValue(geocodeResponse(FORMATTED_ADDRESS));

    await normalizePropertyAddress(RAW_ADDRESS);

    const url = requestedUrl();
    expect(`${url.origin}${url.pathname}`).toBe(GEOCODE_ENDPOINT);
    expect(url.searchParams.get("address")).toBe(NORMALIZED_ADDRESS);
    expect(url.searchParams.get("key")).toBe(API_KEY);
    expect(url.searchParams.get("region")).toBe("us");
  });

  it("realiza la petición con cache: no-store", async () => {
    fetchMock.mockResolvedValue(geocodeResponse(FORMATTED_ADDRESS));

    await normalizePropertyAddress(RAW_ADDRESS);

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init).toMatchObject({ cache: "no-store" });
  });

  it("prefiere GOOGLE_MAPS_SERVER_API_KEY sobre GOOGLE_MAPS_API_KEY y la recorta", async () => {
    vi.stubEnv("GOOGLE_MAPS_SERVER_API_KEY", `  ${SERVER_API_KEY}  `);
    fetchMock.mockResolvedValue(geocodeResponse(FORMATTED_ADDRESS));

    await normalizePropertyAddress(RAW_ADDRESS);

    expect(requestedUrl().searchParams.get("key")).toBe(SERVER_API_KEY);
  });

  it("recorta los espacios de GOOGLE_MAPS_API_KEY antes de enviarla", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", `\n${API_KEY}\n`);
    fetchMock.mockResolvedValue(geocodeResponse(FORMATTED_ADDRESS));

    await normalizePropertyAddress(RAW_ADDRESS);

    expect(requestedUrl().searchParams.get("key")).toBe(API_KEY);
  });

  it("devuelve el formatted_address de Google", async () => {
    fetchMock.mockResolvedValue(geocodeResponse(FORMATTED_ADDRESS));

    const result = await normalizePropertyAddress(RAW_ADDRESS);

    expect(result).toBe(FORMATTED_ADDRESS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("colapsa los espacios del formatted_address devuelto por Google", async () => {
    fetchMock.mockResolvedValue(geocodeResponse("  123 Main   St,\nMiami  "));

    const result = await normalizePropertyAddress(RAW_ADDRESS);

    expect(result).toBe("123 Main St, Miami");
  });

  it("vuelve a la dirección normalizada cuando la respuesta HTTP no es ok", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ status: "OK", results: [] }, HTTP_SERVER_ERROR)
    );

    const result = await normalizePropertyAddress(RAW_ADDRESS);

    expect(result).toBe(NORMALIZED_ADDRESS);
  });

  it("vuelve a la dirección normalizada cuando el cuerpo no es JSON válido", async () => {
    fetchMock.mockResolvedValue(new Response("<html>oops</html>", { status: HTTP_OK }));

    const result = await normalizePropertyAddress(RAW_ADDRESS);

    expect(result).toBe(NORMALIZED_ADDRESS);
  });

  it("vuelve a la dirección normalizada cuando Google no devuelve resultados", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: "ZERO_RESULTS", results: [] }));

    const result = await normalizePropertyAddress(RAW_ADDRESS);

    expect(result).toBe(NORMALIZED_ADDRESS);
  });

  it("vuelve a la dirección normalizada cuando formatted_address no es una cadena", async () => {
    fetchMock.mockResolvedValue(geocodeResponse({ street: "Main" }));

    const result = await normalizePropertyAddress(RAW_ADDRESS);

    expect(result).toBe(NORMALIZED_ADDRESS);
  });

  it("vuelve a la dirección normalizada cuando formatted_address solo tiene espacios", async () => {
    fetchMock.mockResolvedValue(geocodeResponse("   "));

    const result = await normalizePropertyAddress(RAW_ADDRESS);

    expect(result).toBe(NORMALIZED_ADDRESS);
  });

  it("vuelve a la dirección normalizada cuando fetch lanza una excepción", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const result = await normalizePropertyAddress(RAW_ADDRESS);

    expect(result).toBe(NORMALIZED_ADDRESS);
  });

  it("no consulta a Google cuando la entrada queda vacía tras normalizar", async () => {
    const result = await normalizePropertyAddress("   ");

    expect(result).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
