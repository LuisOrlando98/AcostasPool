import { describe, expect, it } from "vitest";
import type { Locale } from "@/i18n/config";
import {
  getMessages,
  loadMessages,
  translate,
  type Messages,
} from "@/i18n/translate";

// Los diccionarios se cargan por locale (import dinámico); se precargan aquí
// para poder ejercitar después la vía síncrona `getMessages`.
const en = await loadMessages("en");
const es = await loadMessages("es");

const asMessages = (value: Record<string, unknown>) =>
  value as unknown as Messages;

describe("getMessages", () => {
  it("returns the English dictionary for 'en'", () => {
    expect(en.notifications.jobCompleted).toBe("Job completed");
  });

  it("returns the Spanish dictionary for 'es'", () => {
    expect(es.notifications.jobCompleted).toBe("Trabajo completado");
    expect(es).not.toBe(en);
  });

  it("falls back to English for an unknown locale", () => {
    expect(getMessages("fr" as Locale)).toBe(en);
  });

  it("returns the same dictionary instance on every call", () => {
    expect(getMessages("en")).toBe(en);
    expect(getMessages("es")).toBe(es);
  });
});

describe("translate", () => {
  it("resolves a nested key", () => {
    expect(translate(en, "notifications.jobCompleted")).toBe("Job completed");
    expect(translate(en, "notifications.source.team")).toBe("AcostasPool team");
  });

  it("uses the given dictionary", () => {
    expect(translate(es, "notifications.source.team")).toBe(
      "Equipo de AcostasPool"
    );
  });

  it("returns the key itself when it does not exist", () => {
    expect(translate(en, "notifications.doesNotExist")).toBe(
      "notifications.doesNotExist"
    );
    expect(translate(en, "nope.deep.key")).toBe("nope.deep.key");
  });

  it("returns the key when it resolves to an object instead of a string", () => {
    expect(translate(en, "notifications")).toBe("notifications");
    expect(translate(en, "notifications.source")).toBe("notifications.source");
  });

  it("returns the key for an empty key or a trailing dot", () => {
    expect(translate(en, "")).toBe("");
    expect(translate(en, "notifications.")).toBe("notifications.");
  });

  it("interpolates {{token}} placeholders with strings and numbers", () => {
    expect(
      translate(en, "notifications.preferences.enabledCount", {
        enabled: 2,
        total: "5",
      })
    ).toBe("2 of 5 active");
  });

  it("interpolates zero as '0' (not as a missing value)", () => {
    expect(
      translate(en, "notifications.preferences.enabledCount", {
        enabled: 0,
        total: 5,
      })
    ).toBe("0 of 5 active");
  });

  it("replaces missing tokens with an empty string", () => {
    expect(
      translate(en, "notifications.preferences.enabledCount", { enabled: 2 })
    ).toBe("2 of  active");
    expect(translate(en, "notifications.preferences.enabledCount", {})).toBe(
      " of  active"
    );
  });

  it("keeps the raw placeholders when no values are given", () => {
    expect(translate(en, "notifications.preferences.enabledCount")).toBe(
      "{{enabled}} of {{total}} active"
    );
  });

  it("ignores extra values that have no placeholder", () => {
    expect(
      translate(en, "notifications.jobCompleted", { unused: "x" })
    ).toBe("Job completed");
  });

  it("only replaces word-character tokens without inner spaces", () => {
    const messages = asMessages({
      greeting: "Hi {{name}}! {{ spaced }} {{n0}} {{a-b}}",
    });
    expect(
      translate(messages, "greeting", { name: "Ana", spaced: "S", n0: 1, "a-b": 2 })
    ).toBe("Hi Ana! {{ spaced }} 1 {{a-b}}");
  });

  it("does not resolve keys through inherited prototype members", () => {
    expect(translate(en, "toString")).toBe("toString");
    expect(translate(en, "notifications.constructor")).toBe(
      "notifications.constructor"
    );
  });

  it("works with the Spanish placeholders too", () => {
    expect(
      translate(es, "notifications.preferences.enabledCount", {
        enabled: 1,
        total: 3,
      })
    ).toBe("1 de 3 activas");
  });
});
