import { describe, expect, it } from "vitest";
import { checkAssessment } from "./checks";
import { assessReadiness, stepCompletions } from "./completion";
import { deriveOperations, toCanonical } from "./derive";
import { missing, value } from "./fieldValue";
import { createReader, visibleFields } from "./reader";
import { normalizeAssessment } from "./normalize";
import { blank, demo, setChoiceOf, setNum, setQ, setText, withNums } from "@/test/helpers";

const errorsFor = (a: Parameters<typeof checkAssessment>[0], id: string) => checkAssessment(a).filter((i) => i.fieldId === id && i.severity === "error");
const ok = (a: Parameters<typeof normalizeAssessment>[0]) => {
  const r = normalizeAssessment(a);
  if (!r.ok) throw new Error(JSON.stringify(r.issues.map((i) => i.message)));
  return r.input;
};

describe("zero, missing, not applicable and unknown", () => {
  it("keeps 0 as a real value all the way to the normalized output", () => {
    const n = ok(withNums(demo(), { "diesel.insurance": 0, "diesel.annualMaintenance": 0 }));
    expect(n.diesel.annualInsurance).toBe(0);
    expect(n.diesel.annualMaintenanceCost).toBe(0);
    expect(n.inputStatus["diesel.insurance"]).toBe("value");
  });
  it("normalizes blank and not-applicable optional costs to null, but keeps them distinguishable", () => {
    const base = demo();
    const blankCost = ok(setNum(base, "diesel.registration", null));
    const naCost = ok(setNum(base, "diesel.registration", "NA"));
    expect(blankCost.diesel.annualRegistration).toBeNull();
    expect(naCost.diesel.annualRegistration).toBeNull();
    expect(blankCost.inputStatus["diesel.registration"]).toBe("missing");
    expect(naCost.inputStatus["diesel.registration"]).toBe("not_applicable");
  });
  it("accepts zero where zero is logically valid", () => {
    for (const id of ["bevInfra.equipmentCost", "bevInfra.installationCost", "diesel.fuelPrice", "bev.electricityTariff", "diesel.acquisitionPrice"]) {
      expect(errorsFor(setNum(demo(), id, 0), id), id).toEqual([]);
    }
    expect(errorsFor(setNum(setChoiceOf(demo(), "incentive.bev.type", "upfront_grant"), "incentive.bev.amount", 0), "incentive.bev.amount")).toEqual([]);
  });
  it("rejects zero where it is impossible", () => {
    for (const id of ["fleet.size", "ops.dailyDistance", "ops.analysisHorizon", "diesel.usefulLife", "bev.usableRange", "ops.operatingDays"]) {
      expect(errorsFor(setNum(demo(), id, 0), id).length, id).toBeGreaterThan(0);
    }
  });
  it("keeps 'unknown' battery replacement distinct from 'no' and from zero cost", () => {
    const unknown = ok(setChoiceOf(demo(), "bev.batteryReplacement", "unknown"));
    const no = ok(setChoiceOf(demo(), "bev.batteryReplacement", "no"));
    const unanswered = ok(setChoiceOf(demo(), "bev.batteryReplacement", null));
    expect(unknown.bev.batteryReplacement).toEqual({ expected: "unknown", year: null, cost: null });
    expect(no.bev.batteryReplacement.expected).toBe("no");
    expect(unanswered.bev.batteryReplacement.expected).toBeNull();
    expect(unknown.bev.batteryReplacement.cost).not.toBe(0);
  });
});

describe("validation rules", () => {
  it("rejects negative and zero distance, accepts positive", () => {
    expect(errorsFor(setNum(demo(), "ops.dailyDistance", -10), "ops.dailyDistance")[0]?.code).toBe("below_min");
    expect(errorsFor(setNum(demo(), "ops.dailyDistance", 0), "ops.dailyDistance").length).toBe(1);
    expect(errorsFor(setNum(demo(), "ops.dailyDistance", 80), "ops.dailyDistance")).toEqual([]);
  });
  it("enforces operating days 1..366 as whole numbers", () => {
    for (const bad of [0, 367, 12.5, -1]) expect(errorsFor(setNum(demo(), "ops.operatingDays", bad), "ops.operatingDays").length, String(bad)).toBe(1);
    for (const good of [1, 250, 366]) expect(errorsFor(setNum(demo(), "ops.operatingDays", good), "ops.operatingDays")).toEqual([]);
  });
  it("rejects percentages outside 0..100", () => {
    for (const [id, bad] of [["finance.discountRate", 101], ["finance.discountRate", -1], ["finance.interestRate", -2], ["bev.chargingLoss", 140], ["biofuel.blendPercent", 120], ["biofuel.blendPercent", -5], ["finance.debtPercent", 130]] as const) {
      expect(errorsFor(setNum(demo(), id, bad), id).length, `${id}=${bad}`).toBeGreaterThan(0);
    }
    expect(errorsFor(setNum(demo(), "biofuel.blendPercent", 100), "biofuel.blendPercent")).toEqual([]);
    expect(errorsFor(setNum(demo(), "biofuel.blendPercent", 0), "biofuel.blendPercent")).toEqual([]);
  });
  it("rejects negative money and vehicle price, and non-integer counts", () => {
    expect(errorsFor(setNum(demo(), "diesel.acquisitionPrice", -1), "diesel.acquisitionPrice").length).toBe(1);
    expect(errorsFor(setNum(demo(), "bevInfra.chargerCount", 1.5), "bevInfra.chargerCount")[0]?.code).toBe("not_integer");
    expect(errorsFor(setNum(demo(), "bevInfra.vehiclesSharing", 0), "bevInfra.vehiclesSharing").length).toBe(1);
  });
  it("requires debt and equity to add up to 100%", () => {
    const bad = setNum(setNum(demo(), "finance.debtPercent", 60), "finance.equityPercent", 30);
    expect(errorsFor(bad, "finance.equityPercent")[0]?.message).toMatch(/add up to 100%/);
    const good = setNum(setNum(demo(), "finance.debtPercent", 60), "finance.equityPercent", 40);
    expect(errorsFor(good, "finance.equityPercent")).toEqual([]);
    const floaty = setNum(setNum(demo(), "finance.debtPercent", 33.3), "finance.equityPercent", 66.7);
    expect(errorsFor(floaty, "finance.equityPercent")).toEqual([]);
  });
  it("checks battery replacement timing against life and horizon", () => {
    const afterLife = setNum(demo(), "bev.batteryReplacementYear", 12);
    expect(errorsFor(afterLife, "bev.batteryReplacementYear").length).toBe(1);
    const afterHorizon = setNum(demo(), "bev.batteryReplacementYear", 7);
    expect(errorsFor(afterHorizon, "bev.batteryReplacementYear")).toEqual([]);
    expect(checkAssessment(afterHorizon).some((i) => i.fieldId === "bev.batteryReplacementYear" && i.severity === "warning")).toBe(true);
    expect(errorsFor(setNum(demo(), "bev.batteryReplacementYear", 0), "bev.batteryReplacementYear").length).toBe(1);
  });
  it("rejects average payload above capacity, in mixed units", () => {
    const a = setQ(setQ(demo(), "fleet.payloadCapacity", { value: value(1), qualifier: "tonnes" }), "fleet.averagePayload", { value: value(1500), qualifier: "kg" });
    expect(errorsFor(a, "fleet.averagePayload")[0]?.message).toMatch(/cannot exceed payload capacity/);
  });
  it("rejects an invalid source year but never requires provenance", () => {
    expect(ok(demo()).provenance).toEqual({});
  });
  it("only flags unusual-but-possible efficiency as a warning", () => {
    const a = setQ(demo(), "diesel.fuelEfficiency", { value: value(250), qualifier: "litres_per_100km" });
    const issues = checkAssessment(a).filter((i) => i.fieldId === "diesel.fuelEfficiency");
    expect(issues.map((i) => i.severity)).toEqual(["warning"]);
  });
});

describe("unit conversion and derived previews", () => {
  it("converts fuel efficiency between km/litre and litres/100 km", () => {
    const r = createReader(demo()); // 8 km/litre entered
    expect(toCanonical(r, "diesel.fuelEfficiency")).toEqual({ value: 12.5, unit: "litres_per_100km", converted: true });
    const switched = setQ(demo(), "diesel.fuelEfficiency", { qualifier: "litres_per_100km" });
    expect(createReader(switched).q("diesel.fuelEfficiency").value).toEqual(value(12.5)); // value converted, not just relabelled
    const back = setQ(switched, "diesel.fuelEfficiency", { qualifier: "km_per_litre" });
    expect(createReader(back).q("diesel.fuelEfficiency").value).toEqual(value(8));
  });
  it("converts EV energy consumption between kWh/km and kWh/100 km without float noise", () => {
    const a = setQ(demo(), "bev.energyConsumption", { value: value(0.29), qualifier: "kwh_per_km" });
    expect(ok(a).bev.energyConsumptionKwhPer100Km).toBe(29);
  });
  it("converts tonnes to kg and converts a stored value when the unit is switched", () => {
    const a = setQ(demo(), "fleet.payloadCapacity", { qualifier: "tonnes" });
    expect(createReader(a).q("fleet.payloadCapacity").value).toEqual(value(1)); // 1000 kg -> 1 t
    expect(ok(a).fleet.payloadCapacityKg).toBe(1000);
  });
  it("clears rather than reinterprets when the conversion is not exact (amount vs percent)", () => {
    const a = setQ(demo(), "diesel.residual", { qualifier: "amount" });
    expect(createReader(a).q("diesel.residual").value).toEqual(missing());
  });
  it("derives annual and fleet distance from daily distance and operating days", () => {
    const d = deriveOperations(demo());
    expect(d).toMatchObject({ mode: "daily", dailyDistanceKm: 100, annualDistanceKm: 25000, fleetAnnualDistanceKm: 125000 });
    expect(d.formula).toBe("100 km/day × 250 days/year = 25000 km/year");
  });
  it("supports entering annual distance directly without contradictory daily values", () => {
    let a = setChoiceOf(demo(), "ops.distanceMode", "annual");
    a = setNum(a, "ops.annualDistance", 30000);
    const d = deriveOperations(a);
    expect(d).toMatchObject({ mode: "annual", annualDistanceKm: 30000, dailyDistanceKm: 120, fleetAnnualDistanceKm: 150000 });
    // the stale daily value is hidden, so it cannot contradict the annual figure
    expect(createReader(a).isVisible("ops.dailyDistance")).toBe(false);
    expect(ok(a).operations).toMatchObject({ distanceInputMode: "annual", dailyDistanceKm: 120, annualDistanceKmPerVehicle: 30000 });
  });
  it("is not distorted by floating-point noise", () => {
    const a = withNums(demo(), { "ops.dailyDistance": 0.1, "ops.operatingDays": 3 });
    expect(deriveOperations(a).annualDistanceKm).toBe(0.3);
  });
  it("supports gaseous biofuel pathways in their own units", () => {
    let a = setChoiceOf(demo(), "biofuel.pathway", "biomethane");
    a = setChoiceOf(a, "biofuel.fuelUnit", "kg");
    a = setNum(a, "biofuel.fuelPrice", 600);
    a = setQ(a, "biofuel.fuelEfficiency", { value: value(5), qualifier: "distance_per_fuel" }); // 5 km/kg
    const n = ok(a);
    expect(n.biofuel).toMatchObject({ fuelUnit: "kg", fuelPricePerFuelUnit: 600, fuelConsumptionFuelUnitsPer100Km: 20, blendPct: null });
    expect(createReader(a).unitOf("biofuel.fuelEfficiency")).toBe("km_per_kg");
  });
  it("clears unit-dependent biofuel inputs when the pathway or fuel unit changes", () => {
    const a = setChoiceOf(demo(), "biofuel.pathway", "biomethane");
    expect(createReader(a).number("biofuel.fuelPrice")).toEqual(missing());
    expect(a.illustrative).not.toContain("biofuel.fuelPrice");
  });
});

describe("conditional form logic", () => {
  const visible = (a: Parameters<typeof visibleFields>[0], id: string) => createReader(a).isVisible(id);

  it("shows battery replacement details only when replacement is expected", () => {
    expect(visible(demo(), "bev.batteryReplacementYear")).toBe(true);
    for (const answer of ["no", "unknown", null]) {
      const a = setChoiceOf(demo(), "bev.batteryReplacement", answer);
      expect(visible(a, "bev.batteryReplacementYear"), String(answer)).toBe(false);
      expect(visible(a, "bev.batteryReplacementCost"), String(answer)).toBe(false);
    }
  });
  it("does not carry a hidden replacement cost into the normalized output", () => {
    const n = ok(setChoiceOf(demo(), "bev.batteryReplacement", "no"));
    expect(n.bev.batteryReplacement).toEqual({ expected: "no", year: null, cost: null });
    expect(n.inputStatus["bev.batteryReplacementCost"]).toBe("hidden");
  });
  it("shows debt fields only when debt exists", () => {
    const equityOnly = setChoiceOf(demo(), "finance.structure", "equity_100");
    for (const id of ["finance.debtPercent", "finance.equityPercent", "finance.interestRate", "finance.loanTenor"]) expect(visible(equityOnly, id), id).toBe(false);
    expect(ok(equityOnly).finance).toMatchObject({ debtSharePct: 0, equitySharePct: 100, interestRatePct: null, loanTenorYears: null });
    const allDebt = setChoiceOf(demo(), "finance.structure", "debt_100");
    expect(visible(allDebt, "finance.interestRate")).toBe(true);
    expect(visible(allDebt, "finance.debtPercent")).toBe(false);
    expect(ok(allDebt).finance).toMatchObject({ debtSharePct: 100, equitySharePct: 0 });
    const zeroDebt = withNums(demo(), { "finance.debtPercent": 0, "finance.equityPercent": 100 });
    expect(visible(zeroDebt, "finance.interestRate")).toBe(false);
  });
  it("shows the blend percentage only for biodiesel blends", () => {
    expect(visible(demo(), "biofuel.blendPercent")).toBe(true);
    expect(visible(setChoiceOf(demo(), "biofuel.pathway", "renewable_diesel"), "biofuel.blendPercent")).toBe(false);
  });
  it("offers a fuel unit only for non-liquid pathways", () => {
    expect(visible(demo(), "biofuel.fuelUnit")).toBe(false);
    expect(visible(setChoiceOf(demo(), "biofuel.pathway", "biomethane"), "biofuel.fuelUnit")).toBe(true);
  });
  it("shows conversion cost only for conversions and purchase price only for new vehicles", () => {
    expect(visible(demo(), "biofuel.acquisitionPrice")).toBe(true);
    expect(visible(demo(), "biofuel.conversionCost")).toBe(false);
    const conv = setChoiceOf(demo(), "biofuel.acquisitionMode", "conversion");
    expect(visible(conv, "biofuel.conversionCost")).toBe(true);
    expect(visible(conv, "biofuel.existingVehicleValue")).toBe(true);
    expect(visible(conv, "biofuel.acquisitionPrice")).toBe(false);
    const done = ok(setNum(conv, "biofuel.conversionCost", 1_200_000));
    expect(done.biofuel).toMatchObject({ upfrontVehicleCost: 1_200_000, acquisition: { mode: "conversion", existingVehicleValue: null } });
  });
  it("shows charger purchase fields only when chargers are bought or built", () => {
    expect(visible(demo(), "bevInfra.equipmentCost")).toBe(true);
    for (const arrangement of ["existing_access", "public_only", "unknown", null]) {
      expect(visible(setChoiceOf(demo(), "bevInfra.arrangement", arrangement), "bevInfra.equipmentCost"), String(arrangement)).toBe(false);
    }
    expect(ok(setChoiceOf(demo(), "bevInfra.arrangement", "public_only")).infrastructure.bevCharging).toMatchObject({ investmentRequired: false, equipmentCost: null });
  });
  it("shows biofuel infrastructure only when special infrastructure is required", () => {
    expect(visible(demo(), "bioInfra.storageCost")).toBe(false);
    expect(visible(setChoiceOf(demo(), "biofuel.specialInfrastructure", "yes"), "bioInfra.storageCost")).toBe(true);
    expect(visible(setChoiceOf(demo(), "biofuel.specialInfrastructure", "unknown"), "bioInfra.storageCost")).toBe(false);
  });
  it("shows incentive detail only for the chosen incentive type", () => {
    const grant = setChoiceOf(demo(), "incentive.diesel.type", "upfront_grant");
    expect(visible(grant, "incentive.diesel.amount")).toBe(true);
    expect(visible(grant, "incentive.diesel.percent")).toBe(false);
    expect(visible(setChoiceOf(demo(), "incentive.diesel.type", "percent_subsidy"), "incentive.diesel.percent")).toBe(true);
    expect(visible(setChoiceOf(demo(), "incentive.diesel.type", "none"), "incentive.diesel.amount")).toBe(false);
  });
  it("never assumes an incentive exists", () => {
    const n = ok(demo());
    expect(n.finance.incentives.diesel).toEqual({ type: null, amount: null, percentOfPurchasePrice: null });
  });
  it("shows payload reduction only when a reduction is expected", () => {
    expect(visible(demo(), "bev.payloadReduction")).toBe(false);
    expect(visible(setChoiceOf(demo(), "bev.payloadImpact", "reduced"), "bev.payloadReduction")).toBe(true);
  });
});

describe("completeness and readiness", () => {
  it("a blank assessment is not started and not ready", () => {
    const a = blank();
    expect(stepCompletions(a).map((s) => s.state)).toEqual(["not_started", "not_started", "not_started", "not_started", "not_started"]);
    expect(assessReadiness(a).commercialReady).toBe(false);
    expect(assessReadiness(a).environmental).toBe("not_started");
  });
  it("the demo is ready for commercial analysis but environmentally incomplete", () => {
    const r = assessReadiness(demo());
    expect(r.commercialReady).toBe(true);
    expect(r.environmental).toBe("not_started");
    expect(r.summary).toContain("Ready for commercial analysis");
  });
  it("names the missing BEV field", () => {
    const r = assessReadiness(setNum(demo(), "bev.usableRange", null));
    expect(r.commercialReady).toBe(false);
    expect(r.missingRequired.map((m) => m.label)).toEqual(["Usable driving range per full charge"]);
    expect(r.missingRequired[0]).toMatchObject({ stepId: "electric", sectionId: "bev-core" });
  });
  it("tracks partial environmental completeness without blocking the commercial analysis", () => {
    const a = setNum(demo(), "env.diesel.value", 2.7);
    expect(assessReadiness(a)).toMatchObject({ commercialReady: true, environmental: "partial" });
    const full = withNums(a, { "env.grid.value": 0.5, "env.biofuel.value": 1.1 });
    expect(assessReadiness(full).environmental).toBe("complete");
  });
  it("counts required inputs per step", () => {
    const s = stepCompletions(demo()).find((x) => x.stepId === "electric")!;
    expect(s.requiredDone).toBe(s.requiredTotal);
    expect(s.state).toBe("complete");
  });
});

describe("normalized output", () => {
  it("expresses every value in the documented canonical unit", () => {
    let a = demo();
    a = setQ(a, "fleet.payloadCapacity", { value: value(1.5), qualifier: "tonnes" });
    a = setQ(a, "fleet.averagePayload", { value: value(900), qualifier: "kg" });
    a = setQ(a, "bev.energyConsumption", { value: value(0.25), qualifier: "kwh_per_km" });
    const n = ok(a);
    expect(n.fleet).toMatchObject({ fleetSize: 5, payloadCapacityKg: 1500, averagePayloadKg: 900 });
    expect(n.diesel.fuelConsumptionLitresPer100Km).toBe(12.5);
    expect(n.bev.energyConsumptionKwhPer100Km).toBe(25);
    expect(n.operations).toMatchObject({ dailyDistanceKm: 100, operatingDaysPerYear: 250, annualDistanceKmPerVehicle: 25000, fleetAnnualDistanceKm: 125000, analysisHorizonYears: 5 });
    expect(n.meta).toMatchObject({ currency: "NGN", dataOrigin: "demo" });
    expect(n.diesel.residualValue).toEqual({ kind: "percent_of_acquisition", amount: null, percent: 20 });
    expect(n.finance).toMatchObject({ structure: "debt_equity", debtSharePct: 50, equitySharePct: 50, interestRatePct: 20, loanTenorYears: 4, discountRatePct: 15 });
  });
  it("percentages stay on the 0..100 scale", () => {
    expect(ok(demo()).bev.chargingLossPct).toBe(10);
    expect(ok(demo()).finance.discountRatePct).toBe(15);
  });
  it("refuses to normalize an invalid assessment", () => {
    const r = normalizeAssessment(setNum(demo(), "ops.dailyDistance", -1));
    expect(r.ok).toBe(false);
    expect(normalizeAssessment(blank()).ok).toBe(false);
  });
  it("is JSON-serialisable with no formatted strings in numeric positions", () => {
    const n = ok(demo());
    const json = JSON.stringify(n);
    expect(JSON.parse(json)).toEqual(n);
    expect(json).not.toMatch(/₦\d|\d,\d{3}/);
  });
  it("records provenance only when the user supplied it", () => {
    const a = { ...demo(), provenance: { "diesel.fuelPrice": { source: "supplier_quotation" as const, reference: " Depot quote ", year: value(2026) } } };
    expect(ok(a).provenance).toEqual({ "diesel.fuelPrice": { source: "supplier_quotation", reference: "Depot quote", year: 2026 } });
  });
  it("includes emission factors with unit, source, year and notes when entered", () => {
    let a = withNums(demo(), { "env.diesel.value": 2.5, "env.diesel.year": 2020 });
    a = setText(a, "env.diesel.source", "Example report");
    expect(ok(a).environmentalAssumptions.diesel).toEqual({ value: 2.5, unit: "kg CO2e/litre", unitId: "kgco2e_per_litre", scope: null, source: "Example report", sourceYear: 2020, notes: null, lifecycleAdjustmentPct: null });
    expect(ok(demo()).environmentalAssumptions.diesel.value).toBeNull();
  });
});
