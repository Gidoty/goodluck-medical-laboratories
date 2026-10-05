import { describe, expect, it } from "vitest";
import { deepFreeze, makeInput } from "../fixtures";
import { evaluateInput } from "./evaluate";
import { applyOverrides, VARIABLES } from "./variables";
import { runDriverAnalysis, runSensitivityAnalysis, runTwoWaySensitivity, sensitivityValues, DEFAULT_SENSITIVITY_RANGE, SENSITIVITY_LIMITS, type SensitivityResult } from "../sensitivity";
import { MAX_SCENARIOS, addScenario, compareScenarios, deleteScenario, duplicateScenario, renameScenario, scenarioDraftFromThreshold, validateScenario, type Scenario } from "../scenario";
import { createScenarioRepository, SCENARIO_KEY } from "../scenario/storage";
import { SOLVER_SETTINGS, analyzeViability, findRoot, solveViabilityThreshold, type ThresholdResult } from "../threshold";
import type { VariableId } from "./variables";

/**
 * Base fixture (../fixtures.ts, abstract currency units): BEV NPV +2,000 on 3,000 extra investment (VIABLE),
 * biofuel NPV -750 on 500 (NOT YET VIABLE). 100 km/day, 100 days, 10,000 km/year, 5 years, 0% discount.
 */
type Patch = Parameters<typeof makeInput>[0];
const P = (p: unknown) => p as Patch;
const input = (p: Patch = {}) => makeInput(p);
const longDay = (opportunity: string | null, extra: Record<string, unknown> = {}): Patch => P({ operations: { dailyDistanceKm: 450, ...extra }, bev: { usableRangeKm: 300, operational: { chargingOpportunity: opportunity } } });
const bevCost = (n: number): Patch => P({ bev: { upfrontVehicleCost: n } });
const factor = (value: number, unit: string, unitId: string) => ({ value, unit, unitId, scope: null, source: "s", sourceYear: 2020, notes: null, lifecycleAdjustmentPct: null });
const FACTORS = (d: number, g: number, b: number): Patch => P({ environmentalAssumptions: { diesel: factor(d, "kg CO2e/litre", "kgco2e_per_litre"), gridElectricity: factor(g, "kg CO2e/kWh", "kgco2e_per_kwh"), biofuel: factor(b, "kg CO2e/litre", "kgco2e_per_litre") } });
const thr = (i: ReturnType<typeof input>, tech: "bev" | "biofuel", v: VariableId, target: "economic_break_even" | "classification_transition" = "economic_break_even"): ThresholdResult => solveViabilityThreshold({ input: i, technology: tech, variableId: v, target });
const sens = (i: ReturnType<typeof input>, tech: "bev" | "biofuel", v: VariableId, range?: Parameters<typeof runSensitivityAnalysis>[0]["range"]) => {
  const r = runSensitivityAnalysis({ input: i, technology: tech, variableId: v, range });
  if (r.status !== "ok") throw new Error(r.message);
  return r;
};
const npvAt = (i: ReturnType<typeof input>, tech: "bev" | "biofuel", v: VariableId, x: number) => {
  const e = evaluateInput(VARIABLES[v].set(i, x));
  if (!e.ok) throw new Error("calc");
  return e[tech].npv;
};

describe("immutability: the Base Case is never changed", () => {
  it("1/11/19. sensitivity, drivers, two-way, thresholds, analysis and scenarios leave a frozen input untouched", () => {
    const i = deepFreeze(input(P({ infrastructure: { bevCharging: { investmentRequired: true, equipmentCost: 1000, installationCost: 0 } } })));
    const before = JSON.stringify(i);
    runSensitivityAnalysis({ input: i, technology: "bev", variableId: "dieselPrice" });
    runDriverAnalysis({ input: i, technology: "bev" });
    runTwoWaySensitivity({ input: i, technology: "bev", xId: "bevAcquisition", yId: "electricityTariff" });
    for (const v of ["bevAcquisition", "electricityTariff", "dieselPrice", "annualDistance", "bevSubsidy", "bevInfraCapex"] as VariableId[]) {
      thr(i, "bev", v);
      thr(i, "bev", v, "classification_transition");
    }
    analyzeViability(i, "bev");
    analyzeViability(i, "biofuel");
    compareScenarios(i, [{ id: "a", name: "A", description: "", origin: "user", overrides: { dieselPrice: 3, bevChargingOpportunity: "mixed" }, createdAt: "", updatedAt: "" }]);
    expect(JSON.stringify(i)).toBe(before);
  });
  it("one variable changes at a time", () => {
    const i = input();
    const out = VARIABLES.electricityTariff.set(i, 0.07);
    expect(out.bev.electricityTariffPerKwh).toBe(0.07);
    expect(out.diesel).toEqual(i.diesel);
    expect(out.bev.upfrontVehicleCost).toBe(i.bev.upfrontVehicleCost);
    expect(out.operations).toEqual(i.operations);
    expect(out).not.toBe(i);
  });
});

describe("sensitivity", () => {
  it("3. diesel price: NPV rises 1,000 per 0.20 of price and the base point is marked", () => {
    const r = sens(input(), "bev", "dieselPrice");
    expect(r.points.map((p) => p.value)).toEqual([0.8, 0.9, 1, 1.1, 1.2]);
    expect(r.points.find((p) => p.isBase)!.npv).toBeCloseTo(2000, 6);
    expect(r.points[0]!.npv).toBeCloseTo(1000, 6);
    expect(r.points[4]!.npv).toBeCloseTo(3000, 6);
    expect(r.transparency.rangeLabel).toMatch(/^Prototype sensitivity range/);
  });
  it("4. electricity tariff: higher tariff lowers NPV", () => {
    const r = sens(input(), "bev", "electricityTariff");
    expect(r.points[4]!.npv).toBeLessThan(r.points[0]!.npv);
    expect(r.points[0]!.npv).toBeCloseTo(2000 + 0.01 * 10000 * 5, 6);
  });
  it("5. biofuel price", () => {
    const r = sens(input(), "biofuel", "biofuelPrice");
    expect(r.points[0]!.npv).toBeCloseTo(-750 + 0.16 * 1250 * 5, 6);
    expect(r.points.find((p) => p.isBase)!.npv).toBeCloseTo(-750, 6);
  });
  it("6. acquisition price", () => {
    const r = sens(input(), "bev", "bevAcquisition");
    expect(r.points[0]!.npv - r.points[4]!.npv).toBeCloseTo(2 * 0.2 * 13000, 6);
  });
  it("7. annual distance changes the economics and, linked to it, the daily distance", () => {
    const r = sens(input(), "bev", "annualDistance");
    expect(r.points[4]!.npv).toBeGreaterThan(r.points[0]!.npv);
    const changed = VARIABLES.annualDistance.set(input(), 12000);
    expect(changed.operations.dailyDistanceKm).toBeCloseTo(120, 9);
    expect(changed.operations.fleetAnnualDistanceKm).toBe(12000);
    const days = VARIABLES.operatingDays.set(input(), 150);
    expect(days.operations.dailyDistanceKm).toBe(100);
    expect(days.operations.annualDistanceKmPerVehicle).toBe(15000);
  });
  it("8. discount rate", () => {
    const i = input(P({ finance: { discountRatePct: 10 } }));
    const r = sens(i, "bev", "discountRate");
    expect(new Set(r.points.map((p) => p.npv)).size).toBeGreaterThan(1);
    expect(r.points.find((p) => p.isBase)!.value).toBe(10);
  });
  it("9. a zero base value cannot use a percentage range, and an absolute range works", () => {
    const i = input();
    const r = runSensitivityAnalysis({ input: i, technology: "bev", variableId: "bevSubsidy" });
    expect(r.status).toBe("unavailable");
    expect((r as { message: string }).message).toBe("Percentage sensitivity is unavailable because the base value is zero. Use an absolute range instead.");
    const abs = sens(i, "bev", "bevSubsidy", { mode: "absolute", min: 0, max: 4000, steps: 5 });
    expect(abs.points.map((p) => p.value)).toEqual([0, 1000, 2000, 3000, 4000]);
    expect(abs.points[4]!.npv).toBeCloseTo(6000, 6);
  });
  it("10. invalid values are rejected, not clamped", () => {
    const neg = runSensitivityAnalysis({ input: input(), technology: "bev", variableId: "dieselPrice", range: { mode: "percent", min: -150, max: 20, steps: 5 } });
    expect(neg).toMatchObject({ status: "error", code: "range_invalid" });
    const disc = runSensitivityAnalysis({ input: input(P({ finance: { discountRatePct: 90 } })), technology: "bev", variableId: "discountRate", range: { mode: "percent", min: -10, max: 30, steps: 5 } });
    expect(disc).toMatchObject({ status: "error", code: "range_invalid" });
    for (const range of [{ mode: "percent", min: 10, max: -10, steps: 5 }, { mode: "percent", min: -10, max: 10, steps: 2 }, { mode: "percent", min: -10, max: 10, steps: 999 }, { mode: "percent", min: Number.NaN, max: 10, steps: 5 }] as const) {
      expect(runSensitivityAnalysis({ input: input(), technology: "bev", variableId: "dieselPrice", range })).toMatchObject({ status: "error", code: "bad_range" });
    }
    expect(runSensitivityAnalysis({ input: input(), technology: "bev", variableId: "biofuelPrice" })).toMatchObject({ status: "error", code: "not_applicable" });
    expect(runSensitivityAnalysis({ input: input(), technology: "bev", variableId: "bevChargingOpportunity" })).toMatchObject({ status: "error", code: "not_numeric" });
    expect(SENSITIVITY_LIMITS.maxSteps).toBeLessThanOrEqual(41);
  });
  it("11. a custom range", () => {
    const r = sens(input(), "bev", "dieselPrice", { mode: "percent", min: -50, max: 50, steps: 3 });
    expect(r.points.map((p) => p.value)).toEqual([0.5, 1, 1.5]);
    expect(r.transparency.rangeLabel).toBe("Custom range set by the user.");
  });
  it("the base value is always included when it falls inside an uneven range", () => {
    const v = sensitivityValues(100, { mode: "percent", min: -20, max: 40, steps: 4 });
    expect(v).toContain(100);
    expect(v).toEqual([...v].sort((a, b) => a - b));
  });
  it("12. classification transitions are captured, with the reason, as a boundary of the rules", () => {
    const r = sens(input(), "bev", "bevAcquisition", { mode: "percent", min: 0, max: 100, steps: 11 });
    expect(r.transitions.length).toBeGreaterThan(0);
    const t = r.transitions[0]!;
    expect(t.from).toBe("VIABLE");
    expect(t.explanation).toMatch(/rule-based/);
    expect(r.interpretation.join(" ")).toMatch(/Commercial classification changes from Viable/);
  });
  it("13. the NPV zero crossing is solved and shown only when inside the tested range", () => {
    const r = sens(input(bevCost(20000)), "bev", "bevAcquisition", { mode: "percent", min: -40, max: 10, steps: 6 });
    expect(r.breakEven?.value).toBeCloseTo(15000, 3);
    const none = sens(input(), "bev", "dieselPrice");
    expect(none.breakEven).toBeNull();
    expect(none.interpretation.join(" ")).toMatch(/stays positive/);
  });
  it("14. driver ranking: sorted by NPV spread, spread = max - min, zero-base variables skipped with a reason", () => {
    const d = runDriverAnalysis({ input: input(), technology: "bev" });
    if (d.status !== "ok") throw new Error(d.message);
    const spreads = d.rows.map((r) => r.spread);
    expect(spreads).toEqual([...spreads].sort((a, b) => b - a));
    for (const row of d.rows) expect(row.spread).toBeCloseTo(Math.max(row.npvLow, row.npvHigh) - Math.min(row.npvLow, row.npvHigh), 9);
    expect(d.rows.find((r) => r.variableId === "bevAcquisition")!.spread).toBeCloseTo(0.4 * 13000, 6);
    expect(d.skipped.find((s) => s.variableId === "bevSubsidy")?.reason).toMatch(/base value is zero/);
    expect(d.label).toBe("Sensitivity influence under the tested ranges.");
    expect(d.statement).toMatch(/largest NPV influence among the variables tested, under the tested ranges/);
    expect(d.rows.every((r) => !["bevRange", "bevChargingDowntime"].includes(r.variableId))).toBe(true);
  });
  it("two-way sensitivity: limited pairs, a bounded grid, and an economic break-even frontier", () => {
    const r = runTwoWaySensitivity({ input: input(bevCost(20000)), technology: "bev", xId: "bevAcquisition", yId: "electricityTariff" });
    if (r.status !== "ok") throw new Error(r.message);
    expect(r.cells.length).toBe(25);
    expect(r.frontierLabel).toBe("Economic break-even frontier");
    expect(r.frontierNote).toMatch(/not commercially viable unless the operational gates/);
    for (const f of r.frontier) if (f.yValue !== null) expect(npvAt(VARIABLES.bevAcquisition.set(input(bevCost(20000)), f.xValue), "bev", "electricityTariff", f.yValue)).toBeCloseTo(0, 3);
    expect(runTwoWaySensitivity({ input: input(), technology: "bev", xId: "bevAcquisition", yId: "dieselPrice" })).toMatchObject({ code: "unknown_pair" });
    expect(runTwoWaySensitivity({ input: input(), technology: "bev", xId: "bevAcquisition", yId: "electricityTariff", xRange: { ...DEFAULT_SENSITIVITY_RANGE, steps: 30 } })).toMatchObject({ code: "bad_range" });
  });
  it("15. changing only environmental factors cannot change the commercial label or the NPV", () => {
    const a = sens(input(FACTORS(2, 0.1, 1.2)), "bev", "bevAcquisition");
    const b = sens(input(FACTORS(0.1, 9, 9)), "bev", "bevAcquisition");
    expect(b.points.map((p) => [p.npv, p.classification, p.economicCase, p.operationalStatus])).toEqual(a.points.map((p) => [p.npv, p.classification, p.economicCase, p.operationalStatus]));
    expect(a.points[2]!.environmental.state).not.toBe(b.points[2]!.environmental.state);
    const ta = thr(input(bevCost(20000)), "bev", "bevAcquisition");
    const tb = thr(input({ ...bevCost(20000), ...FACTORS(0.1, 9, 9) }), "bev", "bevAcquisition");
    expect(tb.thresholdValue).toBe(ta.thresholdValue);
  });
  it("16. repeated runs give identical results", () => {
    const f = () => JSON.stringify([sens(input(), "bev", "electricityTariff"), thr(input(bevCost(20000)), "bev", "dieselPrice"), runDriverAnalysis({ input: input(), technology: "biofuel" })]);
    expect(f()).toBe(f());
  });
  it("sentences use conditional language and never promise", () => {
    const r: SensitivityResult = sens(input(), "bev", "electricityTariff");
    expect(r.interpretation.join(" ")).toMatch(/under the tested assumptions/);
    expect(r.interpretation.join(" ")).not.toMatch(/\bwill happen\b/);
  });
});

describe("threshold solver: economic break-even", () => {
  const nyv = () => input(bevCost(20000)); // NPV -5,000 on 10,000 extra investment
  it("1. BEV acquisition price", () => {
    const t = thr(nyv(), "bev", "bevAcquisition");
    expect(t.status).toBe("FOUND");
    expect(t.thresholdValue).toBeCloseTo(15000, 4);
    expect(t.thresholdKind).toBe("required");
    expect(t.requiredChange).toMatchObject({ direction: "decrease" });
    expect(t.requiredChange!.percent).toBeCloseTo(-25, 3);
    expect(t.statement).toBe("BEV acquisition price would need to fall to approximately {cur}15,000 (-25.0%) for incremental NPV to reach zero, all else equal.");
    expect(t.allElseEqual).toBe(true);
  });
  it("18. the solution is verified by the authoritative engine, not by a formula", () => {
    const t = thr(nyv(), "bev", "bevAcquisition");
    expect(npvAt(nyv(), "bev", "bevAcquisition", t.thresholdValue!)).toBeCloseTo(0, 4);
    expect(t.after!.npv).toBeCloseTo(0, 4);
    expect(t.after!.classification).toBe("CONDITIONALLY_VIABLE");
    expect(t.before!.classification).toBe("NOT_YET_VIABLE");
    expect(t.transition?.changedGate).toBe("economic");
  });
  it("38/39. minimum diesel price", () => {
    const t = thr(nyv(), "bev", "dieselPrice");
    expect(t.thresholdValue).toBeCloseTo(2, 4);
    expect(npvAt(nyv(), "bev", "dieselPrice", t.thresholdValue!)).toBeCloseTo(0, 4);
  });
  it("2/12. electricity tariff: no root inside the solver bounds is reported as such, with no number", () => {
    const t = thr(nyv(), "bev", "electricityTariff");
    expect(t.status).toBe("NOT_BRACKETED");
    expect(t.thresholdValue).toBeNull();
    expect(t.thresholdDisplay).toBeNull();
    expect(t.requiredChange).toBeNull();
    expect(t.statement).toMatch(/^No economic threshold was found within the solver bounds/);
  });
  it("4. annual utilisation", () => {
    const i = nyv();
    const t = thr(i, "bev", "annualDistance");
    if (t.status === "FOUND") {
      expect(t.thresholdValue!).toBeGreaterThan(10000);
      expect(npvAt(i, "bev", "annualDistance", t.thresholdValue!)).toBeCloseTo(0, 3);
    } else expect(["NOT_BRACKETED", "NON_MONOTONIC"]).toContain(t.status);
    const j = input(bevCost(16000));
    const u = thr(j, "bev", "annualDistance");
    expect(u.status).toBe("FOUND");
    expect(npvAt(j, "bev", "annualDistance", u.thresholdValue!)).toBeCloseTo(0, 3);
  });
  it("5/41. minimum subsidy, capped by the purchase cost, and a zero current value has no percentage", () => {
    const t = thr(nyv(), "bev", "bevSubsidy");
    expect(t.status).toBe("FOUND");
    expect(t.thresholdValue).toBeCloseTo(5000, 4);
    expect(t.currentValue).toBe(0);
    expect(t.requiredChange!.percent).toBeNull();
    expect(t.statement).not.toMatch(/\(.*%\)/);
    expect(VARIABLES.bevSubsidy.invalid(nyv(), 25000)).toMatch(/cannot exceed the vehicle purchase cost/);
    const big = thr(input(bevCost(30000)), "bev", "bevSubsidy");
    expect(big.thresholdValue === null || big.thresholdValue <= 30000).toBe(true);
  });
  it("6/42. infrastructure capital cost is the project total; the fleet pays its share", () => {
    const withInfra = (share: number | null) => input(P({ bev: { upfrontVehicleCost: 14500 }, infrastructure: { bevCharging: { investmentRequired: true, equipmentCost: 1000, installationCost: 0, vehiclesSharing: share } } }));
    const t = thr(withInfra(null), "bev", "bevInfraCapex");
    expect(t.status).toBe("FOUND");
    expect(t.thresholdValue).toBeCloseTo(500, 3);
    const shared = thr(withInfra(2), "bev", "bevInfraCapex"); // 1 of 2 vehicles: the fleet pays half, so the project total can be twice as large
    expect(shared.thresholdValue).toBeCloseTo(1000, 2);
    expect(thr(input(), "bev", "bevInfraCapex").status).toBe("NOT_APPLICABLE");
  });
  it("7/8. biofuel price and biofuel acquisition or conversion cost", () => {
    const p = thr(input(), "biofuel", "biofuelPrice");
    expect(p.thresholdValue).toBeCloseTo(0.68, 5);
    const a = thr(input(), "biofuel", "biofuelAcquisition");
    expect(a.thresholdValue).toBeCloseTo(9750, 3);
    expect(a.statement).toMatch(/Biofuel vehicle acquisition or conversion cost would need to fall/);
  });
  it("11/62. an alternative that already has a positive NPV gets deterioration headroom, not a requirement", () => {
    const t = thr(input(), "bev", "electricityTariff");
    expect(t.status).toBe("ALREADY_SATISFIED");
    expect(t.thresholdKind).toBe("headroom");
    expect(t.thresholdValue).toBeCloseTo(0.09, 6);
    expect(t.statement).toMatch(/could increase to approximately .*before incremental NPV reaches zero, all else equal/);
    const none = thr(input(), "bev", "bevSubsidy");
    expect(none.status).toBe("ALREADY_SATISFIED");
  });
  it("an NPV that is already zero is at its threshold", () => {
    const t = thr(input(bevCost(15000)), "bev", "bevAcquisition");
    expect(t.status).toBe("ALREADY_SATISFIED");
    expect(t.thresholdKind).toBe("at_threshold");
  });
  it("13/14. variables that cannot be solved say so and carry no number", () => {
    for (const v of ["discountRate", "operatingDays", "bevChargingOpportunity", "biofuelPrice"] as VariableId[]) {
      const t = thr(nyv(), "bev", v);
      expect(t.status).toBe("NOT_APPLICABLE");
      expect(t.thresholdValue).toBeNull();
    }
    expect(thr(nyv(), "bev", "bevChargingOpportunity").statement).toMatch(/category, not a number/);
  });
  it("23/26. insufficient evidence blocks the solver and lists what is missing", () => {
    const t = thr(input(longDay(null)), "bev", "bevAcquisition");
    expect(t.status).toBe("INSUFFICIENT_DATA");
    expect(t.thresholdValue).toBeNull();
    expect(t.statement).toMatch(/^Complete these inputs before threshold analysis can be performed\./);
    const bad = thr(input(P({ diesel: { fuelConsumptionLitresPer100Km: 0 } })), "bev", "bevAcquisition");
    expect(bad.status).toBe("INSUFFICIENT_DATA");
  });
  it("only a zero or finite denominator is ever used", () => {
    const t = thr(input(bevCost(10050)), "bev", "dieselPrice");
    expect(Number.isFinite(t.thresholdValue ?? 0)).toBe(true);
    expect(JSON.stringify(t)).not.toMatch(/NaN|Infinity/);
  });
});

describe("root solver mechanics", () => {
  const settings = SOLVER_SETTINGS;
  it("16. converges to the root within tolerance, in a bounded number of steps", () => {
    const r = findRoot((x) => 3 - x, 0, 3, 1, 0, 100, 1e-9);
    expect(r.status).toBe("found");
    if (r.status === "found") {
      expect(r.root).toBeCloseTo(3, 8);
      expect(r.report.iterations).toBeLessThanOrEqual(settings.maxIterations);
      expect(r.report.monotonic).toBe(true);
      expect(r.report.bounds).toEqual({ lo: 0, hi: 100 });
    }
  });
  it("15. a non-monotonic function inside the bracket is refused, not solved", () => {
    const r = findRoot((x) => (x - 5) ** 2 - 1, 0, 24, 1, 0, 10, 1e-9);
    expect(r.status).toBe("non_monotonic");
  });
  it("12. no sign change inside the bounds is not bracketed", () => {
    expect(findRoot((x) => 10 + x, 0, 10, 1, 0, 100, 1e-9).status).toBe("not_bracketed");
    expect(findRoot((x) => 10 + x, 0, 10, -1, 0, 100, 1e-9).status).toBe("not_bracketed");
  });
  it("17. the iteration limit is honoured and reported", () => {
    const r = findRoot((x) => 3 - x, 0, 3, 1, 0, 100, 1e-12, { ...settings, maxIterations: 2, rootToleranceRelative: 1e-15 });
    expect(r.status).toBe("max_iterations");
  });
  it("an evaluation that fails stops the search", () => {
    expect(findRoot(() => null, 0, 1, 1, 0, 10, 1e-9).status).toBe("evaluation_failed");
  });
  it("never searches past its bounds", () => {
    const seen: number[] = [];
    findRoot((x) => { seen.push(x); return 10 + x; }, 5, 15, 1, 0, 50, 1e-9);
    expect(Math.max(...seen)).toBeLessThanOrEqual(50);
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(0);
  });
});

describe("classification transitions", () => {
  it("20. NOT YET VIABLE to CONDITIONALLY VIABLE, with the gate that moved", () => {
    const t = thr(input(bevCost(20000)), "bev", "bevAcquisition", "classification_transition");
    expect(t.status).toBe("FOUND");
    expect(t.transition).toMatchObject({ from: "NOT_YET_VIABLE", to: "CONDITIONALLY_VIABLE", changedGate: "economic" });
    expect(t.transition!.economicCase).toEqual({ from: "UNFAVOURABLE", to: "NEAR_BREAK_EVEN" });
    expect(t.transition!.reasonCodesAdded).toContain("NEAR_BREAK_EVEN");
    expect(t.after!.decisionTrace.length).toBeGreaterThan(3);
    expect(t.before!.decisionTrace.length).toBeGreaterThan(3);
    expect(t.thresholdValue!).toBeLessThan(20000);
    expect(t.thresholdValue!).toBeGreaterThan(15000);
  });
  it("a numeric variable does not always reach VIABLE: the open condition is named", () => {
    const i = input(P({ bev: { upfrontVehicleCost: 20000, batteryReplacement: { expected: "unknown", year: null, cost: null } } }));
    const t = thr(i, "bev", "bevAcquisition", "classification_transition");
    expect(t.transition?.to).toBe("CONDITIONALLY_VIABLE");
    expect(t.caveats.join(" ")).toMatch(/not Viable/);
    const onward = thr(input(P({ bev: { upfrontVehicleCost: 14950, batteryReplacement: { expected: "unknown", year: null, cost: null } } })), "bev", "bevAcquisition", "classification_transition");
    expect(onward.status).toBe("BLOCKED_BY_OPEN_CONDITIONS");
    expect(onward.thresholdValue).toBeNull();
  });
  it("21/22. economic break-even is reached but the route constraint stays: the answer says so", () => {
    const i = input(P({ bev: { upfrontVehicleCost: 20000, usableRangeKm: 300, operational: { chargingOpportunity: "depot_only" } }, operations: { dailyDistanceKm: 450, averageRouteDistanceKm: 350 } }));
    const e = thr(i, "bev", "bevAcquisition");
    expect(e.status).toBe("FOUND");
    expect(e.thresholdValue).toBeCloseTo(15000, 3);
    expect(e.after!.classification).toBe("NOT_YET_VIABLE");
    expect(e.blockers.hardConstraints.length).toBeGreaterThan(0);
    expect(e.statement).toContain("Economic break-even alone does not make this configuration commercially viable because");
    expect(e.statement).toContain("This would achieve economic break-even. The operational constraint would still need to be resolved before commercial viability can improve.");
    expect(e.statement).not.toMatch(/will make the technology viable/);
    const c = thr(i, "bev", "bevAcquisition", "classification_transition");
    expect(c.status).toBe("BLOCKED_BY_OPERATIONAL_CONSTRAINT");
    expect(c.thresholdValue).toBeNull();
  });
  it("VIABLE: the nearest deterioration that changes the label is a margin", () => {
    const t = thr(input(), "bev", "bevAcquisition", "classification_transition");
    expect(t.status).toBe("FOUND");
    expect(t.thresholdKind).toBe("headroom");
    expect(t.transition?.from).toBe("VIABLE");
    expect(t.thresholdValue!).toBeGreaterThan(13000);
  });
  it("the range is an operational variable and moves the operational gate", () => {
    const i = input(longDay("depot_only", { averageRouteDistanceKm: 350 }));
    const t = thr(i, "bev", "bevRange", "classification_transition");
    expect(t.status).toBe("FOUND");
    expect(t.transition?.changedGate).toBe("operational");
    expect(t.thresholdValue!).toBeGreaterThanOrEqual(300);
  });
});

describe("what would make it viable? (critical integration cases A to G)", () => {
  it("A. negative NPV, operationally suitable: NOT YET VIABLE with economic thresholds and a recalculated label", () => {
    const a = analyzeViability(input(bevCost(20000)), "bev");
    expect(a.classification).toBe("NOT_YET_VIABLE");
    expect(a.heading).toBe("WHAT WOULD MAKE IT VIABLE?");
    expect(a.ctaLabel).toBe("Explore What Would Make It Viable");
    expect(a.barriers.economic.map((b) => b.code)).toContain("NEGATIVE_NPV");
    expect(a.barriers.operational).toEqual([]);
    const price = a.economicThresholds.find((t) => t.variableId === "bevAcquisition")!;
    expect(price.status).toBe("FOUND");
    expect(price.after!.classification).not.toBe("NOT_YET_VIABLE");
    expect(a.multipleBarrierNote).toBeNull();
  });
  it("B. negative NPV and a route beyond the range with no charging remedy: separate barriers and a range remedy", () => {
    const i = input(P({ bev: { upfrontVehicleCost: 20000, usableRangeKm: 300, operational: { chargingOpportunity: "depot_only" } }, operations: { dailyDistanceKm: 450, averageRouteDistanceKm: 350 } }));
    const a = analyzeViability(i, "bev");
    expect(a.classification).toBe("NOT_YET_VIABLE");
    expect(a.barriers.economic.length).toBeGreaterThan(0);
    expect(a.barriers.operational.map((b) => b.code)).toContain("ROUTE_EXCEEDS_RANGE");
    expect(a.multipleBarrierNote).toMatch(/money alone would not be enough/);
    const price = a.economicThresholds.find((t) => t.variableId === "bevAcquisition")!;
    expect(price.statement).toContain("Economic break-even alone does not make this configuration commercially viable");
    const range = a.remedies.find((r) => r.kind === "numeric_threshold" && r.resolves === "hard_constraint")!;
    expect(range.value).toBe(350); // the required route distance, with no safety buffer
    expect(range.verified).toBe(true);
    expect(range.text).toContain("minimum model threshold, not an engineering safety recommendation");
  });
  it("B2. without route detail the minimum range is the daily distance", () => {
    const a = analyzeViability(input(longDay("depot_only")), "bev");
    const r = a.remedies.find((x) => x.kind === "numeric_threshold")!;
    expect(r.value).toBe(450);
    expect(r.verified).toBe(true);
  });
  it("C. positive NPV with daytime charging: fully-viable heading, the charging condition, and no invented financial threshold", () => {
    const a = analyzeViability(input(longDay("public_available")), "bev");
    expect(a.classification).toBe("CONDITIONALLY_VIABLE");
    expect(a.heading).toBe("WHAT WOULD MAKE IT FULLY VIABLE?");
    expect(a.ctaLabel).toBe("See What Would Make It Fully Viable");
    expect(a.barriers.operational.map((b) => b.code)).toContain("DAYTIME_CHARGING_REQUIRED");
    expect(a.economicThresholds).toEqual([]);
    expect(a.classificationThresholds).toEqual([]);
    expect(a.remedies.map((r) => r.code)).toContain("DAYTIME_CHARGING_REQUIRED");
    expect(a.notes.join(" ")).toMatch(/no financial threshold is invented/);
  });
  it("C2. a near-break-even conditional result gets classification thresholds toward VIABLE", () => {
    const a = analyzeViability(input(bevCost(14950)), "bev");
    expect(a.classification).toBe("CONDITIONALLY_VIABLE");
    expect(a.classificationThresholds.find((t) => t.variableId === "bevAcquisition")!.status).toBe("FOUND");
  });
  it("D. VIABLE: a viability margin, with the economic headroom per variable", () => {
    const a = analyzeViability(input(), "bev");
    expect(a.classification).toBe("VIABLE");
    expect(a.mode).toBe("viability_margin");
    expect(a.heading).toBe("VIABILITY MARGIN");
    expect(a.ctaLabel).toBe("View Viability Margin");
    const e = a.economicThresholds.find((t) => t.variableId === "electricityTariff")!;
    expect(e.status).toBe("ALREADY_SATISFIED");
    expect(e.thresholdValue).toBeCloseTo(0.09, 6);
    expect(a.notes.join(" ")).toMatch(/not additive/);
  });
  it("E. biofuel with positive NPV and intermittent supply: a qualitative remedy, never a numeric supply threshold", () => {
    const i = input(P({ biofuel: { fuelPricePerFuelUnit: 0.5, supply: { availability: "intermittent" } } }));
    const a = analyzeViability(i, "biofuel");
    expect(a.classification).toBe("CONDITIONALLY_VIABLE");
    const r = a.remedies.find((x) => x.code === "BIOFUEL_SUPPLY_INTERMITTENT")!;
    expect(r.kind).toBe("qualitative");
    expect(r.value).toBeUndefined();
    expect(a.economicThresholds).toEqual([]);
    const t = thr(i, "biofuel", "biofuelAvailability" as VariableId);
    expect(t.status).toBe("NOT_APPLICABLE");
    expect(t.thresholdValue).toBeNull();
  });
  it("24. limited supply and unspecified infrastructure give the stated qualitative remedies", () => {
    const i = input(P({ biofuel: { fuelPricePerFuelUnit: 0.5, supply: { availability: "limited", specialInfrastructure: "yes" } }, infrastructure: { biofuel: { investmentRequired: "yes", storageEquipmentCost: 100, refuellingInfrastructureCost: 100, installationCost: 100 } } }));
    const a = analyzeViability(i, "biofuel");
    expect(a.classification).toBe("NOT_YET_VIABLE");
    expect(a.remedies.map((r) => r.text).join(" ")).toContain("Improve fuel availability to a reliably supportable operating condition");
    expect(a.remedies.every((r) => r.kind === "qualitative")).toBe(true);
  });
  it("F. biofuel with negative NPV and reliable supply: economic thresholds", () => {
    const a = analyzeViability(input(), "biofuel");
    expect(a.classification).toBe("NOT_YET_VIABLE");
    expect(a.economicThresholds.find((t) => t.variableId === "biofuelPrice")!.thresholdValue).toBeCloseTo(0.68, 5);
    expect(a.economicThresholds.find((t) => t.variableId === "dieselPrice")!.status).toBe("FOUND");
  });
  it("G. insufficient evidence: blocked, with the exact missing inputs, and no threshold anywhere", () => {
    const a = analyzeViability(input(longDay(null)), "bev");
    expect(a.classification).toBe("INSUFFICIENT_EVIDENCE");
    expect(a.mode).toBe("blocked");
    expect(a.ctaLabel).toBe("Complete Missing Inputs");
    expect(a.missingInputs.length).toBeGreaterThan(0);
    expect(a.economicThresholds).toEqual([]);
    expect(a.classificationThresholds).toEqual([]);
    expect(a.notes[0]).toBe("Complete these inputs before threshold analysis can be performed.");
  });
  it("payload: the constraint, the minimum effective capacity and the maximum reduction, checked by the engine", () => {
    const i = input(P({ fleet: { payloadCapacityKg: 1000, averagePayloadKg: 900 }, bev: { operational: { payloadImpact: "reduced", payloadReductionKg: 200 } } }));
    const a = analyzeViability(i, "bev");
    expect(a.barriers.operational.map((b) => b.code)).toContain("PAYLOAD_CONSTRAINT");
    const n = a.remedies.find((r) => r.kind === "numeric_threshold")!;
    expect(n.value).toBe(100);
    expect(n.verified).toBe(true);
    expect(a.remedies.find((r) => r.kind === "qualitative")!.text).toMatch(/at least the average payload of 900 kg/);
    expect(a.remedies.map((r) => r.text).join(" ")).toMatch(/does not claim that any particular vehicle/);
  });
  it("barriers come from the reason codes, not the label, and the disclaimer is attached", () => {
    const a = analyzeViability(input(longDay("depot_only")), "bev");
    expect(a.barriers.operational.map((b) => b.code)).toContain("RANGE_EXCEEDED_DEPOT_ONLY");
    expect(a.barriers.economic).toEqual([]);
    expect(a.disclaimer).toMatch(/not forecasts or guaranteed market outcomes/);
    expect(a.disclaimer).toMatch(/all else equal/);
  });
});

describe("scenarios", () => {
  const sc = (over: Scenario["overrides"], name = "S", id = "s1"): Scenario => ({ id, name, description: "", origin: "user", overrides: over, createdAt: "t", updatedAt: "t" });
  it("1/2/4/5. the Base Case is preserved and a single override is calculated against it", () => {
    const i = input();
    const c = compareScenarios(i, [sc({ dieselPrice: 1.2 })]);
    if ("status" in c) throw new Error(c.message);
    expect(c.base.name).toBe("Base Case");
    expect(c.base.bev!.snapshot.npv).toBeCloseTo(2000, 9);
    expect(c.base.bev!.deltaNpv).toBe(0);
    expect(c.scenarios[0]!.bev!.snapshot.npv).toBeCloseTo(3000, 9);
    expect(c.scenarios[0]!.bev!.deltaNpv).toBeCloseTo(1000, 9);
    expect(c.scenarios[0]!.biofuel!.deltaNpv).toBeCloseTo(1250 * 0 + 1000 * 0.2 * 0 + 1000, 6); // diesel price also changes the biofuel comparison
    expect(c.note).toMatch(/lowest cost is not automatically the best/);
  });
  it("3. multiple overrides, with the changed assumptions listed from Base to scenario", () => {
    const c = compareScenarios(input(), [sc({ dieselPrice: 1.5, electricityTariff: 0.04 })]);
    if ("status" in c) throw new Error(c.message);
    const ch = c.scenarios[0]!.changes;
    expect(ch.map((x) => x.variableId).sort()).toEqual(["dieselPrice", "electricityTariff"]);
    expect(ch.find((x) => x.variableId === "dieselPrice")).toMatchObject({ fromText: "{cur}1.00/litre", toText: "{cur}1.50/litre" });
  });
  it("12/14. classification differences are shown, and environmental factors alone cannot change the label", () => {
    const c = compareScenarios(input(), [sc({ bevAcquisition: 30000 }, "Dear BEV")]);
    if ("status" in c) throw new Error(c.message);
    expect(c.scenarios[0]!.bev!.classificationChanged).toBe(true);
    expect(c.scenarios[0]!.bev!.snapshot.classification).toBe("NOT_YET_VIABLE");
    const f1 = compareScenarios(input(FACTORS(2, 0.1, 1.2)), [sc({ dieselPrice: 1 })]);
    const f2 = compareScenarios(input(FACTORS(0.1, 9, 9)), [sc({ dieselPrice: 1 })]);
    if ("status" in f1 || "status" in f2) throw new Error("x");
    expect(f2.scenarios[0]!.bev!.snapshot.classification).toBe(f1.scenarios[0]!.bev!.snapshot.classification);
    expect(f2.base.bev!.snapshot.npv).toBe(f1.base.bev!.snapshot.npv);
  });
  it("categorical overrides (charging access, fuel availability) change the operational layer only", () => {
    const i = input(longDay("depot_only"));
    const c = compareScenarios(i, [sc({ bevChargingOpportunity: "public_available" }, "Improved charging access")]);
    if ("status" in c) throw new Error(c.message);
    expect(c.base.bev!.snapshot.operationalStatus).toBe("constrained");
    expect(c.scenarios[0]!.bev!.snapshot.operationalStatus).toBe("conditional");
    expect(c.scenarios[0]!.bev!.operationalChanged).toBe(true);
    expect(c.scenarios[0]!.bev!.deltaNpv).toBe(0);
    expect(c.scenarios[0]!.changes[0]!.toText).toBe("Public charging available");
  });
  it("10. an invalid override is rejected and named, and never reaches the engine", () => {
    for (const [o, re] of [[{ dieselPrice: -1 }, /cannot be negative/], [{ bevSubsidy: 99999 }, /cannot exceed/], [{ bevInfraCapex: 100 }, /No charging infrastructure/], [{ nonsense: 1 }, /not an assumption/], [{ bevChargingOpportunity: "moon" }, /Choose a listed/]] as const) {
      const c = compareScenarios(input(), [sc(o as never)]);
      if ("status" in c) throw new Error(c.message);
      expect(c.scenarios[0]!.status).toBe("invalid");
      expect(c.scenarios[0]!.errors.join(" ")).toMatch(re);
      expect(c.scenarios[0]!.bev).toBeNull();
    }
    expect(validateScenario(input(), { name: " ", overrides: { dieselPrice: 1 } })).toMatchObject({ ok: false });
    expect(validateScenario(input(), { name: "x", overrides: {} })).toMatchObject({ ok: false });
    expect(validateScenario(input(), { name: "x", overrides: { dieselPrice: 1 } })).toEqual({ ok: true });
    expect(applyOverrides(input(), { dieselPrice: 2 }).ok).toBe(true);
  });
  it("6/7/8. rename, duplicate and delete", () => {
    let list: Scenario[] = [];
    const add = addScenario(list, { name: "  Higher utilisation ", overrides: { annualDistance: 12000 } }, "a", "t1");
    if (!add.ok) throw new Error(add.message);
    list = add.scenarios;
    expect(list[0]!.name).toBe("Higher utilisation");
    expect(list[0]!.origin).toBe("user");
    const ren = renameScenario(list, "a", "Utilisation +20%", "t2");
    if (!ren.ok) throw new Error(ren.message);
    expect(ren.scenarios[0]!.name).toBe("Utilisation +20%");
    const dup = duplicateScenario(ren.scenarios, "a", "b", "t3");
    if (!dup.ok) throw new Error(dup.message);
    expect(dup.scenarios.map((s) => s.name)).toEqual(["Utilisation +20%", "Utilisation +20% (copy)"]);
    expect(dup.scenarios[1]!.overrides).toEqual(dup.scenarios[0]!.overrides);
    expect(dup.scenarios[1]!.overrides).not.toBe(dup.scenarios[0]!.overrides);
    const del = deleteScenario(dup.scenarios, "a");
    if (!del.ok) throw new Error(del.message);
    expect(del.scenarios.map((s) => s.id)).toEqual(["b"]);
    expect(renameScenario(list, "zzz", "x", "t")).toMatchObject({ ok: false });
    expect(renameScenario(list, "a", "  ", "t")).toMatchObject({ ok: false });
    expect(deleteScenario(list, "zzz")).toMatchObject({ ok: false });
  });
  it("9. persistence round-trips, survives corruption, and uses its own key", () => {
    const data = new Map<string, string>();
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
    const repo = createScenarioRepository(storage);
    expect(repo.load()).toEqual([]);
    repo.save([sc({ dieselPrice: 2 })]);
    expect(createScenarioRepository(storage).load()).toEqual([sc({ dieselPrice: 2 })]);
    expect(SCENARIO_KEY).not.toBe("greenfleet-viability-lab:assessment");
    data.set(SCENARIO_KEY, "{broken");
    expect(repo.load()).toEqual([]);
    data.set(SCENARIO_KEY, JSON.stringify({ version: 1, scenarios: [{ id: 1 }, sc({ dieselPrice: 3 })] }));
    expect(repo.load().length).toBe(1);
    expect(createScenarioRepository(null).load()).toEqual([]);
    repo.clear();
    expect(data.has(SCENARIO_KEY)).toBe(false);
  });
  it("15. the scenario limit is handled gracefully", () => {
    let list: Scenario[] = [];
    for (let k = 0; k < MAX_SCENARIOS; k++) {
      const r = addScenario(list, { name: `S${k}`, overrides: { dieselPrice: 1 + k / 10 } }, `id${k}`, "t");
      if (!r.ok) throw new Error(r.message);
      list = r.scenarios;
    }
    const over = addScenario(list, { name: "one too many", overrides: { dieselPrice: 5 } }, "x", "t");
    expect(over).toMatchObject({ ok: false });
    expect((over as { message: string }).message).toMatch(/up to 12 scenarios/);
    const c = compareScenarios(input(), [...list, sc({ dieselPrice: 9 }, "extra", "extra")]);
    if ("status" in c) throw new Error(c.message);
    expect(c.scenarios.length).toBe(MAX_SCENARIOS);
    expect(c.truncated).toBe(1);
  });
  it("creating a scenario from a threshold carries only the one override", () => {
    const t = thr(input(bevCost(20000)), "bev", "bevAcquisition");
    const d = scenarioDraftFromThreshold(t, "BEV")!;
    expect(d.overrides).toEqual({ bevAcquisition: t.thresholdValue });
    expect(d.origin).toBe("threshold");
    expect(d.name).toBe("BEV Economic Break-Even: BEV acquisition price");
    const c = compareScenarios(input(bevCost(20000)), [{ id: "t", name: d.name, description: d.description, origin: "threshold", overrides: d.overrides, createdAt: "", updatedAt: "" }]);
    if ("status" in c) throw new Error(c.message);
    expect(c.scenarios[0]!.bev!.snapshot.npv).toBeCloseTo(0, 3);
    expect(c.base.bev!.snapshot.npv).toBeCloseTo(-5000, 6);
    expect(scenarioDraftFromThreshold(thr(input(bevCost(20000)), "bev", "electricityTariff"), "BEV")).toBeNull();
  });
});

describe("Policy v1.0 and the Batch 3 to 5 results are untouched", () => {
  it("the analysis layers return the same figures the engine returns", () => {
    const i = input(bevCost(20000));
    const e = evaluateInput(i);
    if (!e.ok) throw new Error("x");
    const r = sens(i, "bev", "bevAcquisition");
    expect(r.base.npv).toBe(e.result.bevVsDiesel.npv);
    expect(r.points.find((p) => p.isBase)!.classification).toBe(e.result.commercial.bev.classification);
    expect(r.transparency.policyVersion).toBe("1.0");
    expect(e.result.commercial.bev.policyId).toBe("GreenFleet Commercial Viability Policy v1.0");
  });
});
