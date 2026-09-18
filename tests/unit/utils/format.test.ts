import { describe, expect, it } from "vitest";
import {
  formatCustomerAddress,
  formatCustomerName,
} from "@/lib/customers/format";

describe("formatCustomerName", () => {
  it("joins nombre and apellidos with a single space", () => {
    expect(formatCustomerName({ nombre: "Ana", apellidos: "Pérez" })).toBe(
      "Ana Pérez"
    );
  });

  it("returns only nombre when apellidos is missing", () => {
    expect(formatCustomerName({ nombre: "Ana" })).toBe("Ana");
  });

  it("returns only apellidos when nombre is missing", () => {
    expect(formatCustomerName({ apellidos: "Pérez" })).toBe("Pérez");
  });

  it("trims surrounding whitespace from name parts", () => {
    expect(
      formatCustomerName({ nombre: "  Ana  ", apellidos: "\tPérez\n" })
    ).toBe("Ana Pérez");
  });

  it("falls back to the email when both name parts are blank", () => {
    expect(
      formatCustomerName({ nombre: "   ", apellidos: "", email: "ana@x.com" })
    ).toBe("ana@x.com");
  });

  it("returns the email untouched (no trimming) when used as fallback", () => {
    expect(formatCustomerName({ email: "  ana@x.com " })).toBe("  ana@x.com ");
  });

  it("falls back to 'Cliente' when everything is null", () => {
    expect(
      formatCustomerName({ nombre: null, apellidos: null, email: null })
    ).toBe("Cliente");
  });

  it("falls back to 'Cliente' for an empty object", () => {
    expect(formatCustomerName({})).toBe("Cliente");
  });

  it("treats an empty email as missing", () => {
    expect(formatCustomerName({ nombre: "", email: "" })).toBe("Cliente");
  });
});

describe("formatCustomerAddress", () => {
  it("formats a full address as 'line1, line2, city, state postal'", () => {
    expect(
      formatCustomerAddress({
        direccionLinea1: "123 Main St",
        direccionLinea2: "Apt 4",
        ciudad: "Miami",
        estadoProvincia: "FL",
        codigoPostal: "33101",
      })
    ).toBe("123 Main St, Apt 4, Miami, FL 33101");
  });

  it("returns only line1 when the rest is missing", () => {
    expect(formatCustomerAddress({ direccionLinea1: "123 Main St" })).toBe(
      "123 Main St"
    );
  });

  it("joins city and state with a comma when postal code is missing", () => {
    expect(
      formatCustomerAddress({ ciudad: "Miami", estadoProvincia: "FL" })
    ).toBe("Miami, FL");
  });

  it("joins city and postal code with a space when state is missing", () => {
    expect(
      formatCustomerAddress({ ciudad: "Miami", codigoPostal: "33101" })
    ).toBe("Miami 33101");
  });

  it("returns only the postal code when it is the only value", () => {
    expect(formatCustomerAddress({ codigoPostal: "33101" })).toBe("33101");
  });

  it("returns an empty string when all fields are empty or null", () => {
    expect(
      formatCustomerAddress({
        direccionLinea1: "",
        direccionLinea2: null,
        ciudad: "   ",
        estadoProvincia: undefined,
        codigoPostal: null,
      })
    ).toBe("");
  });

  it("returns an empty string for an empty object", () => {
    expect(formatCustomerAddress({})).toBe("");
  });

  it("trims whitespace around every part", () => {
    expect(
      formatCustomerAddress({
        direccionLinea1: "  123 Main St ",
        ciudad: " Miami ",
        estadoProvincia: " FL ",
        codigoPostal: " 33101 ",
      })
    ).toBe("123 Main St, Miami, FL 33101");
  });

  it("keeps line2 when line1 is missing", () => {
    expect(
      formatCustomerAddress({ direccionLinea2: "Suite 9", ciudad: "Tampa" })
    ).toBe("Suite 9, Tampa");
  });
});
