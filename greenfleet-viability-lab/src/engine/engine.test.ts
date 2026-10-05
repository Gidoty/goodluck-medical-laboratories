import { describe, expect, it } from "vitest";
import { decide } from "./decision";
import { evaluate } from "./evaluate";
import { defaultInputs, NA, type Params, type RawInputs } from "./fields";
import { loanSchedule } from "./model";
import { breakEven, tornado } from "./sensitivity";
import { validate } from "./validate";

function paramsOf(overrides: Partial<RawInputs> = {}): Params {
  const r = validate({ ...defaultInputs(), ...overrides });
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.resolved.params;
}

describe("validation", () => {
  it("accepts the defaults", () => {
    expect(validate(defaultInputs()).ok).toBe(true);
  });
  it("rejects impossible values", () => {
    for (const [k, v] of [
      ["dailyDistanceKm", -5], ["dPrice", -1], ["dLifetime", 0], ["financedSharePct", 120],
      ["operatingDays", 400], ["dResidualPct", -1], ["horizonYears", 2.5],
    ] as const) {
      expect(validate({ ...defaultInputs(), [k]: v }).ok, k).toBe(false);
    }
  });
  it("treats blank as an error but 0 and N/A as valid for infrastructure", () => {
    expect(validate({ ...defaultInputs(), bInfraCost: null }).ok).toBe(false);
    const zero = validate({ ...defaultInputs(), bInfraCost: 0 });
    const na = validate({ ...defaultInputs(), bInfraCost: NA });
    expect(zero.ok && na.ok).toBe(true);
    if (zero.ok && na.ok) {
      expect(zero.resolved.notApplicable).not.toContain("bInfraCost");
      expect(na.resolved.notApplicable).toContain("bInfraCost");
    }
  });
  it("does not allow N/A on a field that must have a value", () => {
    expect(validate({ ...defaultInputs(), dPrice: NA }).ok).toBe(false);
  });
  it("requires a loan term only when something is financed", () => {
    expect(validate({ ...defaultInputs(), financedSharePct: 0, loanTermYears: NA }).ok).toBe(true);
    expect(validate({ ...defaultInputs(), financedSharePct: 50, loanTermYears: NA }).ok).toBe(false);
  });
  it("rejects horizon longer than vehicle life", () => {
    expect(validate({ ...defaultInputs(), horizonYears: 12 }).ok).toBe(false);
  });
  it("requires a battery replacement year when a cost is given", () => {
    expect(validate({ ...defaultInputs(), bBatteryReplCost: 5_000_000, bBatteryReplYear: NA }).ok).toBe(false);
    expect(validate({ ...defaultInputs(), bBatteryReplCost: 5_000_000, bBatteryReplYear: 5 }).ok).toBe(true);
  });
});

describe("model", () => {
  it("loan: payments repay principal exactly within the term", () => {
    const p = paramsOf({ horizonYears: 7, loanTermYears: 4 });
    const loan = loanSchedule(p, "diesel");
    const principal = (p.dPrice * p.financedSharePct) / 100;
    expect(loan.reduce((a, y) => a + y.principal, 0)).toBeCloseTo(principal, 4);
    expect(loan[3].balanceEnd).toBeCloseTo(0, 4);
    expect(loan[5].payment).toBe(0);
  });
  it("loan outstanding at horizon is settled", () => {
    const p = paramsOf({ horizonYears: 3, loanTermYears: 6 });
    const loan = loanSchedule(p, "bev");
    expect(loan[2].balanceEnd).toBeCloseTo(0, 6);
  });
  it("TCO equals the sum of its breakdown and the sum of yearly net costs", () => {
    const ev = evaluate(paramsOf({ bBatteryReplCost: 4_000_000, bBatteryReplYear: 5 }));
    for (const t of ["diesel", "bev", "biofuel"] as const) {
      const r = ev.results[t];
      const yearlySum = r.yearly.reduce((a, y) => a + y.netCost, 0);
      expect(r.tco).toBeCloseTo(yearlySum, 3);
    }
  });
  it("zero-rate, zero-escalation hand calculation for diesel", () => {
    const p = paramsOf({
      discountRatePct: 0, financedSharePct: 0, loanTermYears: NA, interestRatePct: 0,
      dieselEscPct: 0, opexEscPct: 0, horizonYears: 5, dailyDistanceKm: 100, operatingDays: 200,
      dPrice: 10_000_000, dConsumption: 20, dieselPrice: 1000, dMaintPerKm: 10, dFixedAnnual: 100_000,
      dLifetime: 10, dResidualPct: 20,
    });
    const r = evaluate(p).results.diesel;
    // km/yr 20,000; fuel 4,000 L * 1000 = 4,000,000; maint 200,000 + 100,000
    expect(r.annualEnergyCostYear1).toBe(4_000_000);
    // residual after 5 of 10 years: 10m * (1 - 0.8*0.5) = 6m
    expect(r.tco).toBeCloseTo(10_000_000 + 5 * 4_300_000 - 6_000_000, 3);
    expect(r.costPerKm).toBeCloseTo(r.tco / 100_000, 6);
  });
  it("shared infrastructure divides the cost", () => {
    const one = evaluate(paramsOf({ bInfraVehicles: 1 })).results.bev.breakdown.infrastructure;
    const three = evaluate(paramsOf({ bInfraVehicles: 3 })).results.bev.breakdown.infrastructure;
    expect(one / 3).toBeCloseTo(three, 6);
  });
  it("zero and N/A infrastructure give the same cost but are kept distinct by validation", () => {
    const a = evaluate(paramsOf({ bInfraCost: 0 })).results.bev.tco;
    const b = evaluate(paramsOf({ bInfraCost: NA })).results.bev.tco;
    expect(a).toBe(b);
  });
  it("payback is interpolated and null when never reached", () => {
    const cheap = evaluate(paramsOf({ bPrice: 46_000_000, electricityPrice: 50, bInfraCost: 0 }));
    expect(cheap.incr.bev.paybackYears).not.toBeNull();
    const never = evaluate(paramsOf({ electricityPrice: 5000 }));
    expect(never.incr.bev.paybackYears).toBeNull();
  });
  it("emissions follow the entered factors", () => {
    const base = evaluate(paramsOf());
    const zeroGrid = evaluate(paramsOf({ efGrid: 0 }));
    expect(zeroGrid.results.bev.annualEmissionsKg).toBe(0);
    expect(base.results.bev.annualEmissionsKg).toBeGreaterThan(0);
    const noBlend = evaluate(paramsOf({ fBlendPct: 0, fConsumptionPenaltyPct: 0 }));
    expect(noBlend.results.biofuel.annualEmissionsKg).toBeCloseTo(noBlend.results.diesel.annualEmissionsKg, 6);
  });
});

describe("decision rules", () => {
  it("does not favour green technology when diesel is cheaper", () => {
    const p = paramsOf({ dPrice: 30_000_000, dieselPrice: 400, electricityPrice: 400 });
    const ev = evaluate(p);
    expect(ev.lowestTco).toBe("diesel");
    expect(decide(p, "bev", ev).classification).toBe("NOT YET VIABLE");
    expect(ev.incr.bev.emissionsReductionKg).toBeGreaterThan(0); // greener, still not viable
  });
  it("classifies a clearly favourable BEV case as viable", () => {
    const p = paramsOf({
      bPrice: 50_000_000, electricityPrice: 60, dieselPrice: 1800, bInfraCost: 2_000_000,
      dailyDistanceKm: 150, bBatteryKwh: 120,
    });
    const d = decide(p, "bev");
    expect(d.rules.find((r) => r.id === "economic")!.passed).toBe(true);
    expect(d.classification).toBe("VIABLE");
  });
  it("fails operationally when the battery cannot cover the day", () => {
    const p = paramsOf({ dailyDistanceKm: 400, bPrice: 50_000_000, electricityPrice: 60, dieselPrice: 1800 });
    const d = decide(p, "bev");
    expect(d.operational[0].passed).toBe(false);
    expect(d.classification).toBe("NOT YET VIABLE");
  });
  it("biofuel above the approved blend is not viable", () => {
    const p = paramsOf({ fBlendPct: 30, fApprovedBlendPct: 20, biofuelPrice: 500, fPrice: 40_000_000 });
    expect(decide(p, "biofuel").classification).toBe("NOT YET VIABLE");
  });
  it("positive NPV with slow payback is conditional", () => {
    const p = paramsOf({ bPrice: 62_000_000, electricityPrice: 60, dieselPrice: 1800, bInfraCost: 2_000_000, ruleMaxPaybackYears: 0.5 });
    const d = decide(p, "bev");
    expect(d.classification).toBe("CONDITIONALLY VIABLE");
  });
});

describe("sensitivity", () => {
  it("break-even diesel price sets NPV to zero", () => {
    const p = paramsOf();
    const be = breakEven(p, "bev", "dieselPrice");
    expect(be.breakEven).not.toBeNull();
    const ev = evaluate({ ...p, dieselPrice: be.breakEven! });
    expect(Math.abs(ev.incr.bev.npv)).toBeLessThan(1);
  });
  it("tornado is sorted by swing and omits drivers with no effect", () => {
    const p = paramsOf({ financedSharePct: 0, loanTermYears: NA });
    const rows = tornado(p, "bev");
    expect(rows.find((r) => r.id === "interestRate")).toBeUndefined();
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].swing).toBeGreaterThanOrEqual(rows[i].swing);
  });
  it("is deterministic", () => {
    const p = paramsOf();
    expect(JSON.stringify(decide(p, "bev"))).toBe(JSON.stringify(decide(p, "bev")));
  });
});
