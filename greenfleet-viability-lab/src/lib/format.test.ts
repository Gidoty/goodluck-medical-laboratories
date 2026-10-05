import { describe, expect, it } from "vitest";
import { EMPTY_VALUE, formatMoney, formatNumber, formatPercent, formatQuantity } from "./format";

describe("formatMoney", () => {
  it("shows zero as a real value, not as missing", () => {
    expect(formatMoney(0, "NGN")).toBe("₦0");
    expect(formatMoney(0, "NGN", { compact: true })).toBe("₦0");
  });
  it("shows a dash for missing values", () => {
    expect(formatMoney(null, "NGN")).toBe(EMPTY_VALUE);
    expect(formatMoney(undefined, "NGN")).toBe(EMPTY_VALUE);
    expect(formatMoney(Number.NaN, "NGN")).toBe(EMPTY_VALUE);
  });
  it("groups thousands and uses the currency symbol", () => {
    expect(formatMoney(10_000_000, "NGN")).toBe("₦10,000,000");
    expect(formatMoney(1500, "USD")).toBe("$1,500");
    expect(formatMoney(2_500_000, "NGN", { compact: true })).toBe("₦2.5M");
  });
  it("puts the minus sign before the symbol and never prints negative zero", () => {
    expect(formatMoney(-2500, "NGN")).toBe("-₦2,500");
    expect(formatMoney(-0, "NGN")).toBe("₦0");
    expect(formatMoney(-0.2, "NGN")).toBe("₦0");
  });
  it("supports fixed decimals", () => {
    expect(formatMoney(12.5, "NGN", { fractionDigits: 2 })).toBe("₦12.50");
  });
});

describe("formatNumber / formatPercent", () => {
  it("keeps zero", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatPercent(0)).toBe("0%");
  });
  it("trims to the requested precision", () => {
    expect(formatNumber(12.3456, 2)).toBe("12.35");
    expect(formatPercent(12.345, 1)).toBe("12.3%");
  });
  it("marks missing values", () => {
    expect(formatPercent(null)).toBe(EMPTY_VALUE);
  });
});

describe("formatQuantity", () => {
  it("appends unit labels", () => {
    expect(formatQuantity(120, "km_per_day", "NGN")).toBe("120 km/day");
    expect(formatQuantity(20, "litres_per_100km", "NGN")).toBe("20 litres/100 km");
    expect(formatQuantity(0, "years", "NGN")).toBe("0 years");
  });
  it("formats money-based units with the symbol first", () => {
    expect(formatQuantity(1200, "money_per_litre", "NGN")).toBe("₦1,200/litre");
    expect(formatQuantity(0, "money_per_kwh", "NGN")).toBe("₦0/kWh");
    expect(formatQuantity(12.5, "money_per_km", "USD")).toBe("$12.50/km");
  });
  it("handles percentages and missing values", () => {
    expect(formatQuantity(80, "percent", "NGN")).toBe("80%");
    expect(formatQuantity(null, "kg", "NGN")).toBe(EMPTY_VALUE);
  });
});
