import { describe, expect, it } from "vitest";
import { convertUnit, UnitConversionError, unitLabel } from "./units";

describe("unitLabel", () => {
  it("resolves the currency symbol", () => {
    expect(unitLabel("money_per_litre", "NGN")).toBe("₦/litre");
    expect(unitLabel("money", "USD")).toBe("$");
    expect(unitLabel("km_per_day", "NGN")).toBe("km/day");
  });
});

describe("convertUnit", () => {
  it("converts mass and electric economy", () => {
    expect(convertUnit(2500, "kg", "tonnes")).toBe(2.5);
    expect(convertUnit(1.5, "tonnes", "kg")).toBe(1500);
    expect(convertUnit(30, "kwh_per_100km", "kwh_per_km")).toBeCloseTo(0.3, 10);
  });
  it("converts fuel economy reciprocally in both directions", () => {
    expect(convertUnit(20, "litres_per_100km", "km_per_litre")).toBe(5);
    expect(convertUnit(5, "km_per_litre", "litres_per_100km")).toBe(20);
  });
  it("returns zero unchanged for same-unit and linear conversions", () => {
    expect(convertUnit(0, "kg", "kg")).toBe(0);
    expect(convertUnit(0, "kg", "tonnes")).toBe(0);
  });
  it("refuses zero fuel economy because it has no reciprocal", () => {
    expect(() => convertUnit(0, "litres_per_100km", "km_per_litre")).toThrow(UnitConversionError);
  });
  it("refuses incompatible and non-finite conversions", () => {
    expect(() => convertUnit(1, "km", "kg")).toThrow(UnitConversionError);
    expect(() => convertUnit(Number.NaN, "kg", "tonnes")).toThrow(UnitConversionError);
  });
});
