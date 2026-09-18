import { describe, expect, it } from "vitest";
import {
  createTranslator,
  getMessages,
  loadMessages,
  selectPluralForm,
  translatePlural,
  type Messages,
} from "@/i18n/translate";

// `getMessages` es síncrono sobre el mapa ya cargado: se precargan los dos
// locales que usan los casos con diccionarios reales.
await loadMessages("en");
await loadMessages("es");

const asMessages = (value: Record<string, unknown>) =>
  value as unknown as Messages;

const messages = asMessages({
  photos: { one: "{{count}} photo", other: "{{count}} photos" },
  onlyOther: { other: "{{count}} items" },
  flat: "{{count}} things",
  withVars: {
    one: "{{name}} took {{count}} photo",
    other: "{{name}} took {{count}} photos",
  },
});

describe("selectPluralForm", () => {
  it("returns 'one' only for exactly 1", () => {
    expect(selectPluralForm(1)).toBe("one");
  });

  it("returns 'other' for zero, many, fractions and negatives", () => {
    for (const count of [0, 2, 15, 1.5, -1]) {
      expect(selectPluralForm(count)).toBe("other");
    }
  });
});

describe("translatePlural", () => {
  it("picks the .one form for a single item", () => {
    expect(translatePlural(messages, "photos", 1)).toBe("1 photo");
  });

  it("picks the .other form for zero and many items", () => {
    expect(translatePlural(messages, "photos", 0)).toBe("0 photos");
    expect(translatePlural(messages, "photos", 7)).toBe("7 photos");
  });

  it("falls back to .other when the .one form is missing", () => {
    expect(translatePlural(messages, "onlyOther", 1)).toBe("1 items");
  });

  it("falls back to the flat key when no plural forms exist", () => {
    expect(translatePlural(messages, "flat", 3)).toBe("3 things");
  });

  it("returns the key itself when nothing matches", () => {
    expect(translatePlural(messages, "missing.key", 2)).toBe("missing.key");
  });

  it("interpolates extra values and lets the count argument win", () => {
    expect(
      translatePlural(messages, "withVars", 1, { name: "Ana", count: 99 })
    ).toBe("Ana took 1 photo");
    expect(translatePlural(messages, "withVars", 4, { name: "Ana" })).toBe(
      "Ana took 4 photos"
    );
  });

  it("uses the flat jobs.detail.evidenceCount key of the real dictionaries as fallback", () => {
    expect(
      translatePlural(getMessages("en"), "jobs.detail.evidenceCount", 2)
    ).toBe("2 photos");
    expect(
      translatePlural(getMessages("es"), "jobs.detail.evidenceCount", 2)
    ).toBe("2 fotos");
  });
});

describe("createTranslator", () => {
  it("exposes t() and t.plural() over the same dictionary", () => {
    const t = createTranslator(messages);
    expect(t("flat", { count: 2 })).toBe("2 things");
    expect(t.plural("photos", 1)).toBe("1 photo");
    expect(t.plural("photos", 2)).toBe("2 photos");
  });

  it("keeps the plain t() contract for existing keys", () => {
    const t = createTranslator(getMessages("en"));
    expect(t("notifications.jobCompleted")).toBe("Job completed");
    expect(t("notifications.doesNotExist")).toBe("notifications.doesNotExist");
  });
});
