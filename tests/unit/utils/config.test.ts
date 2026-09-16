import { describe, expect, it } from "vitest";
import {
  LOCALE_COOKIE,
  defaultLocale,
  locales,
  normalizeLocale,
} from "@/i18n/config";

describe("i18n config constants", () => {
  it("supports exactly en and es, in that order", () => {
    expect(locales).toEqual(["en", "es"]);
  });

  it("defaults to English", () => {
    expect(defaultLocale).toBe("en");
  });

  it("stores the locale in the ap_locale cookie", () => {
    expect(LOCALE_COOKIE).toBe("ap_locale");
  });
});

describe("normalizeLocale", () => {
  it.each([
    ["en", "en"],
    ["EN", "en"],
    ["es", "es"],
    ["Es", "es"],
    ["ES", "es"],
  ])("normalizes %p to %p", (raw, expected) => {
    expect(normalizeLocale(raw)).toBe(expected);
  });

  it("returns the default locale for null, undefined and empty string", () => {
    expect(normalizeLocale(null)).toBe("en");
    expect(normalizeLocale(undefined)).toBe("en");
    expect(normalizeLocale()).toBe("en");
    expect(normalizeLocale("")).toBe("en");
  });

  it("returns the default locale for unsupported languages", () => {
    expect(normalizeLocale("fr")).toBe("en");
    expect(normalizeLocale("pt-BR")).toBe("en");
  });

  it("does not match region-qualified or padded values (strict equality)", () => {
    expect(normalizeLocale("es-MX")).toBe("en");
    expect(normalizeLocale(" es")).toBe("en");
    expect(normalizeLocale("es ")).toBe("en");
  });
});
