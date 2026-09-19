import { describe, expect, it } from "vitest";
import {
  buildMapsSearchUrl,
  isValidAddress,
  parseCoordinatePair,
  parseCoordinates,
} from "@/components/routes/assistant/location-input";

describe("isValidAddress", () => {
  it("accepts an address of at least five characters once trimmed", () => {
    expect(isValidAddress("  123 Main St  ")).toBe(true);
  });

  it("rejects short, empty and overlong addresses", () => {
    expect(isValidAddress("")).toBe(false);
    expect(isValidAddress("   ")).toBe(false);
    expect(isValidAddress("1 St")).toBe(false);
    expect(isValidAddress("x".repeat(201))).toBe(false);
  });
});

describe("parseCoordinates", () => {
  it("parses a valid latitude and longitude", () => {
    expect(parseCoordinates("25.7617", "-80.1918")).toEqual({
      lat: 25.7617,
      lng: -80.1918,
    });
  });

  it("accepts the extremes of both ranges", () => {
    expect(parseCoordinates("-90", "180")).toEqual({ lat: -90, lng: 180 });
  });

  it("rejects values out of range", () => {
    expect(parseCoordinates("90.1", "0")).toBeNull();
    expect(parseCoordinates("0", "-180.5")).toBeNull();
  });

  it("rejects empty or non numeric text", () => {
    expect(parseCoordinates("", "")).toBeNull();
    expect(parseCoordinates("25.7617", "")).toBeNull();
    expect(parseCoordinates("norte", "oeste")).toBeNull();
    expect(parseCoordinates("25.7617N", "-80.1918")).toBeNull();
  });
});

describe("parseCoordinatePair", () => {
  it("splits the pair that Google Maps copies to the clipboard", () => {
    expect(parseCoordinatePair("25.7617, -80.1918")).toEqual({
      lat: 25.7617,
      lng: -80.1918,
    });
    expect(parseCoordinatePair("  25.7617 -80.1918 ")).toEqual({
      lat: 25.7617,
      lng: -80.1918,
    });
  });

  it("returns null when it is not a pair of valid coordinates", () => {
    expect(parseCoordinatePair("25.7617")).toBeNull();
    expect(parseCoordinatePair("25.7617, -80.1918, 12")).toBeNull();
    expect(parseCoordinatePair("91, 0")).toBeNull();
    expect(parseCoordinatePair("")).toBeNull();
  });
});

describe("buildMapsSearchUrl", () => {
  it("escapes the address in the query", () => {
    expect(buildMapsSearchUrl("123 Main St, Miami FL")).toBe(
      "https://www.google.com/maps/search/?api=1&query=123%20Main%20St%2C%20Miami%20FL"
    );
  });
});
