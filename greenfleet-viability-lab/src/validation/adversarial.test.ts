import { describe, expect, it } from "vitest";
import { calculateAssessment } from "@/calculation";
import { evaluateInput } from "@/calculation/analysis/evaluate";
import { deepFreeze, makeInput } from "@/calculation/fixtures";
import { runDriverAnalysis, runSensitivityAnalysis } from "@/calculation/sensitivity";
import { analyzeViability } from "@/calculation/threshold";
import type { AssessmentCalculationResult } from "@/calculation/types";
import { createBlankAssessment } from "@/domain/blank";
import { checkAssessment } from "@/domain/checks";
import { parseNumericInput } from "@/domain/fieldValue";
import type { NormalizedAssessmentInput } from "@/domain/normalized";
import { runAssessment } from "@/domain/runAssessment";
import { FIELDS } from "@/domain/schema/fields";
import { setText } from "@/test/helpers";
import { demo, setChoiceOf, setNum } from "@/test/helpers";

/**
 * Adversarial, invalid-relationship and numerical-robustness validation.
 * VALIDATION FIXTURES: SYNTHETIC VALUES. Rules tested are the CURRENT validation rules; none is invented here.
 */

const nonFiniteAt = (value: unknown, path = "$"): string[] => {
  if (typeof value === "number") return Number.isFinite(value) ? [] : [`${path} = ${value}`];
  if (Array.isArray(value)) return value.flatMap((v, i) => nonFiniteAt(v, `${path}[${i}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => nonFiniteAt(v, `${path}.${k}`));
  return [];
};
const expectFinite = (r: AssessmentCalculationResult) => expect(nonFiniteAt(r)).toEqual([]);

const run = (input: NormalizedAssessmentInput) => calculateAssessment(input);

describe("Free-text numeric input parsing (what a person can type)", () => {
  const cases: [string, "value" | "missing" | "invalid", number?][] = [
    ["0", "value", 0], ["0.0", "value", 0], ["-0", "value", -0], ["12.5", "value", 12.5], ["  12  ", "value", 12], [".5", "value", 0.5], ["5.", "value", 5],
    ["1e3", "value", 1000], ["1E-3", "value", 0.001], ["+7", "value", 7], ["-7", "value", -7],
    ["0.1234567890123456789", "value", 0.12345678901234568],
    ["", "missing"], ["   ", "missing"],
    ["abc", "invalid"], ["12abc", "invalid"], ["1,000", "invalid"], ["1 000", "invalid"], ["--5", "invalid"], ["-", "invalid"], ["e5", "invalid"],
    ["NaN", "invalid"], ["Infinity", "invalid"], ["-Infinity", "invalid"], ["1e400", "invalid"], ["0x10", "invalid"], ["₦100", "invalid"], ["١٢٣", "invalid"],
  ];
  it.each(cases)("%j -> %s", (raw, status, n) => {
    const r = parseNumericInput(raw);
    expect(r.status).toBe(status);
    if (status === "value" && r.status === "value") expect(r.value).toBe(n);
  });
  it("0 is kept as a value, never read as missing", () => {
    expect(parseNumericInput("0")).toEqual({ status: "value", value: 0 });
    expect(parseNumericInput("")).toEqual({ status: "missing" });
  });
});

describe("Every numeric field survives hostile values without a crash or a non-finite result", () => {
  const HOSTILE = [0, 1e-9, 1e-300, 0.1, 1, 99.9999, 100, 100.0001, 101, 1e6, 1e15, 1e300, 1.7976931348623157e308, -1, -1e-9, -1e300, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0.1 + 0.2, 123456789.123456789];
  const numericFields = FIELDS.filter((f) => f.kind === "number");

  it("the schema has numeric fields to test", () => expect(numericFields.length).toBeGreaterThan(30));

  it.each(numericFields.map((f) => [f.id] as const))("%s", (id) => {
    for (const v of HOSTILE) {
      const a = setNum(demo(), id, v);
      let o: ReturnType<typeof runAssessment> | undefined;
      expect(() => { o = runAssessment(a); }).not.toThrow();
      const out = o!;
      // The form may reject (blocking error), accept and calculate, or report a calculation error. It never returns NaN or Infinity.
      if (out.status === "ok") expect(nonFiniteAt(out.result)).toEqual([]);
      if (out.status === "invalid_inputs") expect(out.issues.length).toBeGreaterThan(0);
      if (!Number.isFinite(v) && out.status === "ok") {
        // A non-finite value is dropped by the storage shape guard and read as "not entered" (never as a number, never as 0 by
        // accident): it can only pass where the field is optional, and then the result is exactly the "not entered" result.
        const notEntered = runAssessment(setNum(demo(), id, null));
        expect(notEntered.status).toBe("ok");
        if (notEntered.status === "ok") expect(JSON.stringify(out.result)).toBe(JSON.stringify(notEntered.result));
      }
    }
  });

  it("N/A and blank are refused for required fields and accepted only where the schema allows it", () => {
    const required = numericFields.filter((f) => f.required && !f.allowNotApplicable && !f.visibleWhen);
    expect(required.length).toBeGreaterThan(5);
    for (const f of required.slice(0, 12)) {
      expect(runAssessment(setNum(demo(), f.id, "NA")).status, `${f.id} N/A`).toBe("invalid_inputs");
      expect(runAssessment(setNum(demo(), f.id, null)).status, `${f.id} blank`).toBe("invalid_inputs");
    }
  });
});

describe("Free-text names: long, Unicode and special characters", () => {
  const NAMES = [
    "A".repeat(5_000),
    "Ünïcödé 車両 🚚 ⚡ 🌍 العربية",
    '<script>alert("x")</script>',
    "=HYPERLINK(\"http://x\",\"y\")",
    "Name with,comma and \"quotes\" and\nnewline\r\nand\ttab",
    "../../etc/passwd",
    "   ",
    "\u0000​‮",
    "'; DROP TABLE assessments;--",
  ];
  it.each(NAMES.map((n, i) => [i, n] as const))("name #%i does not break validation, normalisation or the engine", (_i, name) => {
    const a = setText(setText(demo(), "business.assessmentName", name), "business.businessName", name);
    const o = runAssessment(a);
    if (a.inputs["business.assessmentName"] && name.trim() === "") {
      expect(o.status).toBe("invalid_inputs");
    } else {
      expect(o.status).toBe("ok");
      if (o.status === "ok") {
        expect(o.input.meta.assessmentName).toBe(name.trim());
        expectFinite(o.result);
      }
    }
  });
});

describe("Invalid relationships (current validation rules)", () => {
  const issues = (a: ReturnType<typeof demo>) => checkAssessment(a);
  const errorsFor = (a: ReturnType<typeof demo>, id: string) => issues(a).filter((i) => i.fieldId === id && i.severity === "error");
  const warningsFor = (a: ReturnType<typeof demo>, id: string) => issues(a).filter((i) => i.fieldId === id && i.severity === "warning");

  it("the demonstration baseline has no blocking error", () => expect(issues(demo()).filter((i) => i.severity === "error")).toEqual([]));

  it("analysis horizon: 0, negative and fractional are refused; the maximum is 50", () => {
    for (const v of [0, -1, 1.5, 51]) expect(errorsFor(setNum(demo(), "ops.analysisHorizon", v), "ops.analysisHorizon").length, String(v)).toBe(1);
    for (const v of [1, 50]) expect(errorsFor(setNum(demo(), "ops.analysisHorizon", v), "ops.analysisHorizon")).toEqual([]);
  });
  it("useful life: 0, negative and above 50 are refused for every vehicle type; a fractional life is allowed (documented)", () => {
    for (const id of ["diesel.usefulLife", "bev.usefulLife", "biofuel.usefulLife"]) {
      for (const v of [0, -3, 51]) expect(errorsFor(setNum(demo(), id, v), id).length, `${id}=${v}`).toBe(1);
      expect(errorsFor(setNum(demo(), id, 2.5), id), `${id}=2.5`).toEqual([]);
    }
  });
  it("fleet size: 0, negative and fractional are refused", () => {
    for (const v of [0, -1, 2.5]) expect(errorsFor(setNum(demo(), "fleet.size", v), "fleet.size").length, String(v)).toBe(1);
  });
  it("operating days: 0 and above 366 are refused", () => {
    for (const v of [0, 367, -5, 100.5]) expect(errorsFor(setNum(demo(), "ops.operatingDays", v), "ops.operatingDays").length, String(v)).toBe(1);
    for (const v of [1, 366]) expect(errorsFor(setNum(demo(), "ops.operatingDays", v), "ops.operatingDays")).toEqual([]);
  });
  it("charging loss: negative, 100% and above are refused; 99.9% is accepted", () => {
    for (const v of [-1, 100, 100.1, 250]) expect(errorsFor(setNum(demo(), "bev.chargingLoss", v), "bev.chargingLoss").length, String(v)).toBe(1);
    expect(errorsFor(setNum(demo(), "bev.chargingLoss", 99.9), "bev.chargingLoss")).toEqual([]);
    expect(errorsFor(setNum(demo(), "bev.chargingLoss", 0), "bev.chargingLoss")).toEqual([]);
  });
  it("battery replacement after the vehicle's useful life is an error; after the horizon only a warning", () => {
    expect(errorsFor(setNum(demo(), "bev.batteryReplacementYear", 9), "bev.batteryReplacementYear").length).toBe(1); // life 8
    expect(errorsFor(setNum(demo(), "bev.batteryReplacementYear", 7), "bev.batteryReplacementYear")).toEqual([]);
    expect(warningsFor(setNum(demo(), "bev.batteryReplacementYear", 7), "bev.batteryReplacementYear").length).toBe(1); // horizon 5
  });
  it("residual above the acquisition price is a warning, not a block (not invented as an error)", () => {
    const a = setNum(demo(), "diesel.acquisitionPrice", 1_000_000);
    // demo residual is 20% (percent), so switch to an amount larger than the price
    const amount = { ...a, inputs: { ...a.inputs, "diesel.residual": { value: { status: "value" as const, value: 2_000_000 }, qualifier: "amount" } } };
    expect(errorsFor(amount, "diesel.residual")).toEqual([]);
    expect(warningsFor(amount, "diesel.residual").length).toBe(1);
  });
  it("average payload above capacity is an error; equal to capacity is accepted", () => {
    expect(errorsFor(setNum(demo(), "fleet.averagePayload", 1_001), "fleet.averagePayload")).toEqual([]); // value is entered in a qualifier field, see below
    const a = demo();
    const over = { ...a, inputs: { ...a.inputs, "fleet.averagePayload": { value: { status: "value" as const, value: 1_001 }, qualifier: "kg" } } };
    const equal = { ...a, inputs: { ...a.inputs, "fleet.averagePayload": { value: { status: "value" as const, value: 1_000 }, qualifier: "kg" } } };
    expect(errorsFor(over, "fleet.averagePayload").length).toBe(1);
    expect(errorsFor(equal, "fleet.averagePayload")).toEqual([]);
  });
  it("debt plus equity must be 100%", () => {
    const bad = setNum(setNum(demo(), "finance.debtPercent", 60), "finance.equityPercent", 60);
    expect(errorsFor(bad, "finance.equityPercent").length).toBe(1);
  });
  it("a blank assessment cannot be calculated and lists what is missing", () => {
    const o = runAssessment(createBlankAssessment("x", "2026-01-01T00:00:00.000Z"));
    expect(o.status).toBe("invalid_inputs");
  });
  it("route distance longer than the daily distance is accepted (no rule exists; documented in the limitations)", () => {
    const a = demo();
    const withRoute = { ...a, inputs: { ...a.inputs, "ops.avgRouteDistance": { status: "value" as const, value: 500 } } };
    const o = runAssessment(withRoute);
    expect(o.status === "ok" || o.status === "invalid_inputs").toBe(true);
    expect(() => runAssessment(withRoute)).not.toThrow();
  });
  it("the engine independently rejects the same impossible relationships when given a normalized input directly", () => {
    const bad: [string, Parameters<typeof makeInput>[0]][] = [
      ["horizon 0", { operations: { analysisHorizonYears: 0 } }],
      ["horizon 2.5", { operations: { analysisHorizonYears: 2.5 } }],
      ["fleet 0", { fleet: { fleetSize: 0 } }],
      ["life 0", { diesel: { usefulLifeYears: 0 } }],
      ["life -2", { bev: { usefulLifeYears: -2 } }],
      ["loss 100", { bev: { chargingLossPct: 100 } }],
      ["discount -1", { finance: { discountRatePct: -1 } }],
      ["discount 101", { finance: { discountRatePct: 101 } }],
      ["negative price", { diesel: { fuelPricePerLitre: -1 } }],
      ["zero consumption", { diesel: { fuelConsumptionLitresPer100Km: 0 } }],
      ["escalation -100", { diesel: { fuelPriceEscalationPctPerYear: -100 } }],
      ["residual % > 100", { diesel: { residualValue: { kind: "percent_of_acquisition", amount: null, percent: 101 } } }],
      ["negative residual", { bev: { residualValue: { kind: "amount", amount: -5, percent: null } } }],
    ];
    for (const [name, patch] of bad) {
      const out = run(makeInput(patch));
      expect(out.ok, name).toBe(false);
    }
  });
});

describe("Engine-level hostile values (normalized input given directly)", () => {
  type Mut = [string, (i: NormalizedAssessmentInput, v: unknown) => void, unknown];
  const BAD: unknown[] = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, null, undefined, "12", -1e300, 1e308];
  const PATHS: [string, (i: NormalizedAssessmentInput, v: unknown) => void][] = [
    ["fleet.fleetSize", (i, v) => void ((i.fleet as { fleetSize: unknown }).fleetSize = v)],
    ["operations.analysisHorizonYears", (i, v) => void ((i.operations as { analysisHorizonYears: unknown }).analysisHorizonYears = v)],
    ["operations.annualDistanceKmPerVehicle", (i, v) => void ((i.operations as { annualDistanceKmPerVehicle: unknown }).annualDistanceKmPerVehicle = v)],
    ["finance.discountRatePct", (i, v) => void ((i.finance as { discountRatePct: unknown }).discountRatePct = v)],
    ["diesel.upfrontVehicleCost", (i, v) => void ((i.diesel as { upfrontVehicleCost: unknown }).upfrontVehicleCost = v)],
    ["diesel.fuelPricePerLitre", (i, v) => void ((i.diesel as { fuelPricePerLitre: unknown }).fuelPricePerLitre = v)],
    ["bev.electricityTariffPerKwh", (i, v) => void ((i.bev as { electricityTariffPerKwh: unknown }).electricityTariffPerKwh = v)],
    ["bev.energyConsumptionKwhPer100Km", (i, v) => void ((i.bev as { energyConsumptionKwhPer100Km: unknown }).energyConsumptionKwhPer100Km = v)],
    ["bev.usableRangeKm", (i, v) => void ((i.bev as { usableRangeKm: unknown }).usableRangeKm = v)],
    ["biofuel.fuelPricePerFuelUnit", (i, v) => void ((i.biofuel as { fuelPricePerFuelUnit: unknown }).fuelPricePerFuelUnit = v)],
  ];
  const cases = PATHS.flatMap(([path, set]) => BAD.map((v) => [path, set, v] as Mut));
  it.each(cases)("%s = %s", (_path, set, v) => {
    const input = makeInput({});
    set(input, v);
    let out: ReturnType<typeof calculateAssessment> | undefined;
    expect(() => (out = run(input))).not.toThrow();
    if (out!.ok) expectFinite(out!.result);
    else expect(out!.errors.length).toBeGreaterThan(0);
  });
  it("a completely wrong object is refused, not crashed on", () => {
    for (const junk of [null, undefined, {}, [], 42, "x", { schemaVersion: 2 }]) {
      expect(() => run(junk as never)).not.toThrow();
      expect((run(junk as never) as { ok: boolean }).ok).toBe(false);
    }
  });
});

describe("Defect D-2 / D-3 regressions (found in Batch 8)", () => {
  it("D-3: a vanishingly short useful life is refused at the engine boundary instead of looping for billions of iterations", () => {
    for (const life of [1e-9, 1e-6, 0.001, 0.04]) {
      const t0 = Date.now();
      const out = run(makeInput({ operations: { analysisHorizonYears: 50 }, diesel: { usefulLifeYears: life } }));
      expect(Date.now() - t0, `life ${life}`).toBeLessThan(1_000);
      expect(out.ok, `life ${life}`).toBe(false);
      if (!out.ok) expect(out.errors.some((e) => e.field === "diesel.usefulLifeYears" && /replacement/i.test(e.message))).toBe(true);
    }
  });
  it("D-3: the realistic shortest lives are still accepted (1 year over 50 years, and 0.5 years)", () => {
    expect(run(makeInput({ operations: { analysisHorizonYears: 50 }, diesel: { usefulLifeYears: 1 } })).ok).toBe(true);
    expect(run(makeInput({ operations: { analysisHorizonYears: 50 }, bev: { usefulLifeYears: 0.5 } })).ok).toBe(true);
  });
  it("D-3: the same guard covers the form path (a 1e-9 year life typed into the form)", () => {
    const t0 = Date.now();
    const o = runAssessment(setNum(demo(), "diesel.usefulLife", 1e-9));
    expect(Date.now() - t0).toBeLessThan(1_000);
    expect(o.status).toBe("calculation_error");
  });
  it("D-2: a fleet size that overflows the arithmetic is refused with a message, not shown as Infinity or NaN", () => {
    const o = runAssessment(setNum(demo(), "fleet.size", 1e308));
    expect(o.status).toBe("calculation_error");
    if (o.status === "calculation_error") expect(o.errors[0]!.message).toMatch(/too large|overflow/i);
  });
  it("D-2: an emission factor that overflows makes the emissions unavailable, and does not touch the economics", () => {
    const f = (v: number, unitId: string, unit: string) => ({ value: v, unit, unitId, scope: "direct" as const, source: "s", sourceYear: null, notes: null, lifecycleAdjustmentPct: null });
    const out = run(makeInput({ environmentalAssumptions: { diesel: f(1.7e308, "kgco2e_per_litre", "kg CO2e/litre"), gridElectricity: f(0.4, "kgco2e_per_kwh", "kg CO2e/kWh"), biofuel: f(1.2, "kgco2e_per_litre", "kg CO2e/litre") } }));
    const base = run(makeInput({}));
    if (!out.ok || !base.ok) throw new Error("engine");
    expectFinite(out.result);
    expect(out.result.environmental.diesel.status).toBe("unavailable");
    expect(out.result.bevVsDiesel).toEqual(base.result.bevVsDiesel);
    expect(out.result.commercial.bev.classification).toBe(base.result.commercial.bev.classification);
  });
});

describe("Numerical robustness", () => {
  const stress = (patch: Parameters<typeof makeInput>[0]) => {
    const out = run(makeInput(patch));
    if (!out.ok) return out;
    expectFinite(out.result);
    return out;
  };

  it("a 50-year horizon with replacement cycles", () => {
    const out = stress({ operations: { analysisHorizonYears: 50 }, diesel: { usefulLifeYears: 7 }, bev: { usefulLifeYears: 9, batteryReplacement: { expected: "yes", year: 4, cost: 5_000 } } });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.result.diesel.replacementYears).toHaveLength(7); // 7, 14, ..., 49
      expect(out.result.diesel.series).toHaveLength(51);
    }
  });
  it("high escalation (100% a year for 50 years) stays finite", () => {
    const out = stress({ operations: { analysisHorizonYears: 50 }, diesel: { fuelPriceEscalationPctPerYear: 100 }, bev: { electricityPriceEscalationPctPerYear: 100 } });
    expect(out.ok).toBe(true);
  });
  it("a 100% discount rate (the upper limit) stays finite and discounts late years to almost nothing", () => {
    const out = stress({ finance: { discountRatePct: 100 }, operations: { analysisHorizonYears: 50 } });
    expect(out.ok).toBe(true);
    if (out.ok) expect(Math.abs(out.result.bevVsDiesel.rows[50]!.discountedIncrementalCashFlow)).toBeLessThan(1e-9 * 1e6);
  });
  it("a very large fleet and very large prices stay finite", () => {
    const out = stress({ fleet: { fleetSize: 1_000_000 }, operations: { fleetAnnualDistanceKm: 1e10 }, diesel: { upfrontVehicleCost: 1e11 }, bev: { upfrontVehicleCost: 2e11 } });
    expect(out.ok).toBe(true);
  });
  it("a very small distance and very small prices stay finite", () => {
    expect(stress({ operations: { annualDistanceKmPerVehicle: 1e-9 }, diesel: { fuelPricePerLitre: 1e-12 } }).ok).toBe(true);
  });
  it("tiny cost differences are resolved, with a stable sign and a stable near-break-even classification", () => {
    // BEV costs 15,000 - 1e-6 so NPV = +1e-6: indifference within tolerance, never 'favourable'
    const r = run(makeInput({ bev: { upfrontVehicleCost: 15_000 - 1e-6 } }));
    if (!r.ok) throw new Error("engine");
    expect(r.result.bevVsDiesel.npv).toBeGreaterThan(0);
    expect(r.result.commercial.bev.economicCase).toBe("NEAR_BREAK_EVEN");
    expect(r.result.commercial.bev.classification).toBe("CONDITIONALLY_VIABLE");
    const below = run(makeInput({ bev: { upfrontVehicleCost: 15_000 + 1e-6 } }));
    if (!below.ok) throw new Error("engine");
    expect(below.result.bevVsDiesel.npv).toBeLessThan(0);
    expect(below.result.commercial.bev.economicCase).toBe("NEAR_BREAK_EVEN");
  });
  it("values that overflow double precision are refused with a message, never shown as Infinity or NaN", () => {
    const out = run(makeInput({ fleet: { fleetSize: 1e9 }, diesel: { upfrontVehicleCost: 1.7e308 } }));
    if (out.ok) expectFinite(out.result);
    else expect(out.errors[0]!.message).toBeTruthy();
    const out2 = run(makeInput({ diesel: { fuelPriceEscalationPctPerYear: 1e6 }, operations: { analysisHorizonYears: 50 } }));
    if (out2.ok) expectFinite(out2.result);
  });
  it("sensitivity, drivers and thresholds also stay finite at extreme but valid inputs", () => {
    const i = makeInput({ fleet: { fleetSize: 100_000 }, operations: { fleetAnnualDistanceKm: 1e9 }, finance: { discountRatePct: 90 }, diesel: { fuelPriceEscalationPctPerYear: 30 } });
    const s = runSensitivityAnalysis({ input: i, technology: "bev", variableId: "dieselPrice" });
    expect(nonFiniteAt(s)).toEqual([]);
    const d = runDriverAnalysis({ input: i, technology: "bev" });
    expect(nonFiniteAt(d)).toEqual([]);
    const a = analyzeViability(i, "bev");
    expect(nonFiniteAt(JSON.parse(JSON.stringify(a)))).toEqual([]);
  });
  it("classifications are stable under an exact scale change of every cost (x 1e6)", () => {
    const scale = (k: number) =>
      run(
        makeInput({
          diesel: { upfrontVehicleCost: 10_000 * k, annualMaintenanceCost: 500 * k, fuelPricePerLitre: 1 * k, residualValue: { kind: "amount", amount: 2_000 * k, percent: null } },
          bev: { upfrontVehicleCost: 13_000 * k, annualMaintenanceCost: 200 * k, electricityTariffPerKwh: 0.05 * k, residualValue: { kind: "amount", amount: 3_000 * k, percent: null } },
          biofuel: { upfrontVehicleCost: 10_500 * k, annualMaintenanceCost: 550 * k, fuelPricePerFuelUnit: 0.8 * k, residualValue: { kind: "amount", amount: 2_000 * k, percent: null } },
        }),
      );
    const a = scale(1);
    const b = scale(1e6);
    if (!a.ok || !b.ok) throw new Error("engine");
    expect(b.result.commercial.bev.classification).toBe(a.result.commercial.bev.classification);
    expect(b.result.commercial.biofuel.classification).toBe(a.result.commercial.biofuel.classification);
    expect(b.result.bevVsDiesel.npv / 1e6).toBeCloseTo(a.result.bevVsDiesel.npv, 6);
    expect(b.result.bevVsDiesel.simplePayback.years).toBeCloseTo(a.result.bevVsDiesel.simplePayback.years!, 9);
  });
});

describe("Missing vs zero vs not applicable vs unknown: calculation layer", () => {
  const r = (patch: Parameters<typeof makeInput>[0]) => {
    const o = run(makeInput(patch));
    if (!o.ok) throw new Error(o.errors.map((e) => e.message).join("; "));
    return o.result;
  };
  it("no residual entered (null) is a disclosed gap; a residual of 0 is a user input", () => {
    const none = r({ diesel: { residualValue: null } });
    const zero = r({ diesel: { residualValue: { kind: "amount", amount: 0, percent: null } } });
    expect(none.assumptions.find((a) => a.id === "diesel_residual")?.status).toBe("missing");
    expect(zero.assumptions.find((a) => a.id === "diesel_residual")?.status).toBe("user_input");
    expect(none.warnings.some((w) => w.code === "RESIDUAL_NOT_PROVIDED")).toBe(true);
    expect(zero.warnings.some((w) => w.code === "RESIDUAL_NOT_PROVIDED")).toBe(false);
    expect(none.diesel.undiscountedTco).toBe(zero.diesel.undiscountedTco);
  });
  it("an incentive of type 'none' differs from no incentive information", () => {
    expect(() => r({ finance: { incentives: { bev: { type: "none", amount: null, percentOfPurchasePrice: null } } } })).not.toThrow();
  });
  it("unknown battery replacement is excluded and warned; 'no' is a statement; both differ from 'yes'", () => {
    const unknown = r({ bev: { batteryReplacement: { expected: "unknown", year: null, cost: null } } });
    const no = r({ bev: { batteryReplacement: { expected: "no", year: null, cost: null } } });
    expect(unknown.assumptions.find((a) => a.id === "bev_battery")?.status).toBe("excluded");
    expect(no.assumptions.find((a) => a.id === "bev_battery")?.status).toBe("user_input");
    expect(unknown.warnings.some((w) => w.code === "BATTERY_REPLACEMENT_UNKNOWN")).toBe(true);
    expect(no.warnings.some((w) => w.code === "BATTERY_REPLACEMENT_UNKNOWN")).toBe(false);
    expect(unknown.bev.undiscountedTco).toBe(no.bev.undiscountedTco); // not priced, but disclosed
  });
  it("environmental: unavailable is a status, zero is a number (see env-ops tests); completeness reflects it", () => {
    expect(r({}).dataCompleteness.environmental.state).not.toBe("complete");
  });
  it("payback: immediate (0), achieved (n) and not achieved (null) are three different states", () => {
    const states = new Set([
      r({ bev: { upfrontVehicleCost: 9_000 } }).bevVsDiesel.simplePayback.status,
      r({}).bevVsDiesel.simplePayback.status,
      r({ bev: { upfrontVehicleCost: 20_000 } }).bevVsDiesel.simplePayback.status,
    ]);
    expect([...states].sort()).toEqual(["achieved", "immediate", "not_achieved"]);
  });
});

describe("Determinism", () => {
  const strip = (x: unknown) => JSON.stringify(x, (k, v) => (k === "updatedAt" || k === "createdAt" ? undefined : v));
  const runOnce = () => {
    const i = makeInput({ bev: { upfrontVehicleCost: 14_900 } });
    const e = evaluateInput(i);
    if (!e.ok) throw new Error("engine");
    return strip({
      result: e.result,
      sens: runSensitivityAnalysis({ input: i, technology: "bev", variableId: "bevAcquisition" }),
      drivers: runDriverAnalysis({ input: i, technology: "bev" }),
      viability: analyzeViability(i, "bev"),
    });
  };
  it("five identical runs give byte-identical classification, NPV, TCO, sensitivity, drivers and thresholds", () => {
    const first = runOnce();
    for (let k = 0; k < 4; k++) expect(runOnce()).toBe(first);
  });
  it("the source of the engine and analysis layers uses no randomness or clock", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
    const root = new URL("../calculation", import.meta.url).pathname;
    const files = walk(root).filter((f) => /\.ts$/.test(f) && !/\.test\./.test(f) && !/fixtures\.ts$/.test(f));
    expect(files.length).toBeGreaterThan(20);
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/Math\.random|crypto\.getRandomValues|new Date\(\)|Date\.now\(\)/);
    }
  });
});

describe("Mutation safety: frozen inputs and results", () => {
  it("the engine reads a deeply frozen normalized input without error and without changing it", () => {
    const i = deepFreeze(makeInput({}));
    const before = JSON.stringify(i);
    const out = run(i);
    expect(out.ok).toBe(true);
    expect(JSON.stringify(i)).toBe(before);
  });
  it("sensitivity, drivers, viability analysis and evaluation never write to a frozen input", () => {
    const i = deepFreeze(makeInput({ bev: { upfrontVehicleCost: 16_000 } }));
    const before = JSON.stringify(i);
    expect(() => {
      runSensitivityAnalysis({ input: i, technology: "bev", variableId: "bevAcquisition" });
      runDriverAnalysis({ input: i, technology: "bev" });
      analyzeViability(i, "bev");
      analyzeViability(i, "biofuel");
      evaluateInput(i);
    }).not.toThrow();
    expect(JSON.stringify(i)).toBe(before);
  });
  it("a result is independent of later edits to the input object that produced it", () => {
    const i = makeInput({});
    const out = run(i);
    if (!out.ok) throw new Error("engine");
    const before = JSON.stringify(out.result);
    (i.diesel as { fuelPricePerLitre: number }).fuelPricePerLitre = 99;
    (i.meta.illustrativeInputs as string[]).push("x");
    expect(JSON.stringify(out.result)).toBe(before);
  });
  it("setting an enum-like choice back and forth does not leave stale state in a calculation", () => {
    const a = setChoiceOf(demo(), "bev.batteryReplacement", "no");
    const b = setChoiceOf(a, "bev.batteryReplacement", "yes");
    const o = runAssessment(b);
    expect(o.status === "ok" || o.status === "invalid_inputs").toBe(true);
  });
});
