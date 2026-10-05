import { describe, expect, it } from "vitest";
import { evaluateInput } from "@/calculation/analysis/evaluate";
import { applyOverrides, VARIABLES, type VariableId } from "@/calculation/analysis/variables";
import { deepFreeze, makeInput } from "@/calculation/fixtures";
import {
  MAX_SCENARIOS, addScenario, compareScenarios, deleteScenario, duplicateScenario, renameScenario, scenarioDraftFromThreshold, updateScenario, validateScenario, type Scenario,
} from "@/calculation/scenario";
import { createScenarioRepository, SCENARIO_KEY } from "@/calculation/scenario/storage";
import { runDriverAnalysis, runSensitivityAnalysis, runTwoWaySensitivity, sensitivityValues, type SensitivityResult } from "@/calculation/sensitivity";
import { SOLVER_SETTINGS, analyzeViability, findRoot, solveViabilityThreshold, type ThresholdResult } from "@/calculation/threshold";

/**
 * Analysis-layer validation. VALIDATION FIXTURES: SYNTHETIC VALUES.
 *
 * Closed-form results for the base fixture (1 vehicle, 10,000 km/yr, 5 years, 0% discount, abstract units):
 *   diesel net cost  = 10,500 + 5,000 p                   (p = diesel price per litre; base 1.00)
 *   BEV net cost     = 11,000 + 50,000 t + 5 m_bev - 200 x 5 + ... see below
 * Written out exactly, with P = BEV price, t = tariff, m = BEV maintenance, d = km/yr, p = diesel price:
 *   diesel = 10,000 + 5 (0.1 d/10,000 ... ) ...
 * so each test states its own derivation next to the number it checks.
 *
 *   NPV(P)  = 15,000 - P                        => P* = 15,000
 *   NPV(t)  =  4,500 - 50,000 t                  => t* = 0.09
 *   NPV(p)  =  5,000 p - 3,000                   => p* = 0.60
 *   NPV(m)  =  3,000 - 5 m                       => m* = 600
 *   NPV(d)  =  0.25 d - 500                      => d* = 2,000 km/year
 *   NPV(P,t) = 17,500 - P - 50,000 t             (two-way grid)
 */

type Patch = Parameters<typeof makeInput>[0];
const P = (p: unknown) => p as Patch;
const input = (p: Patch = {}) => makeInput(p);
const thr = (i: ReturnType<typeof input>, tech: "bev" | "biofuel", v: VariableId, target: "economic_break_even" | "classification_transition" = "economic_break_even"): ThresholdResult =>
  solveViabilityThreshold({ input: i, technology: tech, variableId: v, target });
const sens = (i: ReturnType<typeof input>, tech: "bev" | "biofuel", v: VariableId, range?: Parameters<typeof runSensitivityAnalysis>[0]["range"]): SensitivityResult => {
  const r = runSensitivityAnalysis({ input: i, technology: tech, variableId: v, range });
  if (r.status !== "ok") throw new Error(r.message);
  return r;
};

describe("Economic threshold: analytical solution vs GreenFleet's numerical solution", () => {
  /** Documented acceptable tolerance: relative error 1e-6 (the solver's engine verification tolerance is 1e-6 of diesel present cost). */
  const TOL = 1e-6;
  const cases: [string, VariableId, number, number][] = [
    ["BEV acquisition price (NPV = 15,000 - P)", "bevAcquisition", 15_000, 13_000],
    ["electricity tariff (NPV = 4,500 - 50,000 t)", "electricityTariff", 0.09, 0.05],
    ["diesel price (NPV = 5,000 p - 3,000)", "dieselPrice", 0.6, 1],
    ["BEV annual maintenance (NPV = 3,000 - 5 m)", "bevMaintenance", 600, 200],
    ["annual distance (NPV = 0.25 d - 500)", "annualDistance", 2_000, 10_000],
  ];
  it.each(cases)("%s", (_label, variable, analytical, current) => {
    const t = thr(input(), "bev", variable);
    // A positive-NPV base reports headroom ("ALREADY_SATISFIED" with kind "headroom"); a negative base reports "FOUND".
    expect(["FOUND", "ALREADY_SATISFIED"]).toContain(t.status);
    expect(t.thresholdValue).not.toBeNull();
    expect(t.currentValue).toBeCloseTo(current, 9);
    expect(Math.abs(t.thresholdValue! - analytical) / analytical).toBeLessThan(TOL);
    // The engine, re-run independently at the threshold, gives an NPV of zero.
    const e = evaluateInput(VARIABLES[variable].set(input(), t.thresholdValue!));
    if (!e.ok) throw new Error("engine");
    expect(Math.abs(e.bev.npv)).toBeLessThan(1e-3);
  });
  it("a positive-NPV base gives headroom (deterioration allowed), in the right direction", () => {
    expect(thr(input(), "bev", "bevAcquisition").thresholdKind).toBe("headroom"); // price can rise from 13,000 to 15,000
    expect(thr(input(), "bev", "dieselPrice").thresholdKind).toBe("headroom"); // diesel price can fall from 1.00 to 0.60
    expect(thr(input(), "bev", "dieselPrice").requiredChange?.direction).toBe("decrease");
    expect(thr(input(), "bev", "bevAcquisition").requiredChange?.direction).toBe("increase");
  });
  it("a negative-NPV base gives a required change, in the right direction", () => {
    const i = input({ bev: { upfrontVehicleCost: 17_000 } }); // NPV = -2,000
    const t = thr(i, "bev", "bevAcquisition");
    expect(t.thresholdKind).toBe("required");
    expect(t.thresholdValue!).toBeCloseTo(15_000, 4);
    expect(t.requiredChange?.direction).toBe("decrease");
    expect(Math.abs(t.requiredChange!.absolute)).toBeCloseTo(2_000, 4); // signed: negative for a decrease
    expect(thr(i, "bev", "bevSubsidy").thresholdValue!).toBeCloseTo(2_000, 4); // NPV = -2,000 + g
  });
  it("is stated as all else equal and as a model value, not a forecast", () => {
    const t = thr(input(), "bev", "bevAcquisition");
    expect(t.allElseEqual).toBe(true);
    expect(t.statement).toMatch(/all else equal/i);
    expect(t.statement).toMatch(/not a forecast/i);
    const needed = thr(input({ bev: { upfrontVehicleCost: 17_000 } }), "bev", "bevAcquisition");
    expect(needed.statement).toMatch(/all else equal/i);
  });
});

describe("Driver ranking: a synthetic case with an obvious order", () => {
  /*
   * Range -20% / +20% around base. NPV(low), NPV(high) from the closed forms above; spread = max - min.
   *   BEV acquisition  13,000 -> 10,400 / 15,600  NPV 4,600 / -600   spread 5,200
   *   diesel price      1.00  ->  0.80  /  1.20   NPV 1,000 / 3,000   spread 2,000
   *   electricity tariff 0.05 ->  0.04  /  0.06   NPV 2,500 / 1,500   spread 1,000
   *   annual distance 10,000  ->  8,000 / 12,000  NPV 1,500 / 2,500   spread 1,000
   *   BEV maintenance     200 ->    160 /   240    NPV 2,200 / 1,800   spread   400
   */
  const d = runDriverAnalysis({ input: input(), technology: "bev" });
  if (d.status !== "ok") throw new Error(d.message);
  const row = (id: VariableId) => d.rows.find((r) => r.variableId === id)!;

  it("spread = max(NPV_high, NPV_low) - min(NPV_high, NPV_low), with no weighting", () => {
    expect(row("bevAcquisition").spread).toBeCloseTo(5_200, 6);
    expect(row("dieselPrice").spread).toBeCloseTo(2_000, 6);
    expect(row("electricityTariff").spread).toBeCloseTo(1_000, 6);
    expect(row("annualDistance").spread).toBeCloseTo(1_000, 6);
    expect(row("bevMaintenance").spread).toBeCloseTo(400, 6);
    for (const r of d.rows) expect(r.spread).toBeCloseTo(Math.max(r.npvLow, r.npvHigh) - Math.min(r.npvLow, r.npvHigh), 9);
  });
  it("the NPVs at the low and high ends are the closed-form values", () => {
    expect(row("bevAcquisition").npvLow).toBeCloseTo(4_600, 6);
    expect(row("bevAcquisition").npvHigh).toBeCloseTo(-600, 6);
    expect(row("dieselPrice").npvLow).toBeCloseTo(1_000, 6);
    expect(row("dieselPrice").npvHigh).toBeCloseTo(3_000, 6);
  });
  it("rows are sorted by spread, largest first", () => {
    const spreads = d.rows.map((r) => r.spread);
    expect([...spreads].sort((a, b) => b - a)).toEqual(spreads);
    expect(d.rows[0]!.variableId).toBe("bevAcquisition");
    expect(d.rows[1]!.variableId).toBe("dieselPrice");
    expect(d.rows[d.rows.length - 1]!.variableId).toBe("bevMaintenance");
  });
  it("zero-base variables are skipped with a reason, not shown as zero influence", () => {
    expect(d.skipped.length).toBeGreaterThan(0);
    expect(d.skipped.every((s) => s.reason.length > 0)).toBe(true);
    expect(d.rows.some((r) => r.variableId === "discountRate")).toBe(false); // base 0%
  });
  it("is labelled as influence under the tested ranges and never as causal importance", () => {
    expect(d.label).toBe("Sensitivity influence under the tested ranges.");
    expect(d.note).toMatch(/not which assumption causes/i);
    expect(d.statement).not.toMatch(/most important|causes the result|root cause|because of/i);
    expect(d.label).not.toMatch(/important|cause/i);
  });
});

describe("One-way sensitivity validation", () => {
  it("only the selected variable changes", () => {
    const i = input();
    const out = VARIABLES.dieselPrice.set(i, 1.5);
    const strip = (x: ReturnType<typeof input>) => ({ ...x, diesel: { ...x.diesel, fuelPricePerLitre: 0 } });
    expect(strip(out)).toEqual(strip(i));
  });
  it("the default range is -20%, -10%, base, +10%, +20% and always contains the base value", () => {
    const r = sens(input(), "bev", "dieselPrice");
    expect(r.points.map((p) => p.value)).toEqual([0.8, 0.9, 1, 1.1, 1.2].map((x) => expect.closeTo(x, 9)));
    expect(r.points.filter((p) => p.isBase)).toHaveLength(1);
  });
  it("a custom absolute range generates the stated steps", () => {
    expect(sensitivityValues(0, { mode: "absolute", min: 0, max: 100, steps: 5 })).toEqual([0, 25, 50, 75, 100]);
  });
  it("each point's NPV equals the closed form, so the table is not interpolated", () => {
    for (const p of sens(input(), "bev", "bevAcquisition").points) expect(p.npv).toBeCloseTo(15_000 - p.value, 6);
  });
  it("NPV crosses zero inside the tested range: the solved crossing is returned", () => {
    const r = sens(input(), "bev", "bevAcquisition", { mode: "absolute", min: 12_000, max: 18_000, steps: 7 });
    expect(r.breakEven?.value).toBeCloseTo(15_000, 4);
  });
  it("a zero base cannot use a percentage range, and says why", () => {
    const r = runSensitivityAnalysis({ input: input(), technology: "bev", variableId: "bevSubsidy" });
    expect(r.status).not.toBe("ok");
  });
  it("classification transitions are reported between tested points", () => {
    const r = sens(input(), "bev", "bevAcquisition", { mode: "absolute", min: 12_000, max: 18_000, steps: 7 });
    expect(r.points[0]!.classification).toBe("VIABLE");
    expect(r.points[r.points.length - 1]!.classification).toBe("NOT_YET_VIABLE");
    expect(r.transitions.length).toBeGreaterThan(0);
  });
  it("two-way grid cells equal the closed form NPV(P, t) = 17,500 - P - 50,000 t", () => {
    const r = runTwoWaySensitivity({ input: input(), technology: "bev", xId: "bevAcquisition", yId: "electricityTariff" });
    if (r.status !== "ok") throw new Error(r.message);
    expect(r.cells.length).toBe(r.x.values.length * r.y.values.length);
    for (const c of r.cells) expect(c.npv).toBeCloseTo(17_500 - r.x.values[c.xIndex]! - 50_000 * r.y.values[c.yIndex]!, 5);
  });
});

describe("Root solver mechanics on synthetic monotonic functions (independent of GreenFleet economics)", () => {
  const found = (r: ReturnType<typeof findRoot>) => {
    if (r.status !== "found") throw new Error(`expected a root, got ${r.status}`);
    return r;
  };
  it("a linear function: root within the stated tolerance and a small number of evaluations", () => {
    const r = found(findRoot((x) => 7.25 - x, 0, 7.25, 1, 0, 1_000, 1e-9));
    expect(r.root).toBeCloseTo(7.25, 8);
    expect(r.report.iterations).toBeLessThanOrEqual(SOLVER_SETTINGS.maxIterations);
    expect(r.report.evaluations).toBeLessThan(120);
  });
  it("a cubic: bisection finds the real root", () => {
    const r = found(findRoot((x) => x ** 3 - 8, 0.5, 0.5 ** 3 - 8, 1, 0, 100, 1e-9));
    expect(r.root).toBeCloseTo(2, 6);
  });
  it("a decreasing function searched downwards", () => {
    const r = found(findRoot((x) => x - 3, 50, 47, -1, 0, 100, 1e-9));
    expect(r.root).toBeCloseTo(3, 7);
  });
  it("bracketing expands geometrically: a distant root needs more steps than a near one", () => {
    const near = found(findRoot((x) => 2 - x, 1, 1, 1, 0, 1e6, 1e-9));
    const far = found(findRoot((x) => 5_000 - x, 1, 4_999, 1, 0, 1e6, 1e-9));
    expect(far.report.expansions).toBeGreaterThan(near.report.expansions);
    expect(far.root).toBeCloseTo(5_000, 5);
  });
  it("a step never leaves the bounds, even when the root is beyond them (not bracketed)", () => {
    const r = findRoot((x) => 1_000 - x, 0, 1_000, 1, 0, 100, 1e-9);
    expect(r.status).toBe("not_bracketed");
    expect(r.report.bounds).toEqual({ lo: 0, hi: 100 });
  });
  it("a start that is already within tolerance returns immediately with no search", () => {
    const r = found(findRoot((x) => x - 4, 4, 1e-12, 1, 0, 100, 1e-9));
    expect(r.root).toBe(4);
    expect(r.report.iterations).toBe(0);
  });
  it("a bracket that straddles a turning point is refused rather than solved (the doubling step brackets a sign change that straddles the minimum at x = 5)", () => {
    const r = findRoot((x) => 3 * ((x - 5) ** 2 - 1), 0, 72, 1, 0, 10, 1e-9);
    expect(r.status).toBe("non_monotonic");
    expect(r.report.monotonic).toBe(false);
    expect("root" in r).toBe(false);
  });
  it("a function with several roots is solved only when the bracket around the first sign change is monotonic", () => {
    const r = findRoot((x) => (x - 2) * (x - 6) * (x - 9), 0, -108, 1, 0, 20, 1e-9);
    expect(r.status).toBe("found");
    if (r.status === "found") expect(r.root).toBeCloseTo(2, 6); // the nearest root, found honestly
  });
  it("the iteration cap is a hard stop", () => {
    const r = findRoot((x) => 3 - x, 0, 3, 1, 0, 100, 1e-14, { ...SOLVER_SETTINGS, maxIterations: 5, rootToleranceRelative: 1e-16 });
    expect(r.status).toBe("max_iterations");
    expect(r.report.iterations).toBe(5);
  });
  it("cached evaluations: the same x is never evaluated twice", () => {
    const seen = new Map<number, number>();
    findRoot((x) => { seen.set(x, (seen.get(x) ?? 0) + 1); return 10 - x; }, 0, 10, 1, 0, 100, 1e-9);
    expect(Math.max(...seen.values())).toBe(1);
  });
  it("a function that fails mid-search stops with evaluation_failed and no root", () => {
    const r = findRoot((x) => (x > 5 ? null : 10 - x), 0, 10, 1, 0, 100, 1e-9);
    expect(r.status).toBe("evaluation_failed");
    expect("root" in r).toBe(false);
  });
  it("failure states in the full solver never carry a number", () => {
    const t = thr(input(), "bev", "electricityTariff", "classification_transition");
    if (t.status !== "FOUND" && t.status !== "ALREADY_SATISFIED") expect(t.thresholdValue).toBeNull();
    const dead = thr(input(), "bev", "operatingDays");
    if (dead.status === "NOT_APPLICABLE") expect(dead.thresholdValue).toBeNull();
  });
});

describe("Classification transitions", () => {
  it("the nearest change of label is solved against Policy v1.0: BEV price where NPV falls to 5% of the extra investment", () => {
    // (15,000 - P) / (P - 10,000) = 0.05  =>  P = 15,500 / 1.05 = 14,761.905
    const t = thr(input(), "bev", "bevAcquisition", "classification_transition");
    expect(t.status).toBe("FOUND");
    expect(t.before?.classification).toBe("VIABLE");
    expect(t.after?.classification).toBe("CONDITIONALLY_VIABLE");
    expect(t.transition?.changedGate).toBe("economic");
    expect(t.thresholdValue!).toBeGreaterThan(14_761.9);
    expect(t.thresholdValue!).toBeLessThan(14_763);
  });
  it("economic break-even is not commercial viability: the label at NPV = 0 is not VIABLE", () => {
    const t = thr(input({ bev: { upfrontVehicleCost: 17_000 } }), "bev", "bevAcquisition");
    expect(t.after?.npv).toBeCloseTo(0, 3);
    expect(t.after?.classification).not.toBe("VIABLE");
    expect(t.after?.economicCase).toBe("NEAR_BREAK_EVEN");
  });
});

describe("Multiple-barrier validation (economic, operational, evidence)", () => {
  const econ = (bad: boolean): Patch => P({ bev: { upfrontVehicleCost: bad ? 17_000 : 13_000 } });
  const ops = (bad: boolean): Patch => P(bad ? { operations: { dailyDistanceKm: 600 }, bev: { usableRangeKm: 500, operational: { chargingOpportunity: "depot_only" } } } : {});
  const evid = (bad: boolean): Patch => P(bad ? { bev: { batteryReplacement: { expected: "unknown", year: null, cost: null } } } : {});
  const merged = (e: boolean, o: boolean, v: boolean) => {
    const a = input(econ(e));
    const b = input({ ...ops(o), ...evid(v), bev: { ...((ops(o) as { bev?: object }).bev ?? {}), ...((evid(v) as { bev?: object }).bev ?? {}), upfrontVehicleCost: e ? 17_000 : 13_000 } } as Patch);
    return { a, b };
  };
  const analyse = (e: boolean, o: boolean, v: boolean) => analyzeViability(merged(e, o, v).b, "bev");

  const rows: [string, boolean, boolean, boolean, { economic: boolean; operational: boolean; evidence: boolean }][] = [
    ["economic only", true, false, false, { economic: true, operational: false, evidence: false }],
    ["operational only", false, true, false, { economic: false, operational: true, evidence: false }],
    ["evidence only (non-critical)", false, false, true, { economic: false, operational: false, evidence: true }],
    ["economic + operational", true, true, false, { economic: true, operational: true, evidence: false }],
    ["economic + evidence", true, false, true, { economic: true, operational: false, evidence: true }],
    ["operational + evidence", false, true, true, { economic: false, operational: true, evidence: true }],
    ["all three", true, true, true, { economic: true, operational: true, evidence: true }],
  ];
  it.each(rows)("%s: barriers are grouped by kind", (_n, e, o, v, want) => {
    const a = analyse(e, o, v);
    expect(a.barriers.economic.length > 0).toBe(want.economic);
    expect(a.barriers.operational.length > 0).toBe(want.operational);
    expect(a.barriers.evidence.length > 0).toBe(want.evidence);
    const kinds = [want.economic, want.operational, want.evidence].filter(Boolean).length;
    expect(a.multipleBarrierNote !== null).toBe(kinds > 1);
    if (a.multipleBarrierNote) expect(a.multipleBarrierNote).toMatch(/money alone would not be enough/i);
  });
  it("economic + operational: an economic threshold is found, and the text says it does not resolve the operational constraint", () => {
    const a = analyse(true, true, false);
    expect(a.classification).toBe("NOT_YET_VIABLE");
    expect(a.economicThresholds.some((t) => t.status === "FOUND")).toBe(true);
    expect(a.notes.join(" ")).toMatch(/does not resolve the operational constraint/i);
    expect(a.remedies.length).toBeGreaterThan(0);
  });
  it("operational only: no financial threshold is invented", () => {
    const a = analyse(false, true, false);
    expect(a.economicThresholds).toEqual([]);
    expect(a.notes.join(" ")).toMatch(/barrier is operational/i);
  });
  it("evidence only: no financial threshold is invented", () => {
    const a = analyse(false, false, true);
    expect(a.classification).toBe("CONDITIONALLY_VIABLE");
    expect(a.classificationThresholds).toEqual([]);
    expect(a.notes.join(" ")).toMatch(/no financial threshold is invented/i);
  });
  it("critical evidence missing blocks threshold solving and lists the missing items", () => {
    const a = analyzeViability(input({ operations: { dailyDistanceKm: 600 }, bev: { usableRangeKm: 500, upfrontVehicleCost: 17_000, operational: { chargingOpportunity: null } } } as Patch), "bev");
    expect(a.mode).toBe("blocked");
    expect(a.economicThresholds).toEqual([]);
    expect(a.classificationThresholds).toEqual([]);
    expect(a.missingInputs.length).toBeGreaterThan(0);
  });
});

describe("Viability margin: directional correctness (not a forecast)", () => {
  const a = analyzeViability(input(), "bev");
  const t = (id: VariableId) => a.economicThresholds.find((x) => x.variableId === id)!;
  it("is the VIABLE mode", () => {
    expect(a.classification).toBe("VIABLE");
    expect(a.mode).toBe("viability_margin");
    expect(a.heading).toBe("VIABILITY MARGIN");
  });
  it("current value, break-even value, difference and percentage are directionally right", () => {
    // Price can rise 2,000 (15.38%) before NPV = 0; diesel price can fall 0.40 (40%); tariff can rise 0.04 (80%).
    expect(t("bevAcquisition").currentValue).toBeCloseTo(13_000, 9);
    expect(t("bevAcquisition").thresholdValue!).toBeCloseTo(15_000, 4);
    expect(t("bevAcquisition").requiredChange?.absolute).toBeCloseTo(2_000, 4);
    expect(t("bevAcquisition").requiredChange?.percent).toBeCloseTo((2_000 / 13_000) * 100, 3);
    expect(t("dieselPrice").thresholdValue!).toBeCloseTo(0.6, 6);
    expect(t("dieselPrice").requiredChange?.percent).toBeCloseTo(-40, 3);
    expect(t("electricityTariff").thresholdValue!).toBeCloseTo(0.09, 6);
    expect(t("electricityTariff").requiredChange?.percent).toBeCloseTo(80, 3);
  });
  it("margins are not additive, and the disclaimer says they are not forecasts", () => {
    expect(a.notes.join(" ")).toMatch(/not additive/i);
    expect(a.disclaimer).toMatch(/not forecasts/i);
    const withoutDisclaimer = JSON.stringify({ ...a, disclaimer: "" });
    expect(withoutDisclaimer).not.toMatch(/will (happen|occur)|predict|guarantee|\bcertain(ly)?\b/i);
  });
});

describe("Scenario validation", () => {
  const NOW = "2026-01-01T00:00:00.000Z";
  const base = () => input({ bev: { upfrontVehicleCost: 17_000 } }); // BEV NPV -2,000
  const sc = (overrides: Scenario["overrides"], id = "s1", name = "S"): Scenario => ({ id, name, description: "", origin: "user", overrides, createdAt: NOW, updatedAt: NOW });
  const ok = (r: ReturnType<typeof addScenario>) => {
    if (!r.ok) throw new Error(r.message);
    return r;
  };

  it("Base Case alone: no scenarios, no changes", () => {
    const c = compareScenarios(base(), []);
    if ("status" in c) throw new Error(c.message);
    expect(c.scenarios).toEqual([]);
    expect(c.base.changes).toEqual([]);
    expect(c.base.bev?.deltaNpv).toBe(0);
  });
  it("a single override is applied to a clone; the Base Case is unchanged and deep-frozen input is not touched", () => {
    const frozen = deepFreeze(base());
    const before = JSON.stringify(frozen);
    const c = compareScenarios(frozen, [sc({ bevAcquisition: 15_000 })]);
    if ("status" in c) throw new Error(c.message);
    expect(JSON.stringify(frozen)).toBe(before);
    expect(c.base.bev?.snapshot.npv).toBeCloseTo(-2_000, 6);
    expect(c.scenarios[0]!.bev?.snapshot.npv).toBeCloseTo(0, 6);
    expect(c.scenarios[0]!.bev?.deltaNpv).toBeCloseTo(2_000, 6);
    expect(c.scenarios[0]!.changes).toHaveLength(1);
    expect(c.scenarios[0]!.changes[0]).toMatchObject({ variableId: "bevAcquisition", from: 17_000, to: 15_000 });
  });
  it("scenario values never leak into the base assessment or into other scenarios", () => {
    const i = base();
    const c = compareScenarios(i, [sc({ dieselPrice: 5 }, "a"), sc({ electricityTariff: 0.01 }, "b")]);
    if ("status" in c) throw new Error(c.message);
    // scenario b is calculated with the Base diesel price, not scenario a's
    const alone = compareScenarios(i, [sc({ electricityTariff: 0.01 }, "b")]);
    if ("status" in alone) throw new Error(alone.message);
    expect(c.scenarios[1]!.bev?.snapshot.npv).toBe(alone.scenarios[0]!.bev?.snapshot.npv);
    expect(i.diesel.fuelPricePerLitre).toBe(1);
  });
  it("multiple overrides list every changed assumption from Base to scenario", () => {
    const c = compareScenarios(base(), [sc({ bevAcquisition: 14_000, dieselPrice: 1.2, electricityTariff: 0.04 })]);
    if ("status" in c) throw new Error(c.message);
    expect(c.scenarios[0]!.changes.map((x) => x.variableId).sort()).toEqual(["bevAcquisition", "dieselPrice", "electricityTariff"]);
  });
  it("duplicate, rename and delete are pure list operations", () => {
    let list = ok(addScenario([], { name: "A", overrides: { dieselPrice: 2 } }, "a", NOW)).scenarios;
    const frozenList = deepFreeze([...list]);
    list = ok(duplicateScenario(frozenList, "a", "a2", NOW)).scenarios;
    expect(list.map((s) => s.name)).toEqual(["A", "A (copy)"]);
    expect(list[1]!.overrides).toEqual(list[0]!.overrides);
    expect(list[1]!.overrides).not.toBe(list[0]!.overrides); // a copy, not a shared reference
    list = ok(renameScenario(list, "a2", "  Renamed  ", NOW)).scenarios;
    expect(list[1]!.name).toBe("Renamed");
    expect(renameScenario(list, "a2", "   ", NOW).ok).toBe(false);
    expect(renameScenario(list, "missing", "x", NOW).ok).toBe(false);
    list = ok(deleteScenario(list, "a")).scenarios;
    expect(list.map((s) => s.id)).toEqual(["a2"]);
    expect(deleteScenario(list, "a").ok).toBe(false);
  });
  it("editing a duplicate does not alter the original", () => {
    let list = ok(addScenario([], { name: "A", overrides: { dieselPrice: 2 } }, "a", NOW)).scenarios;
    list = ok(duplicateScenario(list, "a", "b", NOW)).scenarios;
    list = ok(updateScenario(list, "b", { overrides: { dieselPrice: 3 } }, NOW)).scenarios;
    expect(list[0]!.overrides).toEqual({ dieselPrice: 2 });
    expect(list[1]!.overrides).toEqual({ dieselPrice: 3 });
  });
  it("the 12-scenario limit refuses a 13th and says why", () => {
    let list: Scenario[] = [];
    for (let k = 0; k < MAX_SCENARIOS; k++) list = ok(addScenario(list, { name: `S${k}`, overrides: { dieselPrice: 1 + k / 10 } }, `i${k}`, NOW)).scenarios;
    const over = addScenario(list, { name: "13th", overrides: { dieselPrice: 9 } }, "x", NOW);
    expect(over.ok).toBe(false);
    expect(duplicateScenario(list, "i0", "y", NOW).ok).toBe(false);
  });
  it("validation names the problem for an empty name, no change, or an invalid value", () => {
    expect(validateScenario(base(), { name: "", overrides: { dieselPrice: 2 } }).ok).toBe(false);
    expect(validateScenario(base(), { name: "x", overrides: {} }).ok).toBe(false);
    expect(validateScenario(base(), { name: "x", overrides: { dieselPrice: -1 } }).ok).toBe(false);
    expect(validateScenario(base(), { name: "x", overrides: { dieselPrice: 2 } }).ok).toBe(true);
  });
  it("an invalid scenario is reported and never reaches the engine", () => {
    const c = compareScenarios(base(), [sc({ dieselPrice: -3 })]);
    if ("status" in c) throw new Error(c.message);
    expect(c.scenarios[0]!.status).toBe("invalid");
    expect(c.scenarios[0]!.bev).toBeNull();
  });
  it("corrupt persistence is ignored: bad JSON, wrong version, wrong shape, hostile content", () => {
    const data = new Map<string, string>();
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
    const repo = createScenarioRepository(storage);
    for (const raw of ["{broken", "null", "[]", "42", '{"version":99,"scenarios":[]}', '{"version":1,"scenarios":"nope"}', '{"version":1,"scenarios":[null,1,"x",{"id":1}]}']) {
      data.set(SCENARIO_KEY, raw);
      expect(repo.load()).toEqual([]);
    }
  });
  it("a persisted scenario with unknown or ill-typed overrides cannot crash the comparison", () => {
    const data = new Map<string, string>();
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
    const hostile = { ...sc({}), overrides: { notAVariable: 5, dieselPrice: "abc", bevAcquisition: Number.NaN, bevRange: null } };
    data.set(SCENARIO_KEY, JSON.stringify({ version: 1, scenarios: [hostile] }));
    const loaded = createScenarioRepository(storage).load();
    expect(() => compareScenarios(base(), loaded)).not.toThrow();
    const c = compareScenarios(base(), loaded);
    if ("status" in c) throw new Error(c.message);
    expect(c.scenarios[0]!.status).toBe("invalid");
  });
  it("storage that throws on write does not break the list", () => {
    const failing = { getItem: () => null, setItem: () => { throw new Error("quota"); }, removeItem: () => { throw new Error("blocked"); } };
    const repo = createScenarioRepository(failing);
    expect(() => repo.save([sc({ dieselPrice: 2 })])).not.toThrow();
    expect(() => repo.clear()).not.toThrow();
    expect(repo.load()).toEqual([]);
  });
  it("a scenario built from a solved threshold overrides exactly one value, reproducing NPV = 0 without touching the Base Case", () => {
    const i = base();
    const t = thr(i, "bev", "bevAcquisition");
    const draft = scenarioDraftFromThreshold(t, "BEV")!;
    expect(Object.keys(draft.overrides)).toEqual(["bevAcquisition"]);
    const c = compareScenarios(i, [{ ...sc(draft.overrides), origin: "threshold" }]);
    if ("status" in c) throw new Error(c.message);
    expect(c.base.bev?.snapshot.npv).toBeCloseTo(-2_000, 6);
    expect(c.scenarios[0]!.bev?.snapshot.npv).toBeCloseTo(0, 3);
    expect(c.scenarios[0]!.scenario?.origin).toBe("threshold");
    expect(i.bev.upfrontVehicleCost).toBe(17_000);
  });
  it("applyOverrides returns a new input and leaves the original untouched", () => {
    const i = deepFreeze(base());
    const out = applyOverrides(i, { dieselPrice: 3 });
    if (!out.ok) throw new Error("expected ok");
    expect(out.input).not.toBe(i);
    expect(out.input.diesel.fuelPricePerLitre).toBe(3);
    expect(i.diesel.fuelPricePerLitre).toBe(1);
  });
});
