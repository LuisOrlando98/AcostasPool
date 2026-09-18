import { describe, expect, it } from "vitest";
import {
  formatCustomerName,
  formatJobTitle,
  formatPropertyLabel,
  getPropertyIndicator,
} from "@/lib/customers/format";

describe("formatCustomerName", () => {
  it("joins first and last name, falls back to the e-mail and then to a generic label", () => {
    expect(formatCustomerName({ nombre: " Ana ", apellidos: "Pérez" })).toBe("Ana Pérez");
    expect(formatCustomerName({ nombre: "", apellidos: "", email: "ana@example.com" })).toBe(
      "ana@example.com"
    );
    expect(formatCustomerName({})).toBe("Cliente");
  });
});

describe("formatPropertyLabel", () => {
  it("prefers the property name", () => {
    expect(formatPropertyLabel({ name: " Parplace 2 ", address: "100 Ocean Drive, Miami" })).toBe(
      "Parplace 2"
    );
  });

  it("falls back to the street part of the address, then to the fallback", () => {
    expect(formatPropertyLabel({ name: null, address: "100 Ocean Drive, Miami, FL" })).toBe(
      "100 Ocean Drive"
    );
    expect(formatPropertyLabel({ name: "", address: "   " }, "Property")).toBe("Property");
    expect(formatPropertyLabel({ address: "" })).toBe("");
  });
});

describe("getPropertyIndicator", () => {
  const named = { name: "Parplace 2", address: "200 Ocean Drive, Miami, FL" };
  const unnamed = { name: null, address: "200 Ocean Drive, Miami, FL" };

  it("only exists for customers with more than one property", () => {
    expect(getPropertyIndicator(named, false)).toBeNull();
    expect(getPropertyIndicator(unnamed, false)).toBeNull();
  });

  it("uses the property name and falls back to the street when it has none", () => {
    expect(getPropertyIndicator(named, true)).toBe("Parplace 2");
    expect(getPropertyIndicator(unnamed, true)).toBe("200 Ocean Drive");
    expect(getPropertyIndicator({ name: "", address: "" }, true)).toBeNull();
  });
});

describe("formatJobTitle", () => {
  it("adds the indicator when there is one", () => {
    expect(formatJobTitle("Parplace", "Parplace 2")).toBe("Parplace · Parplace 2");
  });

  it("keeps only the customer without indicator", () => {
    expect(formatJobTitle("Cliente Demo", null)).toBe("Cliente Demo");
  });
});
