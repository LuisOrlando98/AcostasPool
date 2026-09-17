/**
 * Tests de src/lib/routing/google-api-key.ts: única fuente de la API key de
 * Google Maps para geo.ts, travel.ts y address.ts.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { getGoogleMapsServerApiKey } from "@/lib/routing/google-api-key";

const SERVER_API_KEY = "server-key";
const API_KEY = "public-key";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getGoogleMapsServerApiKey", () => {
  it("devuelve null cuando no hay ninguna variable definida", () => {
    vi.stubEnv("GOOGLE_MAPS_SERVER_API_KEY", undefined);
    vi.stubEnv("GOOGLE_MAPS_API_KEY", undefined);

    expect(getGoogleMapsServerApiKey()).toBeNull();
  });

  it("trata las keys vacías o compuestas solo por espacios como ausentes", () => {
    vi.stubEnv("GOOGLE_MAPS_SERVER_API_KEY", "");
    vi.stubEnv("GOOGLE_MAPS_API_KEY", " \n\t ");

    expect(getGoogleMapsServerApiKey()).toBeNull();
  });

  it("prefiere GOOGLE_MAPS_SERVER_API_KEY y la recorta", () => {
    vi.stubEnv("GOOGLE_MAPS_SERVER_API_KEY", `  ${SERVER_API_KEY}  `);
    vi.stubEnv("GOOGLE_MAPS_API_KEY", API_KEY);

    expect(getGoogleMapsServerApiKey()).toBe(SERVER_API_KEY);
  });

  it("recurre a GOOGLE_MAPS_API_KEY recortada cuando la key de servidor está en blanco", () => {
    vi.stubEnv("GOOGLE_MAPS_SERVER_API_KEY", "   ");
    vi.stubEnv("GOOGLE_MAPS_API_KEY", `\n${API_KEY}\n`);

    expect(getGoogleMapsServerApiKey()).toBe(API_KEY);
  });
});
