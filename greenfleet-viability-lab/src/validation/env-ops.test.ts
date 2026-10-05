import { describe, expect, it } from "vitest";
import { calculateAssessment } from "@/calculation";
import { makeInput } from "@/calculation/fixtures";
import { evaluateOperationalFeasibility } from "@/calculation/operational";
import type { AssessmentCalculationResult } from "@/calculation/types";
import type { NormalizedAssessmentInput } from "@/domain/normalized";

/** VALIDATION FIXTURES: SYNTHETIC VALUES. Not emission factors from any source. Expected values are plain arithmetic. */

const run = (input: NormalizedAssessmentInput): AssessmentCalculationResult => {
  const out = calculateAssessment(input);
  if (!out.ok) throw new Error(out.errors.map((e) => e.message).join("; "));
  return out.result;
};
const factor = (value: number | null, unitId: string, unit: string, scope: "direct" | "fuel_cycle" | "lifecycle" | null = "direct", source: string | null = "synthetic") => ({
  value, unit, unitId, scope, source, sourceYear: null, notes: null, lifecycleAdjustmentPct: null,
});

describe("Environmental benchmark: physical quantity x compatible factor", () => {
  /*
   * 1 vehicle, 10,000 km/yr, 5 years, 50,000 km in total.
   * Diesel   10 L/100 km -> 1,000 L/yr x 2.5 kg/L                     = 2,500 kg/yr    (0.25 kg/km)  12,500 kg over 5 years
   * BEV      100 kWh/100 km -> 10,000 kWh delivered; 20% loss -> 10,000 / 0.8 = 12,500 kWh from the grid
   *          x 0.4 kg/kWh                                              = 5,000 kg/yr    (0.50 kg/km)  25,000 kg over 5 years
   * Biofuel  12.5 L/100 km -> 1,250 L/yr x 1.2 kg/L                    = 1,500 kg/yr    (0.15 kg/km)   7,500 kg over 5 years
   * BEV vs diesel:     (2,500 - 5,000) / 2,500 x 100 = -100%  (an increase; 2,500 kg/yr more)
   * Biofuel vs diesel: (2,500 - 1,500) / 2,500 x 100 = +40%   (a reduction; 1,000 kg/yr less)
   */
  const r = run(
    makeInput({
      bev: { chargingLossPct: 20 },
      environmentalAssumptions: {
        diesel: factor(2.5, "kgco2e_per_litre", "kg CO2e/litre"),
        gridElectricity: factor(0.4, "kgco2e_per_kwh", "kg CO2e/kWh"),
        biofuel: factor(1.2, "kgco2e_per_litre", "kg CO2e/litre"),
      },
    }),
  );
  const e = r.environmental;

  it("annual emissions of each technology", () => {
    expect(e.diesel.annualEmissionsKg).toBeCloseTo(2_500, 9);
    expect(e.bev.annualEmissionsKg).toBeCloseTo(5_000, 9);
    expect(e.biofuel.annualEmissionsKg).toBeCloseTo(1_500, 9);
    expect(e.bev.physicalUse.annualQuantity).toBeCloseTo(12_500, 9); // grid kWh including the 20% loss
  });
  it("kg CO2e per km and horizon emissions", () => {
    expect(e.diesel.emissionsPerKmKg).toBeCloseTo(0.25, 12);
    expect(e.bev.emissionsPerKmKg).toBeCloseTo(0.5, 12);
    expect(e.biofuel.emissionsPerKmKg).toBeCloseTo(0.15, 12);
    expect(e.diesel.horizonEmissionsKg).toBeCloseTo(12_500, 9);
    expect(e.bev.horizonEmissionsKg).toBeCloseTo(25_000, 9);
  });
  it("tonnes are kilograms divided by 1,000", () => {
    expect(e.diesel.annualEmissionsTonnes).toBeCloseTo(2.5, 12);
    expect(e.bev.horizonEmissionsTonnes).toBeCloseTo(25, 12);
  });
  it("difference and percentage change versus diesel, with their sign convention", () => {
    expect(e.bevVsDiesel.absoluteDifferenceAnnualKg).toBeCloseTo(-2_500, 9); // diesel minus alternative: negative = more emissions
    expect(e.bevVsDiesel.percentageChange).toBeCloseTo(-100, 9);
    expect(e.bevVsDiesel.direction).toBe("higher");
    expect(e.bevVsDiesel.label).toBe("Emissions increase");
    expect(e.biofuelVsDiesel.absoluteDifferenceAnnualKg).toBeCloseTo(1_000, 9);
    expect(e.biofuelVsDiesel.percentageChange).toBeCloseTo(40, 9);
    expect(e.biofuelVsDiesel.direction).toBe("lower");
    expect(e.biofuelVsDiesel.label).toBe("Emissions reduction");
    expect(e.biofuelVsDiesel.absoluteDifferenceHorizonTonnes).toBeCloseTo(5, 12);
  });
  it("uses physical quantity, never price: changing every price leaves emissions untouched", () => {
    const dear = run(makeInput({ bev: { chargingLossPct: 20, electricityTariffPerKwh: 99 }, diesel: { fuelPricePerLitre: 77 }, biofuel: { fuelPricePerFuelUnit: 55 }, environmentalAssumptions: { diesel: factor(2.5, "kgco2e_per_litre", "kg CO2e/litre"), gridElectricity: factor(0.4, "kgco2e_per_kwh", "kg CO2e/kWh"), biofuel: factor(1.2, "kgco2e_per_litre", "kg CO2e/litre") } }));
    expect(dear.environmental.diesel.annualEmissionsKg).toBe(e.diesel.annualEmissionsKg);
    expect(dear.environmental.bev.annualEmissionsKg).toBe(e.bev.annualEmissionsKg);
  });
  it("the charging loss raises BEV emissions (grid energy), as it raises cost", () => {
    const noLoss = run(makeInput({ bev: { chargingLossPct: 0 }, environmentalAssumptions: { diesel: factor(2.5, "kgco2e_per_litre", "kg CO2e/litre"), gridElectricity: factor(0.4, "kgco2e_per_kwh", "kg CO2e/kWh"), biofuel: factor(1.2, "kgco2e_per_litre", "kg CO2e/litre") } }));
    expect(noLoss.environmental.bev.annualEmissionsKg).toBeCloseTo(4_000, 9); // 10,000 x 0.4
  });
  it("the scope statement says operational energy/fuel-related emissions, not lifecycle", () => {
    expect(JSON.stringify(e)).toMatch(/operational energy\/fuel-related/i);
    expect(JSON.stringify(e)).toMatch(/not a life-cycle assessment/i);
  });
});

describe("Environmental unit handling", () => {
  const dieselOnly = (unitId: string, unit: string, value = 2.5) =>
    run(makeInput({ environmentalAssumptions: { diesel: factor(value, unitId, unit), gridElectricity: factor(0.4, "kgco2e_per_kwh", "kg CO2e/kWh"), biofuel: factor(1.2, "kgco2e_per_litre", "kg CO2e/litre") } })).environmental;

  it("grams are converted to kilograms (2,500 g/litre = 2.5 kg/litre)", () => {
    expect(dieselOnly("gco2e_per_litre", "g CO2e/litre", 2_500).diesel.annualEmissionsKg).toBeCloseTo(2_500, 9);
    expect(dieselOnly("gco2e_per_litre", "g CO2e/litre", 2_500).diesel.factor?.kgPerUnit).toBeCloseTo(2.5, 12);
  });
  it("kWh factors in grams convert too (400 g/kWh = 0.4 kg/kWh)", () => {
    const r = run(makeInput({ bev: { chargingLossPct: 0 }, environmentalAssumptions: { diesel: factor(2.5, "kgco2e_per_litre", "kg CO2e/litre"), gridElectricity: factor(400, "gco2e_per_kwh", "g CO2e/kWh"), biofuel: factor(1.2, "kgco2e_per_litre", "kg CO2e/litre") } }));
    expect(r.environmental.bev.annualEmissionsKg).toBeCloseTo(4_000, 9);
  });
  it("kg-based biofuel: quantity in kg x kg-factor", () => {
    const r = run(makeInput({ biofuel: { fuelUnit: "kg", fuelConsumptionFuelUnitsPer100Km: 12.5 }, environmentalAssumptions: { diesel: factor(2.5, "kgco2e_per_litre", "kg CO2e/litre"), gridElectricity: factor(0.4, "kgco2e_per_kwh", "kg CO2e/kWh"), biofuel: factor(1.5, "kgco2e_per_kg", "kg CO2e/kg") } }));
    expect(r.environmental.biofuel.physicalUse.unit).toBe("kg");
    expect(r.environmental.biofuel.annualEmissionsKg).toBeCloseTo(1_250 * 1.5, 9);
  });
  it("m3-based biofuel: quantity in m3 x m3-factor", () => {
    const r = run(makeInput({ biofuel: { fuelUnit: "m3", fuelConsumptionFuelUnitsPer100Km: 0.5 }, environmentalAssumptions: { diesel: factor(2.5, "kgco2e_per_litre", "kg CO2e/litre"), gridElectricity: factor(0.4, "kgco2e_per_kwh", "kg CO2e/kWh"), biofuel: factor(2, "kgco2e_per_m3", "kg CO2e/m3") } }));
    expect(r.environmental.biofuel.physicalUse.unit).toBe("m3");
    expect(r.environmental.biofuel.annualEmissionsKg).toBeCloseTo(50 * 2, 9); // 10,000 km x 0.005 m3/km = 50 m3
  });
  it("a CO2-only factor is accepted but flagged: other gases are not included", () => {
    const r = dieselOnly("kgco2_per_litre", "kg CO2/litre");
    expect(r.diesel.status).toBe("calculated");
    expect(r.diesel.warnings.some((w) => w.code === "EMISSION_FACTOR_CO2_ONLY")).toBe(true);
  });
});

describe("Environmental missingness: a missing or unusable factor is never zero", () => {
  const diesel = (f: ReturnType<typeof factor>) => run(makeInput({ environmentalAssumptions: { diesel: f, gridElectricity: factor(0.4, "kgco2e_per_kwh", "kg CO2e/kWh"), biofuel: factor(1.2, "kgco2e_per_litre", "kg CO2e/litre") } })).environmental;

  it("a missing factor: unavailable, every number null", () => {
    const e = diesel(factor(null, "kgco2e_per_litre", "kg CO2e/litre", null, null));
    expect(e.diesel.status).toBe("unavailable");
    expect(e.diesel.annualEmissionsKg).toBeNull();
    expect(e.diesel.horizonEmissionsKg).toBeNull();
    expect(e.diesel.emissionsPerKmKg).toBeNull();
    expect(e.bevVsDiesel.status).toBe("unavailable");
    expect(e.bevVsDiesel.percentageChange).toBeNull();
    expect(e.bevVsDiesel.absoluteDifferenceAnnualKg).toBeNull();
    expect(e.biofuelVsDiesel.status).toBe("unavailable");
  });
  it("an incompatible unit (electricity factor given for diesel): unavailable, not converted, not zero", () => {
    const e = diesel(factor(2.5, "kgco2e_per_kwh", "kg CO2e/kWh"));
    expect(e.diesel.status).toBe("unavailable");
    expect(e.diesel.annualEmissionsKg).toBeNull();
    expect(e.diesel.warnings.some((w) => w.code === "EMISSION_FACTOR_UNIT_INCOMPATIBLE")).toBe(true);
  });
  it("an unrecognised unit: unavailable", () => {
    const e = diesel(factor(2.5, "tonnes_per_barrel", "t/barrel"));
    expect(e.diesel.status).toBe("unavailable");
    expect(e.diesel.warnings.some((w) => w.code === "EMISSION_FACTOR_UNIT_UNKNOWN")).toBe(true);
  });
  it("a negative or non-finite factor: unavailable", () => {
    expect(diesel(factor(-1, "kgco2e_per_litre", "kg CO2e/litre")).diesel.status).toBe("unavailable");
    expect(diesel(factor(Number.NaN, "kgco2e_per_litre", "kg CO2e/litre")).diesel.status).toBe("unavailable");
    expect(diesel(factor(Number.POSITIVE_INFINITY, "kgco2e_per_litre", "kg CO2e/litre")).diesel.status).toBe("unavailable");
  });
  it("an entered zero factor is a real zero, kept distinct from a missing factor", () => {
    const e = diesel(factor(0, "kgco2e_per_litre", "kg CO2e/litre"));
    expect(e.diesel.status).toBe("calculated");
    expect(e.diesel.annualEmissionsKg).toBe(0);
    expect(e.bevVsDiesel.percentageChange).toBeNull(); // diesel baseline of zero: percentage undefined, not Infinity
    expect(JSON.stringify(e)).not.toMatch(/Infinity|NaN/);
  });
  it("an unstated scope is 'not stated', never lifecycle", () => {
    const e = diesel(factor(2.5, "kgco2e_per_litre", "kg CO2e/litre", null));
    expect(e.diesel.factor?.scope).toBe("not_stated");
    expect(e.diesel.scopeLabel).toMatch(/not stated/i);
    expect(e.diesel.scopeLabel).not.toMatch(/life.?cycle/i);
  });
  it("a factor without a source is flagged for provenance, not rejected", () => {
    const e = diesel(factor(2.5, "kgco2e_per_litre", "kg CO2e/litre", "direct", null));
    expect(e.diesel.status).toBe("calculated");
    expect(e.diesel.factor?.hasProvenance).toBe(false);
    expect(e.diesel.warnings.some((w) => w.code === "EMISSION_FACTOR_NO_PROVENANCE")).toBe(true);
  });
  it("a lifecycle adjustment is recorded but not applied", () => {
    const e = run(makeInput({ environmentalAssumptions: { diesel: { ...factor(2.5, "kgco2e_per_litre", "kg CO2e/litre"), lifecycleAdjustmentPct: 25 }, gridElectricity: factor(0.4, "kgco2e_per_kwh", "kg CO2e/kWh"), biofuel: factor(1.2, "kgco2e_per_litre", "kg CO2e/litre") } })).environmental;
    expect(e.diesel.annualEmissionsKg).toBeCloseTo(2_500, 9);
    expect(e.diesel.factor?.lifecycleAdjustmentApplied).toBe(false);
  });
  it("missing environmental data does not alter the commercial classification", () => {
    const none = run(makeInput({}));
    const all = run(makeInput({ environmentalAssumptions: { diesel: factor(2.5, "kgco2e_per_litre", "kg CO2e/litre"), gridElectricity: factor(0.4, "kgco2e_per_kwh", "kg CO2e/kWh"), biofuel: factor(1.2, "kgco2e_per_litre", "kg CO2e/litre") } }));
    expect(none.commercial.bev.classification).toBe(all.commercial.bev.classification);
    expect(none.commercial.biofuel.classification).toBe(all.commercial.biofuel.classification);
    expect(none.dataCompleteness.environmental.state).not.toBe(all.dataCompleteness.environmental.state);
  });
});

describe("BEV operational boundaries: exact equality semantics (no hidden safety buffer)", () => {
  const bev = (patch: Parameters<typeof makeInput>[0]) => evaluateOperationalFeasibility(makeInput(patch)).bev;
  const R = 500;

  it("daily distance below the range is satisfied", () => {
    const o = bev({ operations: { dailyDistanceKm: 499 }, bev: { usableRangeKm: R } });
    expect(o.checks.range.status).toBe("satisfied");
    expect(o.rangeMetrics?.rangeMarginKm).toBe(1);
  });
  it("daily distance exactly equal to the range is satisfied, with a margin of exactly 0 (no buffer)", () => {
    const o = bev({ operations: { dailyDistanceKm: 500 }, bev: { usableRangeKm: R } });
    expect(o.checks.range.status).toBe("satisfied");
    expect(o.rangeMetrics?.rangeMarginKm).toBe(0);
    expect(o.rangeMetrics?.dailyExceedsRange).toBe(false);
    expect(o.status).toBe("suitable");
  });
  it("daily distance just above the range is no longer satisfied", () => {
    const o = bev({ operations: { dailyDistanceKm: 500.0001 }, bev: { usableRangeKm: R, operational: { chargingOpportunity: "depot_only" } } });
    expect(o.checks.range.status).toBe("constrained");
    expect(o.rangeMetrics?.dailyExceedsRange).toBe(true);
  });
  it("above the range: depot-only with no route detail is constrained", () => {
    expect(bev({ operations: { dailyDistanceKm: 501 }, bev: { usableRangeKm: R, operational: { chargingOpportunity: "depot_only" } } }).status).toBe("constrained");
  });
  it("above the range: depot-only where each route fits the range is conditional (recharge between routes)", () => {
    const o = bev({ operations: { dailyDistanceKm: 501, averageRouteDistanceKm: 250 }, bev: { usableRangeKm: R, operational: { chargingOpportunity: "depot_only" } } });
    expect(o.checks.range.status).toBe("conditional");
    expect(o.status).toBe("conditional");
  });
  it("above the range: daytime charging available is conditional; unknown or unstated is insufficient data", () => {
    for (const opp of ["public_available", "destination_available", "mixed"] as const) {
      expect(bev({ operations: { dailyDistanceKm: 501 }, bev: { usableRangeKm: R, operational: { chargingOpportunity: opp } } }).status).toBe("conditional");
    }
    for (const opp of ["unknown", null] as const) {
      expect(bev({ operations: { dailyDistanceKm: 501 }, bev: { usableRangeKm: R, operational: { chargingOpportunity: opp } } }).status).toBe("insufficient_data");
    }
  });
  it("route distance below / equal to / above the range", () => {
    const route = (km: number, opp: "depot_only" | "public_available" | "unknown" | null = "depot_only") =>
      bev({ operations: { dailyDistanceKm: 100, averageRouteDistanceKm: km }, bev: { usableRangeKm: R, operational: { chargingOpportunity: opp } } });
    expect(route(499).checks.route.status).toBe("satisfied");
    expect(route(500).checks.route.status).toBe("satisfied"); // equal is within range
    expect(route(500.5).checks.route.status).toBe("constrained"); // depot-only
    expect(route(500.5, "public_available").checks.route.status).toBe("conditional");
    expect(route(500.5, "unknown").checks.route.status).toBe("insufficient");
    expect(route(500.5, "unknown").status).toBe("insufficient_data");
  });
  it("no route entered: the route check is 'not assessed' and does not lower the status", () => {
    const o = bev({ operations: { dailyDistanceKm: 100, averageRouteDistanceKm: null }, bev: { usableRangeKm: R } });
    expect(o.checks.route.status).toBe("not_assessed");
    expect(o.status).toBe("suitable");
    expect(o.notAssessed).toContain("Single-route range");
  });
  it("payload below / equal to / above the effective capacity", () => {
    // capacity 1,000 kg, reduction 400 kg -> effective 600 kg
    const pay = (avg: number) => bev({ fleet: { payloadCapacityKg: 1_000, averagePayloadKg: avg }, bev: { operational: { payloadImpact: "reduced", payloadReductionKg: 400 } } });
    expect(pay(599).checks.payload.status).toBe("satisfied");
    expect(pay(600).checks.payload.status).toBe("satisfied"); // exactly at capacity
    expect(pay(600.5).checks.payload.status).toBe("constrained");
    expect(pay(600).payload.effectiveCapacityKg).toBe(600);
    // a percentage reduction gives the same boundary: 40% of 1,000
    const pct = (avg: number) => bev({ fleet: { payloadCapacityKg: 1_000, averagePayloadKg: avg }, bev: { operational: { payloadImpact: "reduced", payloadReductionKg: null, payloadReductionPct: 40 } } });
    expect(pct(600).checks.payload.status).toBe("satisfied");
    expect(pct(601).checks.payload.status).toBe("constrained");
  });
  it("payload impact unknown or unstated", () => {
    expect(bev({ bev: { operational: { payloadImpact: "unknown" } } }).checks.payload.status).toBe("insufficient");
    expect(bev({ bev: { operational: { payloadImpact: null } } }).checks.payload.status).toBe("not_assessed");
    expect(bev({ bev: { operational: { payloadImpact: "none" } }, fleet: { payloadCapacityKg: 1_000, averagePayloadKg: 5_000 } }).checks.payload.status).toBe("satisfied");
  });
  it("charging arrangements: contradiction is a condition, unknown is insufficient, consistent is satisfied", () => {
    const ch = (opp: "depot_only" | "unknown" | null, arr: "public_only" | "dedicated_private" | "unknown" | null) =>
      bev({ bev: { operational: { chargingOpportunity: opp } }, infrastructure: { bevCharging: { arrangement: arr } } }).checks.charging.status;
    expect(ch("depot_only", "public_only")).toBe("conditional");
    expect(ch("unknown", "dedicated_private")).toBe("insufficient");
    expect(ch("depot_only", "dedicated_private")).toBe("satisfied");
    expect(ch(null, null)).toBe("not_assessed");
  });
  it("the charging-time indicator is shown as entered and never priced", () => {
    const o = bev({ bev: { operational: { chargingDowntimeHoursPerDay: 2 } }, operations: { operatingDaysPerYear: 100 }, fleet: { fleetSize: 3 } });
    expect(o.chargingTime.perVehicleAnnualHours).toBe(200);
    expect(o.chargingTime.fleetAnnualHours).toBe(600);
    const priced = run(makeInput({ bev: { operational: { chargingDowntimeHoursPerDay: 9 } } }));
    const plain = run(makeInput({}));
    expect(priced.bev).toEqual(plain.bev);
  });
  it("a missing or invalid range / distance is insufficient data, not a pass", () => {
    expect(bev({ bev: { usableRangeKm: 0 } }).checks.range.status).toBe("insufficient");
    expect(bev({ operations: { dailyDistanceKm: 0 } }).checks.range.status).toBe("insufficient");
  });
  it("source scan: the range rule uses the stated range directly (no multiplier or buffer constant)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../calculation/operational/bev.ts", import.meta.url), "utf8");
    expect(src).toMatch(/const margin = range - daily/);
    expect(src).toMatch(/daily <= range/);
    expect(src).not.toMatch(/range\s*\*\s*0\.\d|range\s*\*\s*\(1\s*-|safety.?(buffer|margin|factor)\s*=|BUFFER\s*=/i);
  });
});

describe("Biofuel operational benchmarks (categorical, never numeric thresholds)", () => {
  const bio = (patch: Parameters<typeof makeInput>[0]) => evaluateOperationalFeasibility(makeInput(patch)).biofuel;
  const supply = (availability: "reliable" | "intermittent" | "limited" | "unknown" | null, extra: Record<string, unknown> = {}) => ({
    biofuel: { supply: { availability, additionalRefuellingKmPerDay: null, downtimeHoursPerMonth: null, specialInfrastructure: "no" as const, ...extra } },
  });

  it("availability: reliable satisfied, intermittent conditional, limited conditional, unknown insufficient, unstated not assessed", () => {
    expect(bio(supply("reliable")).status).toBe("suitable");
    expect(bio(supply("intermittent")).status).toBe("conditional");
    expect(bio(supply("limited")).status).toBe("conditional");
    expect(bio(supply("unknown")).status).toBe("insufficient_data");
    expect(bio(supply(null)).status).toBe("insufficient_data"); // supply must be assessed
  });
  it("infrastructure: no is satisfied; unknown is insufficient; yes+specified satisfied; yes+unspecified conditional", () => {
    const yesSpecified = { infrastructure: { biofuel: { investmentRequired: "yes" as const, storageEquipmentCost: 1, refuellingInfrastructureCost: 1, installationCost: 1, annualMaintenanceCost: 1, usefulLifeYears: 10 } } };
    const yesUnspecified = { infrastructure: { biofuel: { investmentRequired: "yes" as const, storageEquipmentCost: null, refuellingInfrastructureCost: null, installationCost: null, annualMaintenanceCost: null, usefulLifeYears: null } } };
    expect(bio({ ...supply("reliable"), infrastructure: { biofuel: { investmentRequired: "no" } } }).checks.infrastructure.status).toBe("satisfied");
    expect(bio({ ...supply("reliable"), infrastructure: { biofuel: { investmentRequired: "unknown" } } }).checks.infrastructure.status).toBe("insufficient");
    expect(bio({ ...supply("reliable"), ...yesSpecified }).checks.infrastructure.status).toBe("satisfied");
    expect(bio({ ...supply("reliable"), ...yesUnspecified }).checks.infrastructure.status).toBe("conditional");
  });
  it("limited supply plus unresolved infrastructure is the only constrained combination", () => {
    const o = bio({
      ...supply("limited", { specialInfrastructure: "yes" }),
      infrastructure: { biofuel: { investmentRequired: "yes", storageEquipmentCost: null, refuellingInfrastructureCost: null, installationCost: null, annualMaintenanceCost: null, usefulLifeYears: null } },
    });
    expect(o.status).toBe("constrained");
    expect(bio({ ...supply("intermittent", { specialInfrastructure: "yes" }), infrastructure: { biofuel: { investmentRequired: "yes", storageEquipmentCost: null, refuellingInfrastructureCost: null, installationCost: null, annualMaintenanceCost: null, usefulLifeYears: null } } }).status).toBe("conditional");
  });
  it("categorical availability never becomes a number: no observed/reference values on the supply check", () => {
    for (const a of ["reliable", "intermittent", "limited", "unknown"] as const) {
      const c = bio(supply(a)).checks.supply;
      expect(c.observed).toBeNull();
      expect(c.reference).toBeNull();
    }
    expect(JSON.stringify(bio(supply("limited")).checks.supply)).not.toMatch(/\d+\s?%/);
  });
  it("refuelling burden and downtime are shown as entered, annualised only where defined, and never priced", () => {
    const o = bio(supply("reliable", { additionalRefuellingKmPerDay: 12, downtimeHoursPerMonth: 5 }));
    expect(o.refuelling.additionalDistanceKmPerVehiclePerDay).toBe(12);
    expect(o.refuelling.annualAdditionalDistanceKm).toBeNull(); // frequency unknown: not invented
    expect(o.downtime.hoursPerMonthAsEntered).toBe(5);
    expect(o.downtime.annualHours).toBe(60);
    const burdened = run(makeInput(supply("reliable", { additionalRefuellingKmPerDay: 99, downtimeHoursPerMonth: 99 })));
    const plain = run(makeInput({}));
    expect(burdened.biofuel).toEqual(plain.biofuel);
    expect(burdened.biofuelVsDiesel).toEqual(plain.biofuelVsDiesel);
  });
  it("availability does not change the economics (it is disclosed, not priced)", () => {
    expect(run(makeInput(supply("limited"))).biofuelVsDiesel.npv).toBe(run(makeInput(supply("reliable"))).biofuelVsDiesel.npv);
  });
});
