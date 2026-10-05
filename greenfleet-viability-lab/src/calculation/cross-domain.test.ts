import { describe, expect, it } from "vitest";
import { calculateAssessment } from "./engine";
import { makeInput } from "./fixtures";
import type { AssessmentCalculationResult } from "./types";

type Patch = Parameters<typeof makeInput>[0];
const factor = (value: number | null, unit: string, unitId: string) => ({ value, unit, unitId, scope: null, source: "Test source", sourceYear: 2020, notes: null, lifecycleAdjustmentPct: null });
const FACTORS: Patch = {
  environmentalAssumptions: {
    diesel: factor(2, "kg CO2e/litre", "kgco2e_per_litre"),
    gridElectricity: factor(0.1, "kg CO2e/kWh", "kgco2e_per_kwh"),
    biofuel: factor(1.2, "kg CO2e/litre", "kgco2e_per_litre"),
  },
};
function run(patch: Patch = {}): AssessmentCalculationResult {
  const o = calculateAssessment(makeInput(patch));
  if (!o.ok) throw new Error(o.errors.map((e) => e.message).join("; "));
  return o.result;
}
const merge = (...p: Patch[]): Patch => Object.assign({}, ...p) as Patch;

describe("A. positive NPV and a constrained BEV stay separate", () => {
  const r = run(merge(FACTORS, { operations: { dailyDistanceKm: 600 }, bev: { operational: { chargingOpportunity: "depot_only" } } } as Patch));
  it("economics are favourable, operations are constrained, emissions are lower", () => {
    expect(r.dimensions.bev.economic.direction).toBe("advantage");
    expect(r.dimensions.bev.operational.status).toBe("constrained");
    expect(r.dimensions.bev.environmental.state).toBe("lower");
    expect(r.bevVsDiesel.npv).toBeGreaterThan(0);
  });
});

describe("B. negative NPV and a suitable BEV", () => {
  const r = run(merge(FACTORS, { bev: { upfrontVehicleCost: 20000 } } as Patch));
  it("operations stay suitable", () => {
    expect(r.dimensions.bev.economic.direction).toBe("disadvantage");
    expect(r.dimensions.bev.operational.status).toBe("suitable");
  });
});

describe("C. lower emissions with a negative NPV", () => {
  const r = run(merge(FACTORS, { bev: { upfrontVehicleCost: 20000 } } as Patch));
  it("is reported as both, with no viability wording", () => {
    expect(r.dimensions.bev.environmental.state).toBe("lower");
    expect(r.dimensions.bev.economic.direction).toBe("disadvantage");
    expect(JSON.stringify(r)).not.toMatch(/NOT YET VIABLE|CONDITIONALLY VIABLE|"VIABLE"/i);
  });
});

describe("D. positive NPV with emissions unavailable", () => {
  const r = run();
  it("shows the environmental result as unavailable, never zero", () => {
    expect(r.dimensions.bev.economic.direction).toBe("advantage");
    expect(r.dimensions.bev.environmental.state).toBe("unavailable");
    expect(r.dimensions.bev.environmental.percentChange).toBeNull();
    expect(r.environmental.diesel.annualEmissionsKg).toBeNull();
    expect(r.dataCompleteness.environmental.state).toBe("unavailable");
  });
});

describe("E. cheap biofuel with limited supply and unspecified infrastructure", () => {
  const r = run({ biofuel: { fuelPricePerFuelUnit: 0.5, supply: { availability: "limited" } }, infrastructure: { biofuel: { investmentRequired: "yes", storageEquipmentCost: 100, refuellingInfrastructureCost: 100, installationCost: 100 } } } as Patch);
  it("economic advantage does not remove the supply constraint", () => {
    expect(r.biofuelVsDiesel.npv).toBeGreaterThan(0);
    expect(r.dimensions.biofuel.operational.status).toBe("constrained");
  });
});

describe("F. independence of the layers", () => {
  it("changing a price changes economics only", () => {
    const a = run(FACTORS);
    const b = run(merge(FACTORS, { diesel: { fuelPricePerLitre: 3 } } as Patch));
    expect(b.diesel.undiscountedTco).not.toBe(a.diesel.undiscountedTco);
    expect(b.environmental).toEqual(a.environmental);
    expect(b.operational).toEqual(a.operational);
  });
  it("changing an emission factor changes emissions only", () => {
    const a = run(FACTORS);
    const b = run({ environmentalAssumptions: { ...FACTORS.environmentalAssumptions!, diesel: factor(5, "kg CO2e/litre", "kgco2e_per_litre") } } as Patch);
    expect(b.diesel.undiscountedTco).toBe(a.diesel.undiscountedTco);
    expect(b.bevVsDiesel.npv).toBe(a.bevVsDiesel.npv);
    expect(b.operational).toEqual(a.operational);
    expect(b.environmental.diesel.annualEmissionsKg).not.toBe(a.environmental.diesel.annualEmissionsKg);
  });
  it("changing a BEV range changes operations only", () => {
    const a = run(FACTORS);
    const b = run(merge(FACTORS, { bev: { usableRangeKm: 50 } } as Patch));
    expect(b.diesel.undiscountedTco).toBe(a.diesel.undiscountedTco);
    expect(b.bevVsDiesel.npv).toBe(a.bevVsDiesel.npv);
    expect(b.environmental).toEqual(a.environmental);
    expect(b.operational.bev.status).not.toBe(a.operational.bev.status);
  });
});
