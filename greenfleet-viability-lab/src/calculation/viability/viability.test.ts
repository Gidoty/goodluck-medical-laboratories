import { describe, expect, it } from "vitest";
import { calculateAssessment } from "../engine";
import { deepFreeze, makeInput } from "../fixtures";
import type { AssessmentCalculationResult } from "../types";
import { assessEconomics, classifyCommercialViability, COMMERCIAL_VIABILITY_POLICY_V1, toleranceDenominator } from "./index";

/**
 * Base fixture (see ../fixtures.ts): BEV NPV = +2,000 on 3,000 extra investment; biofuel NPV = -750 on 500.
 * BEV range 500 km against 100 km/day, biofuel supply "reliable" with no special infrastructure.
 * Abstract currency units only.
 */
type Patch = Parameters<typeof makeInput>[0];
const factor = (value: number, unit: string, unitId: string) => ({ value, unit, unitId, scope: null, source: "Test source", sourceYear: 2020, notes: null, lifecycleAdjustmentPct: null });
const FACTORS = (diesel = 2, grid = 0.1, bio = 1.2): Patch => ({
  environmentalAssumptions: { diesel: factor(diesel, "kg CO2e/litre", "kgco2e_per_litre"), gridElectricity: factor(grid, "kg CO2e/kWh", "kgco2e_per_kwh"), biofuel: factor(bio, "kg CO2e/litre", "kgco2e_per_litre") },
});
function run(...patches: Patch[]): AssessmentCalculationResult {
  const o = calculateAssessment(makeInput(Object.assign({}, ...patches) as Patch));
  if (!o.ok) throw new Error(o.errors.map((e) => e.message).join("; "));
  return o.result;
}
const bevCost = (upfront: number): Patch => ({ bev: { upfrontVehicleCost: upfront } }) as Patch;
const longDay = (opportunity: string | null, extra: Record<string, unknown> = {}): Patch => ({ operations: { dailyDistanceKm: 450, ...extra }, bev: { usableRangeKm: 300, operational: { chargingOpportunity: opportunity } } }) as Patch;
const bio = (price: number, supply: Record<string, unknown> = {}): Patch => ({ biofuel: { fuelPricePerFuelUnit: price, supply: { availability: "reliable", specialInfrastructure: "no", ...supply } } }) as Patch;
const cls = (r: AssessmentCalculationResult, t: "bev" | "biofuel") => r.commercial[t].classification;

describe("policy and result shape", () => {
  const r = run();
  it("returns the policy version and id", () => {
    expect(r.commercial.bev.policyVersion).toBe("1.0");
    expect(r.commercial.bev.policyId).toBe("GreenFleet Commercial Viability Policy v1.0");
    expect(COMMERCIAL_VIABILITY_POLICY_V1.nearBreakEvenTolerancePct).toBe(5);
  });
  it("classifies only the two green alternatives; diesel is the baseline and gets no label", () => {
    expect(Object.keys(r.commercial).sort()).toEqual(["bev", "biofuel"]);
    expect(r.commercial.bev.baselineTechnology).toBe("diesel");
    expect(JSON.stringify(r.commercial)).not.toMatch(/"technology":"diesel"/);
  });
  it("returns reason codes, a decision trace, supporting evidence and next steps", () => {
    const c = r.commercial.bev;
    expect(c.reasonCodes.length).toBeGreaterThan(0);
    expect(c.decisionTrace.length).toBeGreaterThan(4);
    expect(c.decisionTrace.map((s) => s.step)).toEqual(c.decisionTrace.map((_, i) => i + 1));
    expect(c.decisionTrace[c.decisionTrace.length - 1]!.text).toMatch(/^Classification = VIABLE/);
    expect(c.supportingEvidence.length).toBeGreaterThan(3);
    expect(c.primaryReason).toMatch(/NPV/);
  });
  it("has no numeric score, weight or percentage-of-viability anywhere in the result", () => {
    expect(JSON.stringify(r.commercial)).not.toMatch(/"(score|weight|rating)"/i);
  });
  it("is reproducible: the same input gives the same result, byte for byte", () => {
    expect(JSON.stringify(run(FACTORS()))).toBe(JSON.stringify(run(FACTORS())));
    const input = deepFreeze(makeInput(longDay("public_available")));
    const a = calculateAssessment(input);
    const b = calculateAssessment(input);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("the decision matrix (BEV)", () => {
  it("favourable + suitable => VIABLE", () => {
    const c = run().commercial.bev;
    expect(c.classification).toBe("VIABLE");
    expect(c.economicCase).toBe("FAVOURABLE");
    expect(c.operationalStatus).toBe("suitable");
    expect(c.reasonCodes).toEqual(expect.arrayContaining(["POSITIVE_NPV", "OPERATIONALLY_SUITABLE", "PAYBACK_WITHIN_HORIZON"]));
  });
  it("favourable + conditional (daytime charging) => CONDITIONALLY VIABLE with a derived condition", () => {
    const c = run(longDay("public_available")).commercial.bev;
    expect(c.classification).toBe("CONDITIONALLY_VIABLE");
    expect(c.conditions.map((x) => x.code)).toContain("DAYTIME_CHARGING_REQUIRED");
    expect(c.primaryReason).toMatch(/daytime charging is required/);
    expect(c.hardConstraints).toEqual([]);
    for (const o of ["destination_available", "mixed"]) expect(run(longDay(o)).commercial.bev.classification).toBe("CONDITIONALLY_VIABLE");
  });
  it("depot-only with routes that fit is a remediable condition, not a hard constraint", () => {
    const c = run(longDay("depot_only", { averageRouteDistanceKm: 150 })).commercial.bev;
    expect(c.classification).toBe("CONDITIONALLY_VIABLE");
    expect(c.conditions.map((x) => x.code)).toContain("DEPOT_RECHARGE_BETWEEN_ROUTES");
  });
  it("positive NPV + a single route longer than the range + depot-only => NOT YET VIABLE", () => {
    const c = run(longDay("depot_only", { averageRouteDistanceKm: 350 })).commercial.bev;
    expect(c.economicCase).toBe("FAVOURABLE");
    expect(c.classification).toBe("NOT_YET_VIABLE");
    expect(c.hardConstraints.map((h) => h.code)).toContain("ROUTE_EXCEEDS_RANGE");
    expect(c.hardConstraints.every((h) => h.identifiedRemedy === null)).toBe(true);
    expect(c.recommendedNextSteps[0]).toMatchObject({ text: "Explore what could change this result.", target: "/sensitivity" });
  });
  it("day longer than range, depot-only, no route detail => NOT YET VIABLE", () => {
    const c = run(longDay("depot_only")).commercial.bev;
    expect(c.classification).toBe("NOT_YET_VIABLE");
    expect(c.hardConstraints.map((h) => h.code)).toContain("RANGE_EXCEEDED_DEPOT_ONLY");
  });
  it("a payload above the effective capacity => NOT YET VIABLE", () => {
    const c = run({ fleet: { payloadCapacityKg: 1000, averagePayloadKg: 900 }, bev: { operational: { payloadImpact: "reduced", payloadReductionKg: 200 } } } as Patch).commercial.bev;
    expect(c.classification).toBe("NOT_YET_VIABLE");
    expect(c.reasonCodes).toContain("PAYLOAD_CONSTRAINT");
  });
  it("an unknown payload impact is an uncertainty that downgrades VIABLE", () => {
    const c = run({ fleet: { payloadCapacityKg: 1000, averagePayloadKg: 700 }, bev: { operational: { payloadImpact: "unknown" } } } as Patch).commercial.bev;
    expect(c.classification).toBe("CONDITIONALLY_VIABLE");
    expect(c.uncertainties.map((u) => u.code)).toContain("PAYLOAD_IMPACT_UNKNOWN");
  });
  it("materially negative NPV + suitable => NOT YET VIABLE", () => {
    const c = run(bevCost(20000)).commercial.bev;
    expect(c.economicCase).toBe("UNFAVOURABLE");
    expect(c.operationalStatus).toBe("suitable");
    expect(c.classification).toBe("NOT_YET_VIABLE");
    expect(c.primaryReason).toMatch(/materially negative/);
    expect(c.reasonCodes).toContain("NEGATIVE_NPV");
  });
  it("near break-even + suitable => CONDITIONALLY VIABLE", () => {
    const c = run(bevCost(14950)).commercial.bev; // NPV = +50 on 4,950 extra investment
    expect(c.economicCase).toBe("NEAR_BREAK_EVEN");
    expect(c.classification).toBe("CONDITIONALLY_VIABLE");
    expect(c.primaryReason).toMatch(/close to break-even/);
  });
  it("near break-even does not rescue a hard constraint", () => {
    expect(run(bevCost(14950), longDay("depot_only")).commercial.bev.classification).toBe("NOT_YET_VIABLE");
  });
  it("unknown battery replacement + favourable + suitable => CONDITIONALLY VIABLE", () => {
    const c = run({ bev: { batteryReplacement: { expected: "unknown", year: null, cost: null } } } as Patch).commercial.bev;
    expect(c.economicCase).toBe("FAVOURABLE");
    expect(c.operationalStatus).toBe("suitable");
    expect(c.classification).toBe("CONDITIONALLY_VIABLE");
    expect(c.reasonCodes).toContain("BATTERY_REPLACEMENT_UNKNOWN");
    expect(c.uncertainties.map((u) => u.code)).toContain("BATTERY_REPLACEMENT_UNKNOWN");
    expect(c.recommendedNextSteps.some((s) => /battery replacement/i.test(s.text))).toBe(true);
  });
  it("unknown battery replacement does not by itself make the assessment INSUFFICIENT", () => {
    expect(run({ bev: { batteryReplacement: { expected: "unknown", year: null, cost: null } } } as Patch).commercial.bev.evidenceCompleteness.sufficientForClassification).toBe(true);
  });
});

describe("critical unknowns => INSUFFICIENT EVIDENCE", () => {
  it("a day longer than the range with unknown charging cannot be judged", () => {
    for (const o of [null, "unknown"]) {
      const c = run(longDay(o)).commercial.bev;
      expect(c.classification).toBe("INSUFFICIENT_EVIDENCE");
      expect(c.reasonCodes).toContain("CRITICAL_DATA_MISSING");
      expect(c.criticalMissing.length).toBeGreaterThan(0);
      expect(c.primaryReason).toMatch(/^GreenFleet cannot classify Battery electric because/);
      expect(c.evidenceCompleteness.sufficientForClassification).toBe(false);
      expect(c.recommendedNextSteps[0]).toMatchObject({ text: "Complete the missing inputs listed above.", target: "/assessment/electric" });
    }
  });
  it("is not rescued by good economics, and not replaced by a negative label", () => {
    expect(run({ operations: { dailyDistanceKm: 450 }, bev: { usableRangeKm: 300, upfrontVehicleCost: 10000, operational: { chargingOpportunity: null } } } as Patch).commercial.bev.classification).toBe("INSUFFICIENT_EVIDENCE");
  });
  it("a hard constraint is a conclusion even when other evidence is thin (rule 1 outranks rule 2)", () => {
    const r = run({ fleet: { payloadCapacityKg: 1000, averagePayloadKg: 900 }, operations: { dailyDistanceKm: 450 }, bev: { usableRangeKm: 300, operational: { chargingOpportunity: null, payloadImpact: "reduced", payloadReductionKg: 200 } } } as Patch);
    expect(r.operational.bev.status).toBe("constrained");
    expect(r.commercial.bev.classification).toBe("NOT_YET_VIABLE");
  });
  it("the policy's critical checks agree with the Batch 4 operational status", () => {
    for (const p of [longDay(null), longDay("unknown"), longDay("depot_only"), longDay("public_available"), {} as Patch]) {
      const r = run(p);
      const c = r.commercial.bev;
      expect(r.operational.bev.status === "insufficient_data").toBe(c.criticalMissing.length > 0);
    }
  });
});

describe("biofuel", () => {
  it("A. positive NPV + reliable supply + infrastructure resolved => VIABLE", () => {
    const c = run(bio(0.5)).commercial.biofuel;
    expect(c.economicCase).toBe("FAVOURABLE");
    expect(c.classification).toBe("VIABLE");
  });
  it("A2. required infrastructure that is fully specified and costed does not block", () => {
    const c = run(bio(0.5, { specialInfrastructure: "yes" }), { infrastructure: { biofuel: { investmentRequired: "yes", storageEquipmentCost: 100, refuellingInfrastructureCost: 100, installationCost: 100, usefulLifeYears: 10 } } } as Patch).commercial.biofuel;
    expect(c.operationalStatus).toBe("suitable");
    expect(c.classification).toBe("VIABLE");
  });
  it("B. intermittent supply => CONDITIONALLY VIABLE", () => {
    const c = run(bio(0.5, { availability: "intermittent" })).commercial.biofuel;
    expect(c.classification).toBe("CONDITIONALLY_VIABLE");
    expect(c.reasonCodes).toContain("BIOFUEL_SUPPLY_INTERMITTENT");
    expect(c.primaryReason).toMatch(/biofuel supply is intermittent/);
  });
  it("limited supply on its own is a condition to secure fuel", () => {
    const c = run(bio(0.5, { availability: "limited" })).commercial.biofuel;
    expect(c.classification).toBe("CONDITIONALLY_VIABLE");
    expect(c.reasonCodes).toContain("BIOFUEL_SUPPLY_LIMITED");
  });
  it("C. limited supply with the needed infrastructure unspecified => NOT YET VIABLE", () => {
    const c = run(bio(0.5, { availability: "limited", specialInfrastructure: "yes" }), { infrastructure: { biofuel: { investmentRequired: "yes", storageEquipmentCost: 100, refuellingInfrastructureCost: 100, installationCost: 100 } } } as Patch).commercial.biofuel;
    expect(c.economicCase).toBe("FAVOURABLE");
    expect(c.classification).toBe("NOT_YET_VIABLE");
    expect(c.hardConstraints.map((h) => h.code)).toContain("BIOFUEL_SUPPLY_CONSTRAINED");
  });
  it("infrastructure needed but not fully specified is a condition", () => {
    const c = run(bio(0.5, { specialInfrastructure: "yes" }), { infrastructure: { biofuel: { investmentRequired: "yes", storageEquipmentCost: 100, refuellingInfrastructureCost: 100, installationCost: 100 } } } as Patch).commercial.biofuel;
    expect(c.classification).toBe("CONDITIONALLY_VIABLE");
    expect(c.reasonCodes).toContain("INFRASTRUCTURE_UNRESOLVED");
  });
  it("D. materially negative NPV + reliable supply => NOT YET VIABLE", () => {
    const c = run().commercial.biofuel; // base biofuel NPV = -750
    expect(c.economicCase).toBe("UNFAVOURABLE");
    expect(c.classification).toBe("NOT_YET_VIABLE");
  });
  it("E. near break-even + reliable supply => CONDITIONALLY VIABLE", () => {
    const c = run(bio(0.679)).commercial.biofuel; // NPV = +6.25 on 500
    expect(c.economicCase).toBe("NEAR_BREAK_EVEN");
    expect(c.classification).toBe("CONDITIONALLY_VIABLE");
  });
  it("F. unknown or missing fuel availability is a critical unknown => INSUFFICIENT EVIDENCE", () => {
    for (const availability of ["unknown", null]) {
      const c = run(bio(0.5, { availability })).commercial.biofuel;
      expect(c.classification).toBe("INSUFFICIENT_EVIDENCE");
      expect(c.criticalMissing.map((m) => m.checkId)).toEqual(["supply"]);
      expect(c.recommendedNextSteps[0]!.target).toBe("/assessment/biofuel#section-bio-supply");
    }
  });
  it("an unknown infrastructure requirement is a material uncertainty, not a critical unknown", () => {
    const c = run(bio(0.5, { specialInfrastructure: "unknown" }), { infrastructure: { biofuel: { investmentRequired: "unknown" } } } as Patch).commercial.biofuel;
    expect(c.classification).toBe("CONDITIONALLY_VIABLE");
    expect(c.uncertainties.map((u) => u.code)).toContain("INFRASTRUCTURE_UNKNOWN");
  });
});

describe("economic categories and the near-break-even tolerance", () => {
  const econ = (patch: Patch) => run(patch).commercial.bev.economic;
  it("positive NPV beyond the tolerance is FAVOURABLE; negative beyond it is UNFAVOURABLE", () => {
    expect(econ(bevCost(13000)).case).toBe("FAVOURABLE");
    expect(econ(bevCost(20000)).case).toBe("UNFAVOURABLE");
  });
  it("exact zero NPV is NEAR_BREAK_EVEN, never clearly favourable", () => {
    const e = econ(bevCost(15000));
    expect(e.npv).toBeCloseTo(0, 9);
    expect(e.npvZeroWithinNumericalTolerance).toBe(true);
    expect(e.case).toBe("NEAR_BREAK_EVEN");
    expect(e.explanation).toMatch(/zero within numerical tolerance/);
  });
  it("floating-point noise around zero counts as zero (numerical tolerance is separate from the 5% policy)", () => {
    const e = econ(bevCost(15000 - 1e-10));
    expect(e.npvZeroWithinNumericalTolerance).toBe(true);
    expect(econ(bevCost(14950)).npvZeroWithinNumericalTolerance).toBe(false);
  });
  it("near break-even on the positive side (NPV +50 on 4,950)", () => {
    const e = econ(bevCost(14950));
    expect(e.case).toBe("NEAR_BREAK_EVEN");
    expect(e.denominator).toEqual({ kind: "incremental_investment", value: 4950 });
    expect(e.npvMaterialityRatio).toBeCloseTo(50 / 4950, 12);
  });
  it("near break-even on the negative side (NPV -50 on 5,050)", () => {
    const e = econ(bevCost(15050));
    expect(e.case).toBe("NEAR_BREAK_EVEN");
    expect(e.npvMaterialityRatio).toBeCloseTo(-50 / 5050, 12);
  });
  it("just outside the tolerance, on both sides, the case is no longer near break-even", () => {
    // NPV = 2,000 - x, investment = 3,000 + x. +5% boundary: 2000 - x = 0.05 (3000 + x)  =>  x = 1,761.9
    expect(econ(bevCost(13000 + 1700)).case).toBe("FAVOURABLE");
    expect(econ(bevCost(13000 + 1800)).case).toBe("NEAR_BREAK_EVEN");
    // -5% boundary: 2000 - x = -0.05 (3000 + x) => x = 2,263.2
    expect(econ(bevCost(13000 + 2200)).case).toBe("NEAR_BREAK_EVEN");
    expect(econ(bevCost(13000 + 2400)).case).toBe("UNFAVOURABLE");
  });
  it("zero incremental investment uses the diesel present cost as the denominator", () => {
    const e = econ(bevCost(10000));
    expect(e.additionalInitialInvestment).toBe(0);
    expect(e.denominator).toEqual({ kind: "diesel_present_cost", value: 15500 });
    expect(Number.isFinite(e.npvMaterialityRatio!)).toBe(true);
  });
  it("zero incremental investment with NPV near zero is near break-even", () => {
    const e = econ({ bev: { upfrontVehicleCost: 10000, annualMaintenanceCost: 1200 } } as Patch);
    expect(e.denominator?.kind).toBe("diesel_present_cost");
    expect(e.case).toBe("NEAR_BREAK_EVEN");
  });
  it("a trivially small incremental investment also falls back to the diesel present cost", () => {
    expect(econ(bevCost(10050)).denominator?.kind).toBe("diesel_present_cost");
  });
  it("negative incremental investment (green cheaper at Year 0) is handled and is an immediate advantage", () => {
    const c = run(bevCost(9000)).commercial.bev;
    expect(c.economic.additionalInitialInvestment).toBe(-1000);
    expect(c.economic.denominator?.kind).toBe("diesel_present_cost");
    expect(c.economic.immediateAdvantage).toBe(true);
    expect(c.economic.case).toBe("FAVOURABLE");
    expect(c.reasonCodes).toContain("IMMEDIATE_ECONOMIC_ADVANTAGE");
    expect(c.reasonCodes).not.toContain("NO_PAYBACK_WITHIN_HORIZON");
    expect(c.classification).toBe("VIABLE");
    expect(c.supportingEvidence.find((e) => e.label === "Simple payback")?.value).toBe("Immediate (no extra upfront cost)");
  });
  it("no payback within the horizon is reported in words and as a reason code", () => {
    const c = run(bevCost(20000)).commercial.bev;
    expect(c.reasonCodes).toContain("NO_PAYBACK_WITHIN_HORIZON");
    expect(c.supportingEvidence.find((e) => e.label === "Discounted payback")?.value).toMatch(/Not achieved within the 5-year horizon/);
  });
  it("the denominator rule never divides by zero", () => {
    const p = COMMERCIAL_VIABILITY_POLICY_V1;
    expect(toleranceDenominator(0, 0, p)).toBeNull();
    expect(toleranceDenominator(Number.NaN, 100, p)).toEqual({ kind: "diesel_present_cost", value: 100 });
    expect(toleranceDenominator(500, 1000, p)).toEqual({ kind: "incremental_investment", value: 500 });
    expect(toleranceDenominator(-500, 1000, p)).toEqual({ kind: "diesel_present_cost", value: 1000 });
    expect(toleranceDenominator(5, 1000, p)).toEqual({ kind: "diesel_present_cost", value: 1000 });
  });
  it("the tolerance is a policy parameter: a stricter policy changes the case, nothing else does", () => {
    const r = run(bevCost(14950));
    const strict = { ...COMMERCIAL_VIABILITY_POLICY_V1, nearBreakEvenTolerancePct: 0.5 };
    const e = assessEconomics(r.diesel, r.bev, r.bevVsDiesel, 5, strict);
    expect(e.case).toBe("FAVOURABLE");
  });
});

describe("consistency diagnostics", () => {
  const r = run();
  it("consistent results raise no error", () => {
    expect(r.commercial.bev.economic.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(r.commercial.biofuel.economic.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });
  it("positive NPV with a negative discounted cumulative cash flow is flagged and never classified", () => {
    const tampered = { ...r.bevVsDiesel, rows: r.bevVsDiesel.rows.map((x, i, a) => (i === a.length - 1 ? { ...x, discountedCumulativeCashFlow: -500 } : x)) };
    const e = assessEconomics(r.diesel, r.bev, tampered, 5, COMMERCIAL_VIABILITY_POLICY_V1);
    expect(e.diagnostics.map((d) => d.code)).toContain("NPV_SIGN_CONTRADICTION");
    expect(e.case).toBe("INSUFFICIENT_DATA");
    const c = classifyCommercialViability({ technology: "bev", economic: { diesel: r.diesel, green: r.bev, incremental: tampered, warnings: [], horizonYears: 5 }, operational: r.operational.bev, environmental: r.environmental.bevVsDiesel, completeness: r.dataCompleteness });
    expect(c.classification).toBe("INSUFFICIENT_EVIDENCE");
    expect(c.reasonCodes).toContain("RESULT_INCONSISTENT");
    expect(c.primaryReason).toMatch(/internally inconsistent/);
  });
  it("an NPV that disagrees with the present-cost difference is flagged", () => {
    const e = assessEconomics(r.diesel, r.bev, { ...r.bevVsDiesel, npv: r.bevVsDiesel.npv + 1000 }, 5, COMMERCIAL_VIABILITY_POLICY_V1);
    expect(e.diagnostics.map((d) => d.code)).toContain("NPV_PRESENT_COST_MISMATCH");
  });
  it("a positive NPV without a discounted payback is a warning, not a block", () => {
    const e = assessEconomics(r.diesel, r.bev, { ...r.bevVsDiesel, discountedPayback: { status: "not_achieved", years: null, sustained: null } }, 5, COMMERCIAL_VIABILITY_POLICY_V1);
    expect(e.diagnostics).toEqual([expect.objectContaining({ code: "POSITIVE_NPV_WITHOUT_DISCOUNTED_PAYBACK", severity: "warning" })]);
    expect(e.case).toBe("FAVOURABLE");
  });
  it("a non-finite NPV is flagged", () => {
    expect(assessEconomics(r.diesel, r.bev, { ...r.bevVsDiesel, npv: Number.NaN }, 5, COMMERCIAL_VIABILITY_POLICY_V1).case).toBe("INSUFFICIENT_DATA");
  });
  it("holds across a spread of scenarios with discounting, escalation and replacements", () => {
    for (const p of [bevCost(20000), bevCost(9000), { finance: { discountRatePct: 12 } } as Patch, { operations: { analysisHorizonYears: 12 } } as Patch, bio(0.4)]) {
      const x = run(p);
      for (const t of ["bev", "biofuel"] as const) expect(x.commercial[t].economic.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    }
  });
});

describe("environmental performance is context, never a driver (Policy v1.0)", () => {
  const strip = (r: AssessmentCalculationResult, t: "bev" | "biofuel") => {
    const c = r.commercial[t];
    return JSON.stringify({
      classification: c.classification,
      economicCase: c.economicCase,
      operationalStatus: c.operationalStatus,
      primaryReason: c.primaryReason,
      reasonCodes: c.reasonCodes.filter((x) => !/EMISSION/.test(x)),
      conditions: c.conditions,
      uncertainties: c.uncertainties,
      hardConstraints: c.hardConstraints,
      criticalMissing: c.criticalMissing,
      trace: c.decisionTrace.filter((s) => s.gate !== "environment").map((s) => s.text),
    });
  };
  it("1. positive NPV + suitable + HIGHER emissions can still be VIABLE, and says so", () => {
    const r = run(FACTORS(1, 5, 1));
    expect(r.environmental.bevVsDiesel.direction).toBe("higher");
    const c = r.commercial.bev;
    expect(c.classification).toBe("VIABLE");
    expect(c.environmentalContext.state).toBe("higher");
    expect(c.environmentalContext.text).toMatch(/higher than diesel/);
    expect(c.reasonCodes).toContain("HIGHER_EMISSIONS");
  });
  it("2. negative NPV + suitable + much LOWER emissions => NOT YET VIABLE", () => {
    const r = run(bevCost(20000), FACTORS(10, 0.01));
    const c = r.commercial.bev;
    expect(c.environmentalContext.state).toBe("lower");
    expect(c.environmentalContext.text).toMatch(/% lower than diesel under the supplied emission factors/);
    expect(c.classification).toBe("NOT_YET_VIABLE");
  });
  it("3. positive NPV + suitable + NO emission factor still classifies", () => {
    const c = run().commercial.bev;
    expect(c.classification).toBe("VIABLE");
    expect(c.environmentalContext.state).toBe("unavailable");
    expect(c.environmentalContext.text).toMatch(/^Environmental comparison unavailable/);
    expect(c.reasonCodes).toContain("EMISSIONS_UNAVAILABLE");
    expect(c.evidenceCompleteness).toMatchObject({ environmental: "unavailable", environmentalRequiredForClassification: false, sufficientForClassification: true });
    expect(c.recommendedNextSteps.some((s) => s.code === "EMISSIONS_UNAVAILABLE" && s.target === "/assessment/finance#section-fin-env")).toBe(true);
  });
  it("4. changing ONLY the emission factors cannot change the commercial classification", () => {
    const scenarios: Patch[] = [{}, longDay("public_available"), longDay("depot_only"), bevCost(20000), bevCost(14950), longDay(null), { bev: { batteryReplacement: { expected: "unknown", year: null, cost: null } } } as Patch];
    for (const s of scenarios) {
      const reference = run(s);
      for (const f of [FACTORS(2, 0.1, 1.2), FACTORS(1, 5, 5), FACTORS(10, 0.01, 0.1), FACTORS(0.001, 100, 100)]) {
        const changed = run(s, f);
        for (const t of ["bev", "biofuel"] as const) expect(strip(changed, t)).toBe(strip(reference, t));
      }
    }
  });
  it("environmental context text covers equal emissions within numerical precision", () => {
    const r = run(FACTORS(1, 0.1, 1.25), { biofuel: { fuelConsumptionFuelUnitsPer100Km: 10 } } as Patch);
    const c = r.commercial.biofuel.environmentalContext;
    expect(["unchanged", "lower", "higher"]).toContain(c.state);
    if (c.state === "unchanged") expect(c.text).toMatch(/equal to diesel within numerical precision/);
  });
  it("an unmatched-unit factor keeps the comparison unavailable but does not block the label", () => {
    const r = run({ environmentalAssumptions: { diesel: factor(2, "kg CO2e/litre", "kgco2e_per_litre"), gridElectricity: factor(0.1, "kg CO2e/litre", "kgco2e_per_litre") } } as unknown as Patch);
    expect(r.commercial.bev.environmentalContext.state).toBe("unavailable");
    expect(r.commercial.bev.classification).toBe("VIABLE");
  });
});

describe("policy stability: inputs that should move the label", () => {
  it("fuel price, electricity price, vehicle price, distance, range, payload, availability and infrastructure all can", () => {
    expect(cls(run(), "bev")).toBe("VIABLE");
    expect(cls(run({ diesel: { fuelPricePerLitre: 0.1 } } as Patch), "bev")).toBe("NOT_YET_VIABLE");
    expect(cls(run({ bev: { electricityTariffPerKwh: 0.5 } } as Patch), "bev")).toBe("NOT_YET_VIABLE");
    expect(cls(run(bevCost(25000)), "bev")).toBe("NOT_YET_VIABLE");
    expect(cls(run({ operations: { annualDistanceKmPerVehicle: 1000, fleetAnnualDistanceKm: 1000 } } as Patch), "bev")).not.toBe("VIABLE");
    expect(cls(run(longDay("depot_only")), "bev")).toBe("NOT_YET_VIABLE");
    expect(cls(run(bio(0.5)), "biofuel")).toBe("VIABLE");
    expect(cls(run(bio(0.5, { availability: "intermittent" })), "biofuel")).toBe("CONDITIONALLY_VIABLE");
  });
});

describe("layers stay independent and prior results are untouched", () => {
  it("the financial figures are identical with or without the decision layer's inputs changing", () => {
    const a = run();
    const b = run(FACTORS(), longDay("public_available"));
    expect(b.bevVsDiesel.npv).toBe(a.bevVsDiesel.npv);
    expect(b.diesel.undiscountedTco).toBe(15500);
    expect(a.bevVsDiesel.npv).toBeCloseTo(2000, 9);
    expect(a.biofuelVsDiesel.npv).toBeCloseTo(-750, 9);
  });
  it("the economic dimension of the classification equals the Batch 3 NPV and the Batch 4 status is carried unchanged", () => {
    const r = run(longDay("public_available"));
    expect(r.commercial.bev.economic.npv).toBe(r.bevVsDiesel.npv);
    expect(r.commercial.bev.operationalStatus).toBe(r.operational.bev.status);
    expect(r.commercial.bev.environmentalContext.state).toBe(r.dimensions.bev.environmental.state);
  });
});
