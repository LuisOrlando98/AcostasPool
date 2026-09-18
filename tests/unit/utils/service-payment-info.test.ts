import { describe, expect, it } from "vitest";
import {
  SERVICE_PAYMENT_TYPE_VALUES,
  normalizeServicePaymentType,
  parseServicePaymentInfoInput,
} from "@/lib/customers/service-payment-info";
import { parseBusinessDateInput, startOfBusinessDay } from "@/lib/timezone";

describe("SERVICE_PAYMENT_TYPE_VALUES", () => {
  it("lists the two supported payment types in order", () => {
    expect(SERVICE_PAYMENT_TYPE_VALUES).toEqual(["TO_WORK", "WORKED"]);
  });
});

describe("normalizeServicePaymentType", () => {
  it.each([
    ["TO_WORK", "TO_WORK"],
    ["to work", "TO_WORK"],
    [" to-work ", "TO_WORK"],
    ["to - work", "TO_WORK"],
    ["x trabajar", "TO_WORK"],
    ["X/TRABAJAR", "TO_WORK"],
    ["Por Trabajar", "TO_WORK"],
    ["WORKED", "WORKED"],
    ["worked", "WORKED"],
    ["Trabajado", "WORKED"],
  ])("normalizes %p to %p", (raw, expected) => {
    expect(normalizeServicePaymentType(raw)).toBe(expected);
  });

  it.each(["", "   ", "monthly", "to__work", "TO_WORKED"])(
    "returns null for unsupported value %p",
    (raw) => {
      expect(normalizeServicePaymentType(raw)).toBeNull();
    }
  );
});

describe("parseServicePaymentInfoInput", () => {
  it("returns all-null data for an empty input", () => {
    expect(parseServicePaymentInfoInput({})).toEqual({
      serviceStartDate: null,
      paymentDay: null,
      servicePrice: null,
      paymentType: null,
      paymentNotes: null,
    });
  });

  it("treats null and whitespace-only values as empty", () => {
    expect(
      parseServicePaymentInfoInput({
        serviceStartDate: null,
        paymentDay: "  ",
        servicePrice: null,
        paymentType: "",
        paymentNotes: "   ",
      })
    ).toEqual({
      serviceStartDate: null,
      paymentDay: null,
      servicePrice: null,
      paymentType: null,
      paymentNotes: null,
    });
  });

  it("parses a valid business date to the start of that business day", () => {
    const result = parseServicePaymentInfoInput({ serviceStartDate: "2024-05-10" });
    const expected = parseBusinessDateInput("2024-05-10");

    expect(result?.serviceStartDate).toEqual(
      startOfBusinessDay(expected as Date)
    );
  });

  it("returns null for an invalid date format", () => {
    expect(parseServicePaymentInfoInput({ serviceStartDate: "05/10/2024" })).toBeNull();
    expect(parseServicePaymentInfoInput({ serviceStartDate: "2024-13-40" })).toBeNull();
  });

  it("parses paymentDay within 1..31", () => {
    expect(parseServicePaymentInfoInput({ paymentDay: "1" })?.paymentDay).toBe(1);
    expect(parseServicePaymentInfoInput({ paymentDay: " 31 " })?.paymentDay).toBe(31);
  });

  it.each(["0", "32", "1.5", "abc", "-3"])(
    "returns null for invalid paymentDay %p",
    (raw) => {
      expect(parseServicePaymentInfoInput({ paymentDay: raw })).toBeNull();
    }
  );

  it("accepts any string Number() understands for paymentDay (hex, exponent)", () => {
    expect(parseServicePaymentInfoInput({ paymentDay: "0x10" })?.paymentDay).toBe(16);
    expect(parseServicePaymentInfoInput({ paymentDay: "1e1" })?.paymentDay).toBe(10);
  });

  it("rounds servicePrice to two decimals", () => {
    expect(parseServicePaymentInfoInput({ servicePrice: "99.999" })?.servicePrice).toBe(100);
    expect(parseServicePaymentInfoInput({ servicePrice: "12.345" })?.servicePrice).toBe(12.35);
    expect(parseServicePaymentInfoInput({ servicePrice: "0" })?.servicePrice).toBe(0);
  });

  it.each(["-1", "abc", "Infinity"])(
    "returns null for invalid servicePrice %p",
    (raw) => {
      expect(parseServicePaymentInfoInput({ servicePrice: raw })).toBeNull();
    }
  );

  it("normalizes paymentType aliases", () => {
    expect(
      parseServicePaymentInfoInput({ paymentType: "por trabajar" })?.paymentType
    ).toBe("TO_WORK");
    expect(
      parseServicePaymentInfoInput({ paymentType: "trabajado" })?.paymentType
    ).toBe("WORKED");
  });

  it("returns null for an unknown paymentType", () => {
    expect(parseServicePaymentInfoInput({ paymentType: "weekly" })).toBeNull();
  });

  it("trims paymentNotes", () => {
    expect(
      parseServicePaymentInfoInput({ paymentNotes: "  pay on delivery  " })
        ?.paymentNotes
    ).toBe("pay on delivery");
  });

  it("returns a fully populated record when all fields are valid", () => {
    const result = parseServicePaymentInfoInput({
      serviceStartDate: "2024-01-15",
      paymentDay: "15",
      servicePrice: "150.5",
      paymentType: "worked",
      paymentNotes: "cash",
    });

    expect(result).toEqual({
      serviceStartDate: startOfBusinessDay(
        parseBusinessDateInput("2024-01-15") as Date
      ),
      paymentDay: 15,
      servicePrice: 150.5,
      paymentType: "WORKED",
      paymentNotes: "cash",
    });
  });

  it("fails as a whole when any single field is invalid", () => {
    expect(
      parseServicePaymentInfoInput({
        serviceStartDate: "2024-01-15",
        paymentDay: "40",
        servicePrice: "10",
      })
    ).toBeNull();
  });
});
