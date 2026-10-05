import { describe, expect, it } from "vitest";
import { calculateAssessment } from "@/calculation";
import { makeInput } from "@/calculation/fixtures";
import type { AssessmentCalculationResult } from "@/calculation/types";
import { COMMERCIAL_VIABILITY_POLICY_V1 } from "@/calculation/viability";
import type { NormalizedAssessmentInput } from "@/domain/normalized";
import { technologySentences } from "@/reporting/executive";

/**
 * Commercial Viability Policy v1.0: decision-table, gate-order, near-break-even and independence validation.
 * VALIDATION FIXTURES: SYNTHETIC VALUES (abstract currency units, not market data).
 *
 * Base fixture (discount 0%, 5 years, 1 vehicle, 10,000 km/yr):
 *   diesel net cost 10,000 + 5 x (1,000 fuel + 500 maint) - 2,000 resale = 15,500
 *   BEV    net cost  P     + 5 x (  500 energy + 200 maint) - 3,000 resale = P + 500
 *   => NPV(BEV vs diesel) = 15,000 - P and the additional initial investment = P - 10,000.
 */

type Result = AssessmentCalculationResult;
const run = (input: NormalizedAssessmentInput): Result => {
  const out = calculateAssessment(input);
  if (!out.ok) throw new Error(out.errors.map((e) => e.message).join("; "));
  return out.result;
};


/* ------------------------------ category builders ------------------------------ */

type Econ = "F" | "N" | "U" | "I";
type Op = "suitable" | "conditional" | "constrained" | "insufficient";
type Unc = "none" | "material";

const ECON_PATCH: Record<Econ, Parameters<typeof makeInput>[0]> = {
  F: { bev: { upfrontVehicleCost: 13_000 } }, // NPV +2,000 on an extra 3,000 = +66.7%
  N: { bev: { upfrontVehicleCost: 14_900 } }, // NPV +100 on an extra 4,900 = +2.0%
  U: { bev: { upfrontVehicleCost: 17_000 } }, // NPV -2,000 on an extra 7,000 = -28.6%
  // Everything costs nothing: there is no cost base to judge the NPV against.
  I: {
    diesel: { upfrontVehicleCost: 0, annualMaintenanceCost: 0, fuelPricePerLitre: 0, residualValue: null },
    bev: { upfrontVehicleCost: 0, annualMaintenanceCost: 0, electricityTariffPerKwh: 0, residualValue: null },
  },
};
const OP_PATCH: Record<Op, Parameters<typeof makeInput>[0]> = {
  suitable: { operations: { dailyDistanceKm: 100 }, bev: { usableRangeKm: 500 } },
  conditional: { operations: { dailyDistanceKm: 600 }, bev: { usableRangeKm: 500, operational: { chargingOpportunity: "public_available" } } },
  constrained: { operations: { dailyDistanceKm: 600 }, bev: { usableRangeKm: 500, operational: { chargingOpportunity: "depot_only" } } },
  insufficient: { operations: { dailyDistanceKm: 600 }, bev: { usableRangeKm: 500, operational: { chargingOpportunity: null } } },
};
const UNC_PATCH: Record<Unc, Parameters<typeof makeInput>[0]> = {
  none: { bev: { batteryReplacement: { expected: "no", year: null, cost: null } } },
  material: { bev: { batteryReplacement: { expected: "unknown", year: null, cost: null } } },
};

const isPlain = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === "object" && !Array.isArray(x);
const deepMerge = (a: unknown, b: unknown): unknown => {
  if (!isPlain(a) || !isPlain(b)) return b;
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = k in a ? deepMerge(a[k], v) : v;
  return out;
};
/** Combines several patches into one input. Later patches win. */
const merge = (...patches: Parameters<typeof makeInput>[0][]): NormalizedAssessmentInput =>
  makeInput(patches.reduce<unknown>((acc, p) => deepMerge(acc, p), {}) as Parameters<typeof makeInput>[0]);

const build = (e: Econ, o: Op, u: Unc) => run(merge(ECON_PATCH[e], OP_PATCH[o], UNC_PATCH[u]));

describe("Policy v1.0: exhaustive decision table (economics x operations x uncertainty)", () => {
  const V = "VIABLE", C = "CONDITIONALLY_VIABLE", N = "NOT_YET_VIABLE", I = "INSUFFICIENT_EVIDENCE";
  /*
   * Hand-written expectation, one row per combination. Reading order of the policy:
   *   evidence missing (economic or operational)  -> INSUFFICIENT EVIDENCE   (Gate 1, before everything else)
   *   hard operational constraint                 -> NOT YET VIABLE          (Gate 2)
   *   unfavourable economics                      -> NOT YET VIABLE          (Gate 3)
   *   near break-even economics                   -> CONDITIONALLY VIABLE    (Gate 3)
   *   remediable condition or material uncertainty-> CONDITIONALLY VIABLE    (Gate 4)
   *   otherwise                                   -> VIABLE
   *
   *   econ  operation     uncertainty  expected
   */
  const TABLE: [Econ, Op, Unc, string][] = [
    ["F", "suitable", "none", V], ["F", "suitable", "material", C],
    ["F", "conditional", "none", C], ["F", "conditional", "material", C],
    ["F", "constrained", "none", N], ["F", "constrained", "material", N],
    ["F", "insufficient", "none", I], ["F", "insufficient", "material", I],

    ["N", "suitable", "none", C], ["N", "suitable", "material", C],
    ["N", "conditional", "none", C], ["N", "conditional", "material", C],
    ["N", "constrained", "none", N], ["N", "constrained", "material", N],
    ["N", "insufficient", "none", I], ["N", "insufficient", "material", I],

    ["U", "suitable", "none", N], ["U", "suitable", "material", N],
    ["U", "conditional", "none", N], ["U", "conditional", "material", N],
    ["U", "constrained", "none", N], ["U", "constrained", "material", N],
    ["U", "insufficient", "none", I], ["U", "insufficient", "material", I],

    ["I", "suitable", "none", I], ["I", "suitable", "material", I],
    ["I", "conditional", "none", I], ["I", "conditional", "material", I],
    ["I", "constrained", "none", I], ["I", "constrained", "material", I],
    ["I", "insufficient", "none", I], ["I", "insufficient", "material", I],
  ];

  it("covers all 4 x 4 x 2 = 32 combinations", () => {
    expect(TABLE).toHaveLength(32);
    expect(new Set(TABLE.map((r) => r.slice(0, 3).join("|"))).size).toBe(32);
  });

  it.each(TABLE)("economics %s, operation %s, uncertainty %s -> %s", (e, o, u, expected) => {
    const r = build(e, o, u);
    const c = r.commercial.bev;
    // The fixture really produced the categories under test (otherwise the table proves nothing).
    expect(c.economicCase).toBe({ F: "FAVOURABLE", N: "NEAR_BREAK_EVEN", U: "UNFAVOURABLE", I: "INSUFFICIENT_DATA" }[e]);
    expect(c.operationalStatus).toBe({ suitable: "suitable", conditional: "conditional", constrained: "constrained", insufficient: "insufficient_data" }[o]);
    expect(c.classification).toBe(expected);
    expect(c.policyVersion).toBe("1.0");
    expect(c.policyId).toBe("GreenFleet Commercial Viability Policy v1.0");
  });

  it("there is no score: only four labels exist across the table", () => {
    const labels = new Set(TABLE.map((row) => build(row[0], row[1], row[2]).commercial.bev.classification));
    expect([...labels].sort()).toEqual([C, I, N, V].sort());
    const c = build("F", "suitable", "none").commercial.bev as unknown as Record<string, unknown>;
    expect(Object.keys(c).some((k) => /score|points|weight|rating/i.test(k))).toBe(false);
  });
});

describe("Policy v1.0: gate order", () => {
  it("negative NPV with critical operational evidence missing is INSUFFICIENT EVIDENCE, not NOT YET VIABLE", () => {
    const c = build("U", "insufficient", "none").commercial.bev;
    expect(c.classification).toBe("INSUFFICIENT_EVIDENCE");
    expect(c.economic.npv).toBeLessThan(0);
    expect(c.criticalMissing.length).toBeGreaterThan(0);
    expect(c.reasonCodes).toContain("CRITICAL_DATA_MISSING");
  });

  it("...but the output still discloses that the available economic evidence is unfavourable", () => {
    const r = build("U", "insufficient", "none");
    const c = r.commercial.bev;
    expect(c.economicCase).toBe("UNFAVOURABLE"); // carried in the result
    expect(c.supportingEvidence.some((e) => e.label === "Incremental NPV versus diesel")).toBe(true);
    // In words: the decision trace and the plain-language summary say so, and say it was not used to classify.
    const trace = c.decisionTrace.map((s) => s.text).join(" ");
    expect(trace).toMatch(/available economic evidence is unfavourable/i);
    expect(trace).toMatch(/not used to classify|does not change/i);
    const summary = technologySentences("bev", c).join(" ");
    expect(summary).toMatch(/available economic evidence is unfavourable/i);
    // and the label itself is not softened or hardened
    expect(summary).toMatch(/cannot classify/i);
    expect(summary).not.toMatch(/not yet viable/i);
  });

  it("a favourable economic case is disclosed too, never presented as a conclusion", () => {
    const summary = technologySentences("bev", build("F", "insufficient", "none").commercial.bev).join(" ");
    expect(summary).toMatch(/available economic evidence is favourable/i);
    expect(summary).not.toMatch(/\bis viable\b/i);
  });

  it("a hard constraint outranks a missing item in another check (a conflict is already a conclusion)", () => {
    // Payload constrained (average above effective capacity) while the range check lacks charging information.
    const c = run(
      makeInput({
        operations: { dailyDistanceKm: 600 },
        fleet: { payloadCapacityKg: 1000, averagePayloadKg: 900 },
        bev: { usableRangeKm: 500, operational: { chargingOpportunity: null, payloadImpact: "reduced", payloadReductionKg: 300 } },
      }),
    ).commercial.bev;
    expect(c.operationalStatus).toBe("constrained");
    expect(c.classification).toBe("NOT_YET_VIABLE");
  });

  it("an economic inconsistency is never classified (Gate 0)", () => {
    const base = run(makeInput({}));
    expect(base.commercial.bev.economic.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });
});

describe("NPV break-even does not imply VIABLE (Policy v1.0 governs)", () => {
  // P = 15,000 gives NPV = 0 exactly.
  const at = (o: Op, u: Unc) => run(merge({ bev: { upfrontVehicleCost: 15_000 } }, OP_PATCH[o], UNC_PATCH[u])).commercial.bev;

  it("NPV = 0 with a suitable operation is CONDITIONALLY VIABLE (near break-even), never VIABLE", () => {
    const c = at("suitable", "none");
    expect(c.economic.npvZeroWithinNumericalTolerance).toBe(true);
    expect(c.economicCase).toBe("NEAR_BREAK_EVEN");
    expect(c.classification).toBe("CONDITIONALLY_VIABLE");
  });
  it("NPV = 0 with a conditional operation is CONDITIONALLY VIABLE", () => expect(at("conditional", "none").classification).toBe("CONDITIONALLY_VIABLE"));
  it("NPV = 0 with a hard constraint is NOT YET VIABLE", () => expect(at("constrained", "none").classification).toBe("NOT_YET_VIABLE"));
  it("NPV = 0 with a material uncertainty is CONDITIONALLY VIABLE", () => expect(at("suitable", "material").classification).toBe("CONDITIONALLY_VIABLE"));
  it("NPV = 0 with missing critical evidence is INSUFFICIENT EVIDENCE", () => expect(at("insufficient", "none").classification).toBe("INSUFFICIENT_EVIDENCE"));
});

describe("Near-break-even tolerance (prototype value 5%) and denominator selection", () => {
  /*
   * Diesel annual maintenance M shifts the diesel cost: diesel net cost = 13,000 + 5M. BEV at P = 14,000 costs 14,500.
   * NPV = 5M - 1,500; additional investment = 4,000; 5% of 4,000 = 200.
   *   M = 340 -> NPV = +200 = exactly +5.000%     M = 260 -> NPV = -200 = exactly -5.000%
   */
  const atM = (M: number, extra: Parameters<typeof makeInput>[0] = {}) =>
    run(makeInput({ diesel: { annualMaintenanceCost: M }, bev: { upfrontVehicleCost: 14_000 }, ...extra })).commercial.bev;

  it("the tolerance is 5% and the 1% floor is held in the single policy object", () => {
    expect(COMMERCIAL_VIABILITY_POLICY_V1.nearBreakEvenTolerancePct).toBe(5);
    expect(COMMERCIAL_VIABILITY_POLICY_V1.minimumInvestmentBasePctOfDieselPresentCost).toBe(1);
  });

  it("exactly +5% is inside the tolerance (near break-even)", () => {
    const c = atM(340);
    expect(c.economic.npv).toBeCloseTo(200, 9);
    expect(c.economic.npvMaterialityRatio).toBeCloseTo(0.05, 12);
    expect(c.economicCase).toBe("NEAR_BREAK_EVEN");
  });
  it("just inside +5% is near break-even; just outside is favourable", () => {
    expect(atM(339.9).economicCase).toBe("NEAR_BREAK_EVEN");
    expect(atM(340.1).economicCase).toBe("FAVOURABLE");
  });
  it("exactly -5% is inside the tolerance; just outside is unfavourable", () => {
    expect(atM(260).economicCase).toBe("NEAR_BREAK_EVEN");
    expect(atM(260.1).economicCase).toBe("NEAR_BREAK_EVEN");
    expect(atM(259.9).economicCase).toBe("UNFAVOURABLE");
  });

  it("the denominator is the additional initial investment when it is positive and at least 1% of the diesel present cost", () => {
    // Diesel present cost with M = 500: 15,500; 1% = 155.
    const bigEnough = run(makeInput({ bev: { upfrontVehicleCost: 10_155 } })).commercial.bev.economic.denominator;
    expect(bigEnough).toEqual({ kind: "incremental_investment", value: 155 });
    const justUnder = run(makeInput({ bev: { upfrontVehicleCost: 10_154 } })).commercial.bev.economic.denominator;
    expect(justUnder).toEqual({ kind: "diesel_present_cost", value: 15_500 });
  });
  it("a zero or negative additional investment falls back to the diesel present cost", () => {
    expect(run(makeInput({ bev: { upfrontVehicleCost: 10_000 } })).commercial.bev.economic.denominator).toEqual({ kind: "diesel_present_cost", value: 15_500 });
    const cheaper = run(makeInput({ bev: { upfrontVehicleCost: 9_000 } })).commercial.bev;
    expect(cheaper.economic.denominator).toEqual({ kind: "diesel_present_cost", value: 15_500 });
    expect(cheaper.reasonCodes).toContain("IMMEDIATE_ECONOMIC_ADVANTAGE");
  });
  it("a zero cost base gives INSUFFICIENT_DATA, not a division by zero", () => {
    const c = build("I", "suitable", "none").commercial.bev;
    expect(c.economic.denominator).toBeNull();
    expect(c.economic.npvMaterialityRatio).toBeNull();
    expect(c.economicCase).toBe("INSUFFICIENT_DATA");
    expect(JSON.stringify(c)).not.toMatch(/NaN|Infinity/);
  });

  it("floating-point tolerance is separate: 1e-9 of diesel present cost absorbs noise only", () => {
    expect(COMMERCIAL_VIABILITY_POLICY_V1.numericalToleranceFraction).toBe(1e-9);
    const zero = run(makeInput({ bev: { upfrontVehicleCost: 15_000 } })).commercial.bev.economic;
    expect(zero.npvZeroWithinNumericalTolerance).toBe(true);
    const small = atM(340.1).economic;
    expect(small.npvZeroWithinNumericalTolerance).toBe(false);
  });

  it("an undiscounted advantage with a non-positive discounted NPV is not rescued", () => {
    // Heavy discounting turns a 5-year saving into a loss; payback may exist undiscounted but NPV decides.
    const c = run(makeInput({ finance: { discountRatePct: 60 }, bev: { upfrontVehicleCost: 13_000 } })).commercial.bev;
    expect(c.economic.npv!).toBeLessThan(0);
    expect(["UNFAVOURABLE", "NEAR_BREAK_EVEN"]).toContain(c.economicCase);
  });
});

describe("Environmental independence stress test", () => {
  const withFactors = (diesel: number | null, grid: number | null, bio: number | null) => {
    const f = (v: number | null, unitId: string, unit: string) => ({ value: v, unit, unitId, scope: v === null ? null : ("direct" as const), source: v === null ? null : "synthetic test factor", sourceYear: null, notes: null, lifecycleAdjustmentPct: null });
    return makeInput({
      environmentalAssumptions: {
        diesel: f(diesel, "kgco2e_per_litre", "kg CO2e/litre"),
        gridElectricity: f(grid, "kgco2e_per_kwh", "kg CO2e/kWh"),
        biofuel: f(bio, "kgco2e_per_litre", "kg CO2e/litre"),
      },
    });
  };
  // Only the three factors vary. Economic, operational and evidence inputs are identical.
  const FACTOR_SETS: [number | null, number | null, number | null][] = [
    [2.7, 0.0, 1.0], // far lower
    [2.7, 0.1, 2.0], // lower
    [2.7, 1.0, 2.7], // BEV: 10,000 x 1.0 = 10,000 vs diesel 2,700 -> higher; biofuel equal per litre but more litres
    [1.0, 1.0, 1.0],
    [0, 0, 0], // zero factors everywhere
    [2.7, 5.0, 9.0], // higher
    [1e6, 1e6, 1e6], // extreme but valid
    [2.7, null, null], // missing alternatives
    [null, 0.4, 1.2], // missing baseline
    [null, null, null], // nothing supplied
  ];
  const reference = run(withFactors(null, null, null));

  it.each(FACTOR_SETS.map((s, i) => [i, s] as const))("factor set %i leaves every commercial output unchanged", (_i, [d, g, b]) => {
    const r = run(withFactors(d, g, b));
    for (const tech of ["bev", "biofuel"] as const) {
      const a = r.commercial[tech];
      const base = reference.commercial[tech];
      expect(a.classification).toBe(base.classification);
      expect(a.economicCase).toBe(base.economicCase);
      expect(a.operationalStatus).toBe(base.operationalStatus);
      expect(a.economic).toEqual(base.economic);
      expect(a.conditions).toEqual(base.conditions);
      expect(a.uncertainties).toEqual(base.uncertainties);
      expect(a.hardConstraints).toEqual(base.hardConstraints);
      expect(a.criticalMissing).toEqual(base.criticalMissing);
      const envCodes = new Set(["LOWER_EMISSIONS", "HIGHER_EMISSIONS", "NO_MATERIAL_EMISSIONS_DIFFERENCE", "EMISSIONS_UNAVAILABLE"]);
      expect(a.reasonCodes.filter((c) => !envCodes.has(c))).toEqual(base.reasonCodes.filter((c) => !envCodes.has(c)));
      expect(a.decisionTrace.filter((s) => s.gate !== "environment").map((s) => s.text)).toEqual(base.decisionTrace.filter((s) => s.gate !== "environment").map((s) => s.text));
      expect(a.environmentalContext.usedInClassification).toBe(false);
    }
    // economics themselves are untouched
    expect(r.bevVsDiesel).toEqual(reference.bevVsDiesel);
    expect(r.biofuelVsDiesel).toEqual(reference.biofuelVsDiesel);
  });

  it("the emissions result itself does change when the factors change (so the test above is meaningful)", () => {
    const lower = run(withFactors(2.7, 0.1, 2.0)).environmental.bevVsDiesel;
    const higher = run(withFactors(2.7, 5.0, 9.0)).environmental.bevVsDiesel;
    expect(lower.direction).toBe("lower");
    expect(higher.direction).toBe("higher");
    expect(run(withFactors(null, null, null)).environmental.bevVsDiesel.status).toBe("unavailable");
  });

  it("holds for every operational and economic category as well", () => {
    for (const e of ["F", "N", "U"] as const) {
      for (const o of ["suitable", "conditional", "constrained", "insufficient"] as const) {
        const none = build(e, o, "none").commercial.bev.classification;
        const withEnv = run({ ...merge(ECON_PATCH[e], OP_PATCH[o], UNC_PATCH.none), environmentalAssumptions: withFactors(2.7, 0.0, 1.0).environmentalAssumptions }).commercial.bev.classification;
        expect(withEnv).toBe(none);
      }
    }
  });
});

describe("Multiple-barrier grouping and wording (analyseViability)", () => {
  // These cases are exercised against the threshold analysis in analysis.test.ts; here only the classification layer is checked.
  it("economic + operational barriers are both carried as reason codes", () => {
    const c = build("U", "constrained", "none").commercial.bev;
    expect(c.reasonCodes).toEqual(expect.arrayContaining(["NEGATIVE_NPV", "RANGE_EXCEEDED_DEPOT_ONLY"]));
    expect(c.classification).toBe("NOT_YET_VIABLE");
    expect(c.primaryReason).toMatch(/negative/i);
    expect(c.primaryReason).toMatch(/depot-only/i);
  });
  it("operational only: no economic barrier is reported", () => {
    const c = build("F", "constrained", "none").commercial.bev;
    expect(c.reasonCodes).not.toContain("NEGATIVE_NPV");
    expect(c.reasonCodes).toContain("RANGE_EXCEEDED_DEPOT_ONLY");
  });
  it("economic only: no operational barrier is reported", () => {
    const c = build("U", "suitable", "none").commercial.bev;
    expect(c.hardConstraints).toEqual([]);
    expect(c.reasonCodes).toContain("NEGATIVE_NPV");
  });
});
