import { describe, expect, it } from "vitest";
import {
  formatCustomerName,
  formatJobTitle,
  formatPropertyLabel,
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

describe("formatJobTitle", () => {
  it("adds the property name when the customer has named properties", () => {
    expect(formatJobTitle("Parplace", { name: "Parplace 2" })).toBe("Parplace · Parplace 2");
  });

  it("keeps only the customer when the property has no name", () => {
    expect(formatJobTitle("Cliente Demo", { name: null })).toBe("Cliente Demo");
    expect(formatJobTitle("Cliente Demo", { name: "  " })).toBe("Cliente Demo");
    expect(formatJobTitle("Cliente Demo", {})).toBe("Cliente Demo");
  });
});
