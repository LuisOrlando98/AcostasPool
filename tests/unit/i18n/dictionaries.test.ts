import { describe, expect, it, vi } from "vitest";
import type { Locale } from "@/i18n/config";
import { getMessages, isMessagesLoaded, loadMessages } from "@/i18n/dictionaries";

/**
 * Cada caso que necesite el mapa vacío importa una copia nueva del módulo:
 * el mapa de diccionarios cargados vive en el ámbito del módulo.
 */
async function importFreshDictionaries() {
  vi.resetModules();
  return import("@/i18n/dictionaries");
}

describe("loadMessages", () => {
  it("loads only the requested locale dictionary", async () => {
    const fresh = await importFreshDictionaries();

    await fresh.loadMessages("es");

    expect(fresh.isMessagesLoaded("es")).toBe(true);
    expect(fresh.isMessagesLoaded("en")).toBe(false);
  });

  it("returns the dictionary of the given locale", async () => {
    const en = await loadMessages("en");
    const es = await loadMessages("es");

    expect(en.notifications.jobCompleted).toBe("Job completed");
    expect(es.notifications.jobCompleted).toBe("Trabajo completado");
  });

  it("returns the same instance on every call (cached)", async () => {
    const first = await loadMessages("en");
    const second = await loadMessages("en");

    expect(second).toBe(first);
  });

  it("falls back to English for an unknown locale", async () => {
    expect(await loadMessages("fr" as Locale)).toBe(await loadMessages("en"));
  });
});

describe("getMessages", () => {
  it("fails explicitly when the locale has not been loaded yet", async () => {
    const fresh = await importFreshDictionaries();

    expect(() => fresh.getMessages("es")).toThrow(/no está cargado/);
  });

  it("returns the dictionary once the locale is loaded", async () => {
    const fresh = await importFreshDictionaries();
    const loaded = await fresh.loadMessages("es");

    expect(fresh.getMessages("es")).toBe(loaded);
  });

  it("resolves an unknown locale through the loaded default locale", async () => {
    await loadMessages("en");

    expect(getMessages("fr" as Locale)).toBe(await loadMessages("en"));
    expect(isMessagesLoaded("fr" as Locale)).toBe(true);
  });
});
