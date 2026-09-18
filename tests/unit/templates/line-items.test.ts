import { describe, expect, it } from "vitest";
import {
  normalizeInvoiceLineItems,
  roundCurrency,
  type EditableInvoiceLineItem,
} from "@/lib/invoices/line-items";

// Tests de caracterizacion: fijan el comportamiento ACTUAL del modulo antes de refactorizar.

const VALID_ITEM: EditableInvoiceLineItem = {
  label: "Weekly cleaning",
  quantity: 2,
  unitPrice: 24.25,
  amount: 48.5,
  serviceCode: "WC",
};

describe("roundCurrency", () => {
  it("redondea al centavo mas cercano", () => {
    expect(roundCurrency(12.344)).toBe(12.34);
    expect(roundCurrency(12.346)).toBe(12.35);
    expect(roundCurrency(99.999)).toBe(100);
  });

  it("corrige el sesgo binario en mitades positivas (1.005 -> 1.01)", () => {
    expect(roundCurrency(1.005)).toBe(1.01);
    expect(roundCurrency(2.675)).toBe(2.68);
    expect(roundCurrency(10.005)).toBe(10.01);
  });

  it("elimina el ruido de coma flotante en sumas y productos", () => {
    expect(roundCurrency(0.1 + 0.2)).toBe(0.3);
    expect(roundCurrency(3 * 0.1)).toBe(0.3);
    expect(roundCurrency(3 * 33.333)).toBe(100);
  });

  it("devuelve 0 para valores no finitos", () => {
    expect(roundCurrency(Number.NaN)).toBe(0);
    expect(roundCurrency(Number.POSITIVE_INFINITY)).toBe(0);
    expect(roundCurrency(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it("deja intactos enteros, cero y valores ya redondeados", () => {
    expect(roundCurrency(0)).toBe(0);
    expect(roundCurrency(100)).toBe(100);
    expect(roundCurrency(19.99)).toBe(19.99);
  });

  it("redondea mitades negativas hacia cero (asimetria respecto a positivos)", () => {
    // Number.EPSILON solo empuja hacia arriba: -1.005 queda en -100.4999 * y Math.round da -100.
    expect(roundCurrency(-1.005)).toBe(-1);
    expect(roundCurrency(-2.5)).toBe(-2.5);
    expect(roundCurrency(-19.99)).toBe(-19.99);
  });
});

describe("normalizeInvoiceLineItems", () => {
  it("devuelve un array vacio cuando la entrada no es un array", () => {
    expect(normalizeInvoiceLineItems(null)).toEqual([]);
    expect(normalizeInvoiceLineItems(undefined)).toEqual([]);
    expect(normalizeInvoiceLineItems("[]")).toEqual([]);
    expect(normalizeInvoiceLineItems({ label: "x", unitPrice: 1 })).toEqual([]);
    expect(normalizeInvoiceLineItems(42)).toEqual([]);
  });

  it("devuelve un array vacio para un array vacio", () => {
    expect(normalizeInvoiceLineItems([])).toEqual([]);
  });

  it("normaliza un item valido y recalcula amount desde quantity * unitPrice ignorando el amount recibido", () => {
    const result = normalizeInvoiceLineItems([{ ...VALID_ITEM, amount: 999 }]);

    expect(result).toEqual([VALID_ITEM]);
  });

  it("recorta espacios en label y serviceCode", () => {
    const [item] = normalizeInvoiceLineItems([
      { label: "  Filter change  ", unitPrice: 10, serviceCode: "  FL " },
    ]);

    expect(item.label).toBe("Filter change");
    expect(item.serviceCode).toBe("FL");
  });

  it("descarta items con label ausente, vacio, solo espacios o no string", () => {
    const result = normalizeInvoiceLineItems([
      { unitPrice: 10 },
      { label: "", unitPrice: 10 },
      { label: "   ", unitPrice: 10 },
      { label: 123, unitPrice: 10 },
      { label: null, unitPrice: 10 },
    ]);

    expect(result).toEqual([]);
  });

  it("ignora entradas null, undefined y primitivas sin lanzar", () => {
    const input = [null, undefined, 5, "texto", true];

    expect(() => normalizeInvoiceLineItems(input)).not.toThrow();
    expect(normalizeInvoiceLineItems(input)).toEqual([]);
  });

  it("usa quantity = 1 cuando falta, es cero, negativa, no numerica o infinita", () => {
    const quantities = [
      undefined,
      null,
      0,
      -3,
      "abc",
      Number.NaN,
      Number.POSITIVE_INFINITY,
      "",
      false,
    ];
    const result = normalizeInvoiceLineItems(
      quantities.map((quantity) => ({ label: "L", quantity, unitPrice: 5 }))
    );

    expect(result).toHaveLength(quantities.length);
    expect(result.map((item) => item.quantity)).toEqual(quantities.map(() => 1));
    expect(result.map((item) => item.amount)).toEqual(quantities.map(() => 5));
  });

  it("convierte quantity y unitPrice numericos expresados como string", () => {
    const [item] = normalizeInvoiceLineItems([{ label: "L", quantity: "3", unitPrice: "12.50" }]);

    expect(item).toMatchObject({ quantity: 3, unitPrice: 12.5, amount: 37.5 });
  });

  it("acepta cantidades fraccionarias", () => {
    const [item] = normalizeInvoiceLineItems([{ label: "Hours", quantity: 0.5, unitPrice: 90 }]);

    expect(item).toMatchObject({ quantity: 0.5, unitPrice: 90, amount: 45 });
  });

  it("usa amount como unitPrice solo cuando unitPrice es null o undefined", () => {
    const [missing, nulled, zero] = normalizeInvoiceLineItems([
      { label: "A", amount: 80 },
      { label: "B", unitPrice: null, amount: 80 },
      { label: "C", unitPrice: 0, amount: 80 },
    ]);

    expect(missing).toMatchObject({ unitPrice: 80, amount: 80 });
    expect(nulled).toMatchObject({ unitPrice: 80, amount: 80 });
    expect(zero).toMatchObject({ unitPrice: 0, amount: 0 });
  });

  it("convierte unitPrice negativo, no numerico, infinito o ausente en 0 y conserva el item", () => {
    const result = normalizeInvoiceLineItems([
      { label: "A", unitPrice: -5 },
      { label: "B", unitPrice: "abc" },
      { label: "C", unitPrice: Number.POSITIVE_INFINITY },
      { label: "D" },
    ]);

    expect(result).toHaveLength(4);
    expect(result.every((item) => item.unitPrice === 0 && item.amount === 0)).toBe(true);
  });

  it("normaliza serviceCode a null cuando falta, esta vacio o no es string", () => {
    const result = normalizeInvoiceLineItems([
      { label: "A", unitPrice: 1 },
      { label: "B", unitPrice: 1, serviceCode: "" },
      { label: "C", unitPrice: 1, serviceCode: "   " },
      { label: "D", unitPrice: 1, serviceCode: 42 },
      { label: "E", unitPrice: 1, serviceCode: null },
    ]);

    expect(result.map((item) => item.serviceCode)).toEqual([null, null, null, null, null]);
  });

  it("redondea amount a dos decimales corrigiendo mitades", () => {
    const result = normalizeInvoiceLineItems([
      { label: "A", quantity: 3, unitPrice: 33.333 },
      { label: "B", quantity: 3, unitPrice: 0.1 },
      { label: "C", quantity: 1, unitPrice: 1.005 },
      { label: "D", quantity: 7, unitPrice: 19.99 },
    ]);

    expect(result.map((item) => item.amount)).toEqual([100, 0.3, 1.01, 139.93]);
  });

  it("no muta las entradas originales", () => {
    const entry = Object.freeze({
      label: "  Weekly cleaning ",
      quantity: 2,
      unitPrice: 24.25,
      amount: 1,
      serviceCode: " WC ",
    });
    const input = Object.freeze([entry]);
    const snapshot = structuredClone(input);

    const result = normalizeInvoiceLineItems(input);

    expect(input).toEqual(snapshot);
    expect(result[0]).not.toBe(entry);
    expect(result[0]).toEqual(VALID_ITEM);
  });

  it("preserva el orden y conserva labels duplicados", () => {
    const result = normalizeInvoiceLineItems([
      { label: "Dup", unitPrice: 1 },
      { label: "Other", unitPrice: 2 },
      { label: "Dup", unitPrice: 3 },
    ]);

    expect(result.map((item) => item.label)).toEqual(["Dup", "Other", "Dup"]);
    expect(result.map((item) => item.amount)).toEqual([1, 2, 3]);
  });

  it("tras normalizar, quantity y amount nunca descartan un item: solo el label filtra", () => {
    const result = normalizeInvoiceLineItems([{ label: "X", quantity: -1, unitPrice: -1 }]);

    expect(result).toEqual([
      { label: "X", quantity: 1, unitPrice: 0, amount: 0, serviceCode: null },
    ]);
  });

  it("descarta claves desconocidas y devuelve exactamente la forma EditableInvoiceLineItem", () => {
    const [item] = normalizeInvoiceLineItems([{ label: "X", unitPrice: 2, foo: "bar", id: 7 }]);

    expect(Object.keys(item).sort()).toEqual(["amount", "label", "quantity", "serviceCode", "unitPrice"]);
    expect(item).not.toHaveProperty("foo");
    expect(item.serviceCode).toBeNull();
  });
});
