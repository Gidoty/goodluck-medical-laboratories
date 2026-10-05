import { describe, expect, it } from "vitest";
import { calculateAssessment } from "../engine";
import { deepFreeze, makeInput } from "../fixtures";
import { calculateEnvironmentalPerformance, parseFactorUnit } from "./index";

/**
 * Base fixture: 1 vehicle, 10,000 km/year, 5 years.
 *   diesel 10 L/100 km -> 1,000 litres/yr;  BEV 100 kWh/100 km -> 10,000 kWh/yr;  biofuel 12.5 L/100 km -> 1,250 litres/yr.
 * Factors below are ABSTRACT test numbers, not real emission factors.
 */
type Patch = Parameters<typeof makeInput>[0];
const factor = (value: number | null, unit: string, unitId: string, extra: Record<string, unknown> = {}) => ({ value, unit, unitId, scope: null, source: "Test source", sourceYear: 2020, notes: null, lifecycleAdjustmentPct: null, ...extra });
const DIESEL = factor(2, "kg CO2e/litre", "kgco2e_per_litre");
const GRID = factor(0.1, "kg CO2e/kWh", "kgco2e_per_kwh");
const BIO = factor(1.2, "kg CO2e/litre", "kgco2e_per_litre");
const withFactors = (diesel: object | null = DIESEL, grid: object | null = GRID, biofuel: object | null = BIO, rest: Patch = {}): Patch => ({
  ...rest,
  environmentalAssumptions: { ...(diesel ? { diesel } : {}), ...(grid ? { gridElectricity: grid } : {}), ...(biofuel ? { biofuel } : {}) },
});
const env = (patch: Patch = withFactors()) => calculateEnvironmentalPerformance(makeInput(patch));
const codes = (r: ReturnType<typeof env>) => r.warnings.map((w) => w.code);

describe("operational emissions: physical use x factor", () => {
  const r = env();
  it("diesel: litres x kg CO2e per litre", () => {
    expect(r.diesel.physicalUse).toMatchObject({ unit: "litre", annualQuantity: 1000 });
    expect(r.diesel.annualEmissionsKg).toBe(2000);
    expect(r.diesel.annualEmissionsTonnes).toBe(2);
  });
  it("BEV: grid kWh x kg CO2e per kWh", () => {
    expect(r.bev.physicalUse).toMatchObject({ unit: "kWh", annualQuantity: 10000 });
    expect(r.bev.annualEmissionsKg).toBeCloseTo(1000, 9);
  });
  it("charging losses raise the grid draw and therefore the emissions: grid = delivered / (1 - L)", () => {
    const lossy = env(withFactors(DIESEL, GRID, BIO, { bev: { chargingLossPct: 10 } }));
    expect(lossy.bev.physicalUse.annualQuantity).toBeCloseTo(10000 / 0.9, 9);
    expect(lossy.bev.annualEmissionsKg).toBeCloseTo((10000 / 0.9) * 0.1, 9);
    expect(lossy.bev.annualEmissionsKg).not.toBeCloseTo(1100, 0); // not delivered x 1.10
    expect(codes(lossy)).not.toContain("EMISSIONS_CHARGING_LOSS_NOT_MODELLED");
    expect(codes(r)).toContain("EMISSIONS_CHARGING_LOSS_NOT_MODELLED"); // no loss entered
  });
  it("biofuel: compatible quantity x factor, in litres, kg or m3", () => {
    expect(r.biofuel.annualEmissionsKg).toBeCloseTo(1500, 9);
    const kg = env(withFactors(DIESEL, GRID, factor(2, "kg CO2e/kg", "kgco2e_per_kg"), { biofuel: { fuelUnit: "kg", fuelConsumptionFuelUnitsPer100Km: 20 } }));
    expect(kg.biofuel.physicalUse).toMatchObject({ unit: "kg", annualQuantity: 2000 });
    expect(kg.biofuel.annualEmissionsKg).toBe(4000);
    const m3 = env(withFactors(DIESEL, GRID, factor(1.5, "kg CO2e/m³", "kgco2e_per_m3"), { biofuel: { fuelUnit: "m3", fuelConsumptionFuelUnitsPer100Km: 5 } }));
    expect(m3.biofuel.annualEmissionsKg).toBeCloseTo(10000 * 0.05 * 1.5, 9);
  });
  it("is the same factor-by-quantity rule for every year of the horizon", () => {
    expect(r.diesel.byYearKg).toEqual([0, 2000, 2000, 2000, 2000, 2000]);
  });
});

describe("unit compatibility", () => {
  it("rejects a biofuel factor whose unit does not match the fuel-consumption unit, with the exact message", () => {
    for (const bad of [factor(1, "kg CO2e/kWh", "kgco2e_per_kwh"), factor(1, "kg CO2e/kg", "kgco2e_per_kg"), factor(1, "kg CO2e/m³", "kgco2e_per_m3")]) {
      const r = env(withFactors(DIESEL, GRID, bad));
      expect(r.biofuel.status).toBe("unavailable");
      expect(r.biofuel.annualEmissionsKg).toBeNull();
      expect(r.biofuel.unavailableReason).toBe("Biofuel emission-factor unit is incompatible with the configured fuel-consumption unit.");
    }
    // a litre-based factor against a kg fuel is also incompatible
    const mismatch = env(withFactors(DIESEL, GRID, BIO, { biofuel: { fuelUnit: "kg" } }));
    expect(mismatch.biofuel.status).toBe("unavailable");
  });
  it("rejects a diesel factor that is not per litre and a grid factor that is not per kWh", () => {
    expect(env(withFactors(factor(2, "kg CO2e/kWh", "kgco2e_per_kwh"))).diesel.unavailableReason).toBe("Diesel emission-factor unit is incompatible with litres of diesel.");
    expect(env(withFactors(DIESEL, factor(0.1, "kg CO2e/litre", "kgco2e_per_litre"))).bev.unavailableReason).toBe("Grid emission-factor unit is incompatible with kWh of electricity.");
  });
  it("converts g CO2e factors explicitly (g -> kg) and keeps CO2e and CO2 distinct", () => {
    const g = env(withFactors(factor(2000, "g CO2e/litre", "gco2e_per_litre")));
    expect(g.diesel.annualEmissionsKg).toBeCloseTo(2000, 9);
    expect(g.diesel.factor).toMatchObject({ enteredValue: 2000, enteredUnit: "g CO2e/litre", kgPerUnit: 2, gas: "CO2e" });
    const co2 = env(withFactors(factor(2, "kg CO2/litre", "kgco2_per_litre")));
    expect(co2.diesel.factor?.gas).toBe("CO2");
    expect(codes(co2)).toContain("EMISSION_FACTOR_CO2_ONLY");
    expect(codes(g)).not.toContain("EMISSION_FACTOR_CO2_ONLY");
  });
  it("recognises units by id or by label, and refuses anything unknown", () => {
    expect(parseFactorUnit("kgco2e_per_kwh")?.perUnit).toBe("kWh");
    expect(parseFactorUnit(undefined, "kg CO2e/m³")?.perUnit).toBe("m3");
    expect(parseFactorUnit("tons_per_mile")).toBeNull();
    const unknown = env(withFactors(factor(2, "furlongs", "nonsense")));
    expect(unknown.diesel.status).toBe("unavailable");
    expect(codes(unknown)).toContain("EMISSION_FACTOR_UNIT_UNKNOWN");
  });
  it("rejects negative and non-numeric factors instead of calculating", () => {
    expect(env(withFactors(factor(-1, "kg CO2e/litre", "kgco2e_per_litre"))).diesel.status).toBe("unavailable");
    expect(env(withFactors({ ...DIESEL, value: "2" as unknown as number })).diesel.status).toBe("unavailable");
    expect(env(withFactors({ ...DIESEL, value: Number.NaN })).diesel.status).toBe("unavailable");
  });
});

describe("units of the result", () => {
  const r = env();
  it("kg to tonnes", () => {
    expect(r.diesel.horizonEmissionsKg).toBe(10000);
    expect(r.diesel.horizonEmissionsTonnes).toBe(10);
  });
  it("emissions per km use fleet annual distance", () => {
    expect(r.diesel.emissionsPerKmKg).toBeCloseTo(2000 / 10000, 12);
    expect(env(withFactors(DIESEL, GRID, BIO, { fleet: { fleetSize: 4 } })).diesel.emissionsPerKmKg).toBeCloseTo(0.2, 12); // intensity does not change with fleet size
  });
  it("horizon emissions are the sum of the yearly emissions", () => {
    const t = env(withFactors(DIESEL, GRID, BIO, { operations: { analysisHorizonYears: 8 } }));
    expect(t.diesel.horizonEmissionsKg).toBe(8 * 2000);
    expect(t.diesel.byYearKg).toHaveLength(9);
  });
  it("scales with fleet size", () => {
    expect(env(withFactors(DIESEL, GRID, BIO, { fleet: { fleetSize: 3 } })).bev.annualEmissionsKg).toBeCloseTo(3000, 9);
  });
});

describe("comparison with diesel", () => {
  it("reports an emissions reduction as (diesel - alternative) / diesel", () => {
    const c = env().bevVsDiesel;
    expect(c).toMatchObject({ status: "calculated", direction: "lower", label: "Emissions reduction" });
    expect(c.absoluteDifferenceAnnualKg).toBeCloseTo(1000, 9);
    expect(c.absoluteDifferenceAnnualTonnes).toBeCloseTo(1, 9);
    expect(c.absoluteDifferenceHorizonTonnes).toBeCloseTo(5, 9);
    expect(c.percentageChange).toBeCloseTo(50, 9);
    expect(env().biofuelVsDiesel.percentageChange).toBeCloseTo(25, 9);
  });
  it("calls a higher result an emissions INCREASE, never a reduction", () => {
    const c = env(withFactors(DIESEL, factor(0.3, "kg CO2e/kWh", "kgco2e_per_kwh"))).bevVsDiesel;
    expect(c.direction).toBe("higher");
    expect(c.label).toBe("Emissions increase");
    expect(c.percentageChange).toBeCloseTo(-50, 9);
    expect(c.absoluteDifferenceAnnualKg).toBeCloseTo(-1000, 9);
  });
  it("handles identical emissions", () => {
    const c = env(withFactors(factor(1, "kg CO2e/litre", "kgco2e_per_litre"), factor(0.1, "kg CO2e/kWh", "kgco2e_per_kwh"))).bevVsDiesel;
    expect(c.direction).toBe("unchanged");
    expect(c.percentageChange).toBeCloseTo(0, 9);
  });
  it("handles zero diesel emissions without dividing by zero", () => {
    const zero = factor(0, "kg CO2e/litre", "kgco2e_per_litre");
    const c = env(withFactors(zero)).bevVsDiesel;
    expect(c.percentageChange).toBeNull();
    expect(c.direction).toBe("higher");
    expect(c.label).toBe("Emissions increase");
    const both = env(withFactors(zero, factor(0, "kg CO2e/kWh", "kgco2e_per_kwh"))).bevVsDiesel;
    expect(both.percentageChange).toBeNull();
    expect(both.direction).toBe("unchanged");
  });
  it("does not claim a comparison when factors cover different things", () => {
    const r = env(withFactors({ ...DIESEL, scope: "direct" }, { ...GRID, scope: "lifecycle" }));
    expect(r.bevVsDiesel.sameStatedScope).toBe(false);
    expect(codes(r)).toContain("EMISSION_SCOPE_MISMATCH");
    const same = env(withFactors({ ...DIESEL, scope: "fuel_cycle" }, { ...GRID, scope: "fuel_cycle" }));
    expect(same.bevVsDiesel.sameStatedScope).toBe(true);
    expect(codes(same)).not.toContain("EMISSION_SCOPE_MISMATCH");
    expect(codes(env())).toContain("EMISSION_SCOPE_NOT_STATED");
  });
});

describe("missing data", () => {
  it("never turns a missing factor into zero", () => {
    const r = env(withFactors(DIESEL, { ...GRID, value: null }));
    expect(r.bev.status).toBe("unavailable");
    expect(r.bev.annualEmissionsKg).toBeNull();
    expect(r.bev.horizonEmissionsTonnes).toBeNull();
    expect(r.bev.emissionsPerKmKg).toBeNull();
    expect(r.bev.unavailableReason).toBe("Grid electricity emission factor was not supplied.");
    expect(r.bevVsDiesel.status).toBe("unavailable");
    expect(r.bevVsDiesel.percentageChange).toBeNull();
  });
  it("keeps calculable technologies available when another factor is missing", () => {
    const r = env(withFactors(DIESEL, { ...GRID, value: null }));
    expect(r.diesel.status).toBe("calculated");
    expect(r.biofuelVsDiesel.status).toBe("calculated");
    expect(r.dataCompleteness).toEqual({ state: "partial", calculated: ["diesel", "biofuel"], unavailable: ["bev"] });
  });
  it("makes every comparison unavailable when the diesel baseline has no factor", () => {
    const r = env(withFactors({ ...DIESEL, value: null }));
    expect(r.diesel.status).toBe("unavailable");
    expect(r.bevVsDiesel.status).toBe("unavailable");
    expect(r.biofuelVsDiesel.status).toBe("unavailable");
    expect(r.bev.status).toBe("calculated"); // the alternatives still have their own emissions
  });
  it("is unavailable overall when no factor is supplied, and says what is needed", () => {
    const r = env({});
    expect(r.dataCompleteness).toEqual({ state: "unavailable", calculated: [], unavailable: ["diesel", "bev", "biofuel"] });
    expect(codes(r)).toEqual(expect.arrayContaining(["EMISSION_FACTOR_MISSING", "ENVIRONMENTAL_COMPARISON_UNAVAILABLE"]));
    expect(r.warnings.find((w) => w.code === "ENVIRONMENTAL_COMPARISON_UNAVAILABLE")?.message).toMatch(/emission factors are required/);
    // physical use is still reported, because that is known without any factor
    expect(r.diesel.physicalUse.annualQuantity).toBe(1000);
  });
  it("is complete when every factor is usable", () => {
    expect(env().dataCompleteness.state).toBe("complete");
  });
});

describe("provenance", () => {
  it("keeps value, unit, source, year, notes and scope, and marks them as user-supplied", () => {
    const r = env(withFactors({ ...DIESEL, source: "Ministry report", sourceYear: 2022, notes: "Annual average", scope: "fuel_cycle" }));
    expect(r.diesel.factor).toMatchObject({ enteredValue: 2, enteredUnit: "kg CO2e/litre", source: "Ministry report", sourceYear: 2022, notes: "Annual average", origin: "user_supplied", hasProvenance: true, scope: "fuel_cycle" });
    expect(r.diesel.scopeLabel).toBe("Energy/fuel-cycle emissions");
  });
  it("warns, with the exact words, when a factor has no source; a year or note alone is not a source", () => {
    for (const noSource of [{ source: null }, { source: "   " }, { source: null, sourceYear: 2021, notes: "from memory" }]) {
      const r = env(withFactors({ ...DIESEL, ...noSource }));
      expect(r.diesel.factor?.hasProvenance).toBe(false);
      expect(r.warnings.find((w) => w.code === "EMISSION_FACTOR_NO_PROVENANCE" && w.scope === "diesel")?.message).toBe("Emission factor supplied without source provenance.");
    }
    expect(codes(env())).not.toContain("EMISSION_FACTOR_NO_PROVENANCE");
  });
  it("still calculates with an unsourced factor", () => {
    expect(env(withFactors({ ...DIESEL, source: null })).diesel.annualEmissionsKg).toBe(2000);
  });
  it("records a lifecycle adjustment but does not apply it", () => {
    const r = env(withFactors({ ...DIESEL, lifecycleAdjustmentPct: 25 }));
    expect(r.diesel.annualEmissionsKg).toBe(2000); // unchanged
    expect(r.diesel.factor).toMatchObject({ lifecycleAdjustmentPct: 25, lifecycleAdjustmentApplied: false });
    expect(codes(r)).toContain("LIFECYCLE_ADJUSTMENT_NOT_APPLIED");
    expect(r.assumptions.find((a) => a.id === "env_lifecycle_adjustment")?.status).toBe("excluded");
  });
  it("labels the scope as operational, not lifecycle", () => {
    const r = env();
    expect(r.scopeStatement).toMatch(/operational energy\/fuel-related/);
    expect(r.scopeStatement).toMatch(/not a life-cycle assessment/);
    expect(r.diesel.scopeLabel).toBe("Scope of the factor not stated");
  });
});

describe("what does and does not change emissions", () => {
  const base = env();
  it("fuel-price escalation does not change physical emissions", () => {
    expect(env(withFactors(DIESEL, GRID, BIO, { diesel: { fuelPriceEscalationPctPerYear: 40 }, biofuel: { fuelPriceEscalationPctPerYear: 40 } }))).toEqual(base);
  });
  it("electricity-price escalation does not change physical emissions", () => {
    expect(env(withFactors(DIESEL, GRID, BIO, { bev: { electricityPriceEscalationPctPerYear: 60 } }))).toEqual(base);
  });
  it("prices, discount rate and vehicle cost do not matter", () => {
    expect(env(withFactors(DIESEL, GRID, BIO, { diesel: { fuelPricePerLitre: 9999, upfrontVehicleCost: 5 }, finance: { discountRatePct: 40 }, bev: { electricityTariffPerKwh: 77 } }))).toEqual(base);
  });
  it("holds the factor constant across the horizon", () => {
    const r = env(withFactors(DIESEL, GRID, BIO, { operations: { analysisHorizonYears: 12 } }));
    expect(new Set(r.bev.byYearKg!.slice(1)).size).toBe(1);
    expect(new Set(r.diesel.byYearKg!.slice(1)).size).toBe(1);
    expect(r.assumptions.find((a) => a.id === "env_factor_constant")?.status).toBe("convention");
  });
  it("adds no manufacturing or replacement emissions: replacing vehicles leaves the total unchanged", () => {
    const replaced = env(withFactors(DIESEL, GRID, BIO, { operations: { analysisHorizonYears: 12 }, diesel: { usefulLifeYears: 2 }, bev: { usefulLifeYears: 2, batteryReplacement: { expected: "yes", year: 1, cost: 1000 } } }));
    expect(replaced.diesel.horizonEmissionsKg).toBe(12 * 2000);
    expect(replaced.bev.horizonEmissionsKg).toBeCloseTo(12 * 1000, 9);
    expect(replaced.assumptions.find((a) => a.id === "env_embodied")?.status).toBe("excluded");
    expect(replaced.notes.join(" ")).toMatch(/embodied emissions are outside the current operational-emissions scope/);
  });
  it("does not monetise emissions", () => {
    expect(JSON.stringify(base)).not.toMatch(/carbonPrice|socialCost|creditRevenue/);
    expect(base.notes.join(" ")).toMatch(/not converted into money/);
  });
});

describe("robustness", () => {
  it("does not mutate its input", () => {
    const input = deepFreeze(makeInput(withFactors()));
    const before = JSON.stringify(input);
    expect(() => calculateEnvironmentalPerformance(input)).not.toThrow();
    expect(JSON.stringify(input)).toBe(before);
  });
  it("never returns NaN or Infinity", () => {
    const bad: string[] = [];
    const walk = (v: unknown, p: string) => {
      if (typeof v === "number" && !Number.isFinite(v)) bad.push(p);
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, `${p}.${k}`);
    };
    walk(env(), "r");
    walk(env({}), "r");
    walk(calculateEnvironmentalPerformance({} as never), "r");
    expect(bad).toEqual([]);
  });
  it("copes with malformed input without throwing", () => {
    const r = calculateEnvironmentalPerformance({ operations: {}, fleet: {}, diesel: {}, bev: {}, biofuel: {} } as never);
    expect(r.dataCompleteness.state).toBe("unavailable");
    expect(codes(r)).toContain("ENVIRONMENTAL_INPUT_INVALID");
  });
  it("uses the same physical quantities as the financial engine", () => {
    const input = makeInput(withFactors(DIESEL, GRID, BIO, { bev: { chargingLossPct: 12 }, fleet: { fleetSize: 3 } }));
    const fin = calculateAssessment(input);
    if (!fin.ok) throw new Error("financial engine failed");
    const e = calculateEnvironmentalPerformance(input);
    expect(e.diesel.physicalUse.annualQuantity).toBeCloseTo(fin.result.diesel.energy.fleetQuantityYear1, 9);
    expect(e.bev.physicalUse.annualQuantity).toBeCloseTo(fin.result.bev.energy.fleetQuantityYear1, 9);
    expect(e.biofuel.physicalUse.annualQuantity).toBeCloseTo(fin.result.biofuel.energy.fleetQuantityYear1, 9);
  });
});
