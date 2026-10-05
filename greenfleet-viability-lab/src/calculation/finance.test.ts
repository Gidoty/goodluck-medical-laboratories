import { describe, expect, it } from "vitest";
import { buildRows, cumulative, cycleStarts, discountFactor, distanceAtTime, escalatedPrice, npvDirection, paybackOf, presentValue, replacementYears, savingsDirection } from "./finance";
import { batteryReplacementYears } from "./assemble";

describe("discounting and escalation", () => {
  it("does not discount Year 0 and discounts later years by (1 + r)^t", () => {
    expect(discountFactor(0.1, 0)).toBe(1);
    expect(discountFactor(0.1, 2)).toBeCloseTo(1 / 1.21, 12);
    expect(presentValue(121, 0.1, 2)).toBeCloseTo(100, 10);
  });
  it("with a 0% rate every factor is exactly 1", () => {
    for (const t of [0, 1, 7, 30]) expect(discountFactor(0, t)).toBe(1);
  });
  it("escalates from Year 1 as price x (1 + g)^(t-1)", () => {
    expect(escalatedPrice(100, 0.1, 1)).toBe(100);
    expect(escalatedPrice(100, 0.1, 2)).toBeCloseTo(110, 10);
    expect(escalatedPrice(100, 0.1, 3)).toBeCloseTo(121, 10);
    expect(escalatedPrice(100, 0, 9)).toBe(100);
  });
  it("accumulates in order", () => {
    expect(cumulative([1, -3, 5])).toEqual([1, -2, 3]);
  });
});

describe("vehicle replacement schedule", () => {
  it("replaces at each full life that still serves the horizon", () => {
    expect(replacementYears(10, 5)).toEqual([5]); // not again at Year 10
    expect(replacementYears(11, 5)).toEqual([5, 10]);
    expect(replacementYears(10, 3)).toEqual([3, 6, 9]);
    expect(replacementYears(12, 4)).toEqual([4, 8]);
  });
  it("buys nothing when the life covers the horizon, including the exact boundary", () => {
    expect(replacementYears(5, 5)).toEqual([]);
    expect(replacementYears(5, 8)).toEqual([]);
    expect(replacementYears(1, 1)).toEqual([]);
  });
  it("places non-integer lives at the end of the year the life expires, without float drift", () => {
    expect(replacementYears(6, 2.5)).toEqual([3, 5]);
    expect(replacementYears(1, 0.1)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1]);
    expect(replacementYears(2, 0.3)).toEqual([1, 1, 1, 2, 2, 2]);
  });
  it("lists vehicle cycle starts including Year 0", () => {
    expect(cycleStarts(10, 4)).toEqual([0, 4, 8]);
    expect(cycleStarts(4, 4)).toEqual([0]);
  });
  it("repeats the battery replacement in every vehicle cycle that is inside the horizon", () => {
    expect(batteryReplacementYears(10, 10, 4)).toEqual([4]);
    expect(batteryReplacementYears(10, 5, 3)).toEqual([3, 8]);
    expect(batteryReplacementYears(3, 10, 4)).toEqual([]); // after the horizon
    expect(batteryReplacementYears(8, 5, 5)).toEqual([]); // the vehicle itself is replaced first, and the next cycle ends after the horizon
    expect(batteryReplacementYears(10, 5, 5)).toEqual([10]); // the second vehicle reaches its battery year exactly at the end
  });
});

describe("payback", () => {
  it("interpolates inside the crossing year", () => {
    expect(paybackOf([-3000, 800, 800, 800, 800, 1800])).toMatchObject({ status: "achieved", sustained: true });
    expect(paybackOf([-3000, 800, 800, 800, 800, 1800]).years).toBeCloseTo(3.75, 12);
    expect(paybackOf([-100, 50, 50]).years).toBe(2); // lands exactly on a year end
  });
  it("is null (not 0, not the horizon, not infinity) when never recovered", () => {
    const p = paybackOf([-100, 10, 10, 10]);
    expect(p).toEqual({ status: "not_achieved", years: null, sustained: null });
  });
  it("is immediate when nothing has to be recovered", () => {
    expect(paybackOf([500, 10, 10])).toEqual({ status: "immediate", years: 0, sustained: true });
    expect(paybackOf([0, 10])).toMatchObject({ status: "immediate", years: 0 });
  });
  it("reports when savings fall below zero again after payback", () => {
    const p = paybackOf([-100, 150, -200, 50]);
    expect(p.status).toBe("achieved");
    expect(p.years).toBeCloseTo(0 + 100 / 150, 12);
    expect(p.sustained).toBe(false);
  });
  it("handles a single-year horizon", () => {
    expect(paybackOf([-10, 20]).years).toBeCloseTo(0.5, 12);
  });
});

describe("distance at a time", () => {
  const d = [0, 100, 100, 100];
  it("accumulates whole years and interpolates within a year", () => {
    expect(distanceAtTime(d, 0)).toBe(0);
    expect(distanceAtTime(d, 2)).toBe(200);
    expect(distanceAtTime(d, 2.5)).toBe(250);
    expect(distanceAtTime(d, 3)).toBe(300);
  });
  it("follows uneven utilisation", () => {
    expect(distanceAtTime([0, 100, 300], 1.5)).toBe(250);
  });
});

describe("helpers", () => {
  it("classifies NPV with a tolerance and names the direction of savings", () => {
    expect(npvDirection(5, 1000)).toBe("advantage");
    expect(npvDirection(-5, 1000)).toBe("disadvantage");
    expect(npvDirection(1e-12, 1000)).toBe("indifferent");
    expect(savingsDirection(0)).toBe("none");
    expect(savingsDirection(3)).toBe("saving");
    expect(savingsDirection(-3)).toBe("additional_cost");
  });
  it("builds rows as diesel minus green with running totals", () => {
    const rows = buildRows([10, 5, 5], [14, 3, 3], 0);
    expect(rows.map((r) => r.incrementalCashFlow)).toEqual([-4, 2, 2]);
    expect(rows.map((r) => r.cumulativeIncrementalCashFlow)).toEqual([-4, -2, 0]);
  });
});
