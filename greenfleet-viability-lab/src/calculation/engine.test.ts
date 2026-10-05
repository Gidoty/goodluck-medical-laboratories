import { describe, expect, it } from "vitest";
import { calculateAssessment } from "./engine";
import { deepFreeze, makeInput } from "./fixtures";
import type { AssessmentCalculationResult } from "./types";
import { COST_CATEGORIES } from "./types";

function run(patch: Parameters<typeof makeInput>[0] = {}): AssessmentCalculationResult {
  const outcome = calculateAssessment(makeInput(patch));
  if (!outcome.ok) throw new Error(outcome.errors.map((e) => e.message).join("; "));
  return outcome.result;
}
const errorsOf = (patch: Parameters<typeof makeInput>[0]) => {
  const o = calculateAssessment(makeInput(patch));
  return o.ok ? [] : o.errors.map((e) => e.message);
};
const codes = (r: AssessmentCalculationResult) => r.warnings.map((w) => w.code);
const sumComponents = (v: Record<string, number>) => Object.values(v).reduce((a, b) => a + b, 0);

describe("VERIFICATION CASE 1: hand-checkable, 0% discount (abstract currency units)", () => {
  const r = run();

  it("fuel and energy quantities", () => {
    expect(r.diesel.energy).toMatchObject({ unit: "litre", fleetQuantityYear1: 1000, unitPriceYear1: 1 });
    expect(r.bev.energy).toMatchObject({ unit: "kWh", fleetQuantityYear1: 10000, vehicleDeliveredKwhFleetYear1: 10000, chargingLossRate: null });
    expect(r.biofuel.energy).toMatchObject({ unit: "litre", fleetQuantityYear1: 1250 });
  });
  it("annual operating costs", () => {
    expect(r.diesel.year1EnergyCost).toBe(1000);
    expect(r.diesel.year1OperatingCost).toBe(1500);
    expect(r.bev.year1EnergyCost).toBeCloseTo(500, 10);
    expect(r.bev.year1OperatingCost).toBeCloseTo(700, 10);
    expect(r.biofuel.year1EnergyCost).toBeCloseTo(1000, 10);
    expect(r.biofuel.year1OperatingCost).toBeCloseTo(1550, 10);
  });
  it("undiscounted TCO and cost per km", () => {
    expect(r.diesel.undiscountedTco).toBe(15500);
    expect(r.bev.undiscountedTco).toBeCloseTo(13500, 9);
    expect(r.biofuel.undiscountedTco).toBeCloseTo(16250, 9);
    expect(r.diesel.fleetHorizonDistanceKm).toBe(50000);
    expect(r.diesel.tcoPerKm).toBeCloseTo(0.31, 12);
    expect(r.bev.tcoPerKm).toBeCloseTo(0.27, 12);
  });
  it("with a 0% rate the present cost equals the undiscounted TCO", () => {
    for (const t of [r.diesel, r.bev, r.biofuel]) expect(t.presentCost).toBeCloseTo(t.undiscountedTco, 9);
  });
  it("BEV vs diesel cash flows, NPV, payback and break-even distance", () => {
    const a = r.bevVsDiesel;
    expect(a.rows.map((x) => Math.round(x.incrementalCashFlow * 1e6) / 1e6)).toEqual([-3000, 800, 800, 800, 800, 1800]);
    expect(a.additionalInitialInvestment).toBe(3000);
    expect(a.npv).toBeCloseTo(2000, 9);
    expect(a.npvDirection).toBe("advantage");
    expect(a.simplePayback.status).toBe("achieved");
    expect(a.simplePayback.years).toBeCloseTo(3.75, 9);
    expect(a.discountedPayback.years).toBeCloseTo(3.75, 9);
    expect(a.breakEvenYear).toBeCloseTo(3.75, 9);
    expect(a.breakEvenDistanceKm).toBeCloseTo(37500, 6);
    expect(a.operatingSavings.year1).toBeCloseTo(800, 9);
    expect(a.operatingSavings.averageAnnual).toBeCloseTo(800, 9);
    expect(a.operatingSavings.cumulative).toBeCloseTo(4000, 9);
    expect(a.cumulativeSavings).toBeCloseTo(2000, 9);
  });
  it("NPV equals the difference of the two TCOs when the rate is 0%", () => {
    expect(r.bevVsDiesel.npv).toBeCloseTo(r.diesel.undiscountedTco - r.bev.undiscountedTco, 9);
    expect(r.biofuelVsDiesel.npv).toBeCloseTo(r.diesel.undiscountedTco - r.biofuel.undiscountedTco, 9);
  });
  it("biofuel vs diesel: negative NPV, extra running cost, no payback", () => {
    const a = r.biofuelVsDiesel;
    expect(a.npv).toBeCloseTo(-750, 9);
    expect(a.npvDirection).toBe("disadvantage");
    expect(a.simplePayback).toEqual({ status: "not_achieved", years: null, sustained: null });
    expect(a.discountedPayback.status).toBe("not_achieved");
    expect(a.breakEvenYear).toBeNull();
    expect(a.breakEvenDistanceKm).toBeNull();
    expect(a.operatingSavings.year1).toBeCloseTo(-50, 9);
    expect(a.operatingSavings.year1Direction).toBe("additional_cost");
    expect(codes(r)).toContain("PAYBACK_NOT_ACHIEVED");
  });
});

describe("VERIFICATION CASE 2: positive discount rate, escalation, replacement, residual, incentives, shared infrastructure", () => {
  // Expected values come from an independent hand-written script (loops, no shared code), see the
  // fixture comment in the test setup below. Abstract currency units.
  const r = run({
    fleet: { fleetSize: 2 },
    operations: { analysisHorizonYears: 6, annualDistanceKmPerVehicle: 20000, dailyDistanceKm: 200, operatingDaysPerYear: 100 },
    finance: { discountRatePct: 10, incentives: { bev: { type: "upfront_grant", amount: 5000 }, biofuel: { type: "percent_subsidy", percentOfPurchasePrice: 20 } } },
    diesel: {
      upfrontVehicleCost: 50000, usefulLifeYears: 3, annualMaintenanceCost: 1000, annualInsurance: 500, annualRegistration: 100, otherVariableCostPerKm: 0.05,
      fuelPricePerLitre: 100, fuelConsumptionLitresPer100Km: 10, fuelPriceEscalationPctPerYear: 5, residualValue: { kind: "percent_of_acquisition", amount: null, percent: 20 },
    },
    bev: {
      upfrontVehicleCost: 80000, usefulLifeYears: 8, annualMaintenanceCost: 600, electricityTariffPerKwh: 50, energyConsumptionKwhPer100Km: 20, chargingLossPct: 10,
      electricityPriceEscalationPctPerYear: 2, residualValue: { kind: "amount", amount: 30000, percent: null }, batteryReplacement: { expected: "yes", year: 4, cost: 15000 },
    },
    infrastructure: {
      bevCharging: { arrangement: "shared_private", investmentRequired: true, equipmentCost: 30000, installationCost: 8000, electricalUpgradeCost: 2000, vehiclesSharing: 4, annualMaintenanceCost: 2000, usefulLifeYears: 10, numberOfChargers: 2 },
      biofuel: { investmentRequired: "yes", storageEquipmentCost: 6000, refuellingInfrastructureCost: 3000, installationCost: 1000, annualMaintenanceCost: 500, usefulLifeYears: 10 },
    },
    biofuel: {
      upfrontVehicleCost: 20000, usefulLifeYears: 3, annualMaintenanceCost: 1100, fuelPricePerFuelUnit: 90, fuelConsumptionFuelUnitsPer100Km: 11,
      acquisition: { mode: "conversion", existingVehicleValue: 40000 }, residualValue: { kind: "percent_of_acquisition", amount: null, percent: 10 },
      incrementalMaintenance: { kind: "percent_of_maintenance", amount: null, percent: 10 },
    },
  });

  it("standalone costs match the independent calculation", () => {
    expect(r.diesel.undiscountedTco).toBeCloseTo(2931965.125, 4);
    expect(r.diesel.presentCost).toBeCloseTo(2134896.933834059, 4);
    expect(r.diesel.initialCapitalRequirement).toBe(100000);
    expect(r.diesel.year1OperatingCost).toBeCloseTo(405200, 6);
    expect(r.diesel.tcoPerKm).toBeCloseTo(12.216521354166666, 9);
    expect(r.diesel.presentCostPerKm).toBeCloseTo(8.895403890975247, 9);

    expect(r.bev.undiscountedTco).toBeCloseTo(2956809.316977778, 4);
    expect(r.bev.presentCost).toBeCloseTo(2190151.726503098, 4);
    expect(r.bev.initialCapitalRequirement).toBeCloseTo(170000, 6);
    expect(r.bev.year1OperatingCost).toBeCloseTo(446644.4444444444, 6);

    expect(r.biofuel.undiscountedTco).toBeCloseTo(2467520, 4);
    expect(r.biofuel.presentCost).toBeCloseTo(1804937.3988251036, 4);
    expect(r.biofuel.initialCapitalRequirement).toBeCloseTo(42000, 6);
    expect(r.biofuel.year1OperatingCost).toBeCloseTo(398920, 6);
  });
  it("incremental NPV, cumulative savings and operating savings match", () => {
    expect(r.bevVsDiesel.npv).toBeCloseTo(-55254.792669038914, 4);
    expect(r.bevVsDiesel.cumulativeSavings).toBeCloseTo(-24844.19197777746, 4);
    expect(r.bevVsDiesel.operatingSavings.year1).toBeCloseTo(-41444.44444444444, 6);
    expect(r.bevVsDiesel.operatingSavings.cumulative).toBeCloseTo(-64844.19197777746, 4);
    expect(r.bevVsDiesel.rows.map((x) => x.incrementalCashFlow)).toEqual(
      [-70000, -41444.44444444444, -30333.333333333314, 81600.00000000006, -35598, 8121.540000000096, 62810.04580000014].map((e) => expect.closeTo(e, 4)),
    );
    expect(r.bevVsDiesel.simplePayback.status).toBe("not_achieved");
    expect(r.bevVsDiesel.discountedPayback.status).toBe("not_achieved");

    expect(r.biofuelVsDiesel.npv).toBeCloseTo(329959.5350089555, 4);
    expect(r.biofuelVsDiesel.cumulativeSavings).toBeCloseTo(464445.125, 4);
    expect(r.biofuelVsDiesel.operatingSavings.year1).toBeCloseTo(6280, 6);
    expect(r.biofuelVsDiesel.operatingSavings.cumulative).toBeCloseTo(358445.125, 4);
    expect(r.biofuelVsDiesel.simplePayback).toMatchObject({ status: "immediate", years: 0 });
  });
  it("events land in the right years", () => {
    expect(r.diesel.replacementYears).toEqual([3]);
    expect(r.biofuel.replacementYears).toEqual([3]);
    expect(r.bev.replacementYears).toEqual([]);
    expect(r.bev.batteryReplacementYears).toEqual([4]);
    expect(r.bev.series[4]!.components.batteryReplacement).toBe(30000);
    expect(r.bev.series[0]!.components.infrastructureCapex).toBe(20000); // half of 40,000
    expect(r.bev.series[0]!.components.incentiveOffsets).toBe(-10000);
    expect(r.biofuel.series[0]!.components.incentiveOffsets).toBe(-8000);
    expect(r.diesel.series[6]!.components.residualOffset).toBe(-20000);
  });
});

describe("consumption and energy", () => {
  it("scales fuel by fleet size and distance", () => {
    const r = run({ fleet: { fleetSize: 3 } });
    expect(r.diesel.energy.fleetQuantityYear1).toBe(3000);
    expect(r.metadata.fleetAnnualDistanceKm).toBe(30000);
    expect(r.metadata.fleetHorizonDistanceKm).toBe(150000);
  });
  it("charging loss L divides by (1 - L), it does not multiply by (1 + L)", () => {
    const r = run({ bev: { chargingLossPct: 10 } });
    expect(r.bev.energy.fleetQuantityYear1).toBeCloseTo(10000 / 0.9, 9);
    expect(r.bev.energy.fleetQuantityYear1).not.toBeCloseTo(11000, 0);
    expect(r.bev.energy.vehicleDeliveredKwhFleetYear1).toBe(10000);
    expect(r.bev.energy.chargingLossRate).toBeCloseTo(0.1, 12);
    expect(r.bev.year1EnergyCost).toBeCloseTo((10000 / 0.9) * 0.05, 9);
  });
  it("explains when charging loss is not entered and does not pretend it is zero", () => {
    const r = run();
    expect(codes(r)).toContain("CHARGING_LOSS_NOT_MODELLED");
    expect(r.assumptionsMissing.some((a) => a.id === "bev_charging_loss")).toBe(true);
    const withZero = run({ bev: { chargingLossPct: 0 } });
    expect(codes(withZero)).not.toContain("CHARGING_LOSS_NOT_MODELLED");
    expect(withZero.assumptions.find((a) => a.id === "bev_charging_loss")?.status).toBe("user_input");
    expect(withZero.bev.undiscountedTco).toBeCloseTo(r.bev.undiscountedTco, 9);
  });
  it("applies energy price escalation as price x (1 + g)^(t-1) and leaves other costs flat", () => {
    const r = run({ diesel: { fuelPriceEscalationPctPerYear: 10 } });
    expect(r.diesel.series.slice(1).map((y) => y.components.energy)).toEqual([1000, 1100, 1210, 1331, 1464.1].map((e) => expect.closeTo(e, 9)));
    expect(r.diesel.series.map((y) => y.components.maintenance)).toEqual([0, 500, 500, 500, 500, 500]);
  });
  it("treats a blank escalation as constant but records it as missing, unlike an entered 0%", () => {
    const blank = run();
    const zero = run({ diesel: { fuelPriceEscalationPctPerYear: 0 }, bev: { electricityPriceEscalationPctPerYear: 0 }, biofuel: { fuelPriceEscalationPctPerYear: 0 } });
    expect(blank.diesel.undiscountedTco).toBe(zero.diesel.undiscountedTco);
    expect(blank.assumptions.find((a) => a.id === "diesel_escalation")?.status).toBe("missing");
    expect(zero.assumptions.find((a) => a.id === "diesel_escalation")?.status).toBe("user_input");
  });
  it("supports gaseous biofuel in its own unit", () => {
    const r = run({ biofuel: { fuelUnit: "kg", fuelPricePerFuelUnit: 2, fuelConsumptionFuelUnitsPer100Km: 20 } });
    expect(r.biofuel.energy).toMatchObject({ unit: "kg", fleetQuantityYear1: 2000, unitPriceYear1: 2 });
    expect(r.biofuel.year1EnergyCost).toBe(4000);
  });
});

describe("operating cost categories", () => {
  it("scales per-vehicle fixed costs by fleet size and keeps categories separate", () => {
    const r = run({ fleet: { fleetSize: 4 }, diesel: { annualMaintenanceCost: 100, annualInsurance: 30, annualRegistration: 20, otherFixedAnnualCost: 10 } });
    const y1 = r.diesel.series[1]!.components;
    expect(y1.maintenance).toBe(400);
    expect(y1.insurance).toBe(120);
    expect(y1.licensing).toBe(80);
    expect(y1.otherFixed).toBe(40);
    expect(y1.otherVariable).toBe(0);
  });
  it("charges variable cost per km on fleet distance once, not times the fleet again", () => {
    const r = run({ fleet: { fleetSize: 2 }, diesel: { otherVariableCostPerKm: 0.1 } });
    expect(r.diesel.series[1]!.components.otherVariable).toBeCloseTo(0.1 * 20000, 9);
  });
  it("keeps the operating cost equal to the sum of its parts", () => {
    const r = run({ diesel: { annualInsurance: 7, annualRegistration: 3, otherFixedAnnualCost: 5, otherVariableCostPerKm: 0.01 } });
    for (const row of r.diesel.series.slice(1)) {
      const c = row.components;
      expect(row.operatingCost).toBeCloseTo(c.energy + c.maintenance + c.insurance + c.licensing + c.otherFixed + c.otherVariable + c.infrastructureOpex, 9);
    }
  });
  it("accepts zero for every optional cost without changing the answer", () => {
    const base = run();
    const zeros = run({ diesel: { annualInsurance: 0, annualRegistration: 0, otherFixedAnnualCost: 0, otherVariableCostPerKm: 0 } });
    expect(zeros.diesel.undiscountedTco).toBe(base.diesel.undiscountedTco);
  });
  it("adds biofuel's additional maintenance as an amount or a percentage of the entered maintenance", () => {
    expect(run({ biofuel: { incrementalMaintenance: { kind: "amount_per_year", amount: 50, percent: null } } }).biofuel.series[1]!.components.maintenance).toBe(600);
    expect(run({ biofuel: { incrementalMaintenance: { kind: "percent_of_maintenance", amount: null, percent: 10 } } }).biofuel.series[1]!.components.maintenance).toBeCloseTo(605, 9);
    expect(run({ biofuel: { incrementalMaintenance: { kind: "amount_per_year", amount: -50, percent: null } } }).biofuel.series[1]!.components.maintenance).toBe(500);
  });
});

describe("infrastructure", () => {
  const shared = { arrangement: "shared_private", investmentRequired: true, equipmentCost: 10000, installationCost: 2000, electricalUpgradeCost: 3000, vehiclesSharing: 5, annualMaintenanceCost: 600, otherAnnualCost: 400, numberOfChargers: 3, usefulLifeYears: 10 };

  it("treats entered costs as project totals: the charger count is not a multiplier", () => {
    const one = run({ infrastructure: { bevCharging: { ...shared, vehiclesSharing: 1, numberOfChargers: 1 } } });
    const many = run({ infrastructure: { bevCharging: { ...shared, vehiclesSharing: 1, numberOfChargers: 9 } } });
    expect(one.bev.series[0]!.components.infrastructureCapex).toBe(15000);
    expect(many.bev.series[0]!.components.infrastructureCapex).toBe(15000);
  });
  it("allocates the assessed fleet's share: min(1, fleet / vehicles using the chargers)", () => {
    const r = run({ fleet: { fleetSize: 2 }, infrastructure: { bevCharging: { ...shared, vehiclesSharing: 5 } } });
    expect(r.bev.series[0]!.components.infrastructureCapex).toBeCloseTo(15000 * 0.4, 9);
    expect(r.bev.series[1]!.components.infrastructureOpex).toBeCloseTo(1000 * 0.4, 9);
    expect(r.assumptions.find((a) => a.id === "bev_infra_share")).toMatchObject({ status: "derived", value: "40" });
  });
  it("charges the whole cost when the fleet is as large as, or larger than, the sharing group", () => {
    const equal = run({ fleet: { fleetSize: 5 }, infrastructure: { bevCharging: { ...shared, vehiclesSharing: 5 } } });
    expect(equal.bev.series[0]!.components.infrastructureCapex).toBe(15000);
    const fewer = run({ fleet: { fleetSize: 5 }, infrastructure: { bevCharging: { ...shared, vehiclesSharing: 2 } } });
    expect(fewer.bev.series[0]!.components.infrastructureCapex).toBe(15000);
    expect(codes(fewer)).toContain("INFRA_SHARING_BELOW_FLEET");
  });
  it("does not use charger utilisation to share cost", () => {
    const a = run({ infrastructure: { bevCharging: { ...shared, vehiclesSharing: 1, utilisationPct: 20 } } });
    const b = run({ infrastructure: { bevCharging: { ...shared, vehiclesSharing: 1, utilisationPct: 90 } } });
    expect(a.bev.undiscountedTco).toBe(b.bev.undiscountedTco);
  });
  it("counts infrastructure capital once and its running cost every year (no double counting)", () => {
    const withInfra = run({ infrastructure: { bevCharging: { ...shared, vehiclesSharing: 1 } } });
    const without = run();
    expect(withInfra.bev.undiscountedTco - without.bev.undiscountedTco).toBeCloseTo(15000 + 5 * 1000, 9);
    expect(withInfra.bev.series.filter((y) => y.components.infrastructureCapex !== 0).map((y) => y.year)).toEqual([0]);
    expect(withInfra.bev.grossInitialCapex).toBe(13000 + 15000);
    expect(withInfra.diesel.undiscountedTco).toBe(without.diesel.undiscountedTco);
  });
  it("includes no infrastructure when none is needed, and says so when it is unknown", () => {
    expect(run().bev.series[0]!.components.infrastructureCapex).toBe(0);
    const unknown = run({ infrastructure: { bevCharging: { arrangement: "unknown" } } });
    expect(codes(unknown)).toContain("CHARGING_ARRANGEMENT_UNKNOWN");
  });
  it("accepts zero infrastructure cost as a real value", () => {
    const r = run({ infrastructure: { bevCharging: { ...shared, equipmentCost: 0, installationCost: 0, electricalUpgradeCost: null, annualMaintenanceCost: null, otherAnnualCost: null } } });
    expect(r.bev.series[0]!.components.infrastructureCapex).toBe(0);
    expect(Number.isFinite(r.bev.undiscountedTco)).toBe(true);
  });
  it("includes biofuel infrastructure only when required, with its running cost separate", () => {
    const yes = run({ infrastructure: { biofuel: { investmentRequired: "yes", storageEquipmentCost: 1000, refuellingInfrastructureCost: 500, installationCost: 250, annualMaintenanceCost: 80, usefulLifeYears: 10 } } });
    expect(yes.biofuel.series[0]!.components.infrastructureCapex).toBe(1750);
    expect(yes.biofuel.series[1]!.components.infrastructureOpex).toBe(80);
    expect(run().biofuel.series[0]!.components.infrastructureCapex).toBe(0);
    expect(codes(run({ infrastructure: { biofuel: { investmentRequired: "unknown" } } }))).toContain("BIOFUEL_INFRA_UNKNOWN");
  });
  it("warns when infrastructure would need replacing within the period", () => {
    const r = run({ infrastructure: { bevCharging: { ...shared, vehiclesSharing: 1, usefulLifeYears: 3 } } });
    expect(codes(r)).toContain("INFRA_REPLACEMENT_NOT_MODELLED");
  });
});

describe("incentives", () => {
  it("deducts a fixed grant per vehicle at Year 0, scaled by fleet", () => {
    const r = run({ fleet: { fleetSize: 2 }, finance: { incentives: { bev: { type: "upfront_grant", amount: 1000 } } } });
    expect(r.bev.series[0]!.components.incentiveOffsets).toBe(-2000);
    expect(r.bev.initialCapitalRequirement).toBe(26000 - 2000);
    expect(r.bev.upfrontIncentives).toBe(2000);
  });
  it("deducts a percentage subsidy of the vehicle purchase cost only", () => {
    const r = run({ infrastructure: { bevCharging: { arrangement: "dedicated_private", investmentRequired: true, equipmentCost: 5000, installationCost: 0, vehiclesSharing: 1 } }, finance: { incentives: { bev: { type: "percent_subsidy", percentOfPurchasePrice: 10 } } } });
    expect(r.bev.series[0]!.components.incentiveOffsets).toBeCloseTo(-1300, 9); // 10% of 13,000, not of the chargers
  });
  it("never lets a grant exceed the purchase cost", () => {
    const r = run({ finance: { incentives: { bev: { type: "upfront_grant", amount: 99999 } } } });
    expect(r.bev.series[0]!.components.vehicleAcquisition + r.bev.series[0]!.components.incentiveOffsets).toBe(0);
    expect(codes(r)).toContain("INCENTIVE_CAPPED");
  });
  it("excludes tax credits and other incentives with undefined timing, and says so", () => {
    for (const type of ["tax_credit", "other"] as const) {
      const r = run({ finance: { incentives: { bev: { type, amount: 5000 } } } });
      expect(r.bev.upfrontIncentives).toBe(0);
      expect(codes(r)).toContain("INCENTIVE_TIMING_UNDEFINED");
      expect(r.assumptionsMissing.some((a) => a.id === "bev_incentive")).toBe(true);
    }
  });
  it("applies nothing unless an incentive is entered", () => {
    const r = run({ finance: { incentives: { bev: { type: "none" } } } });
    expect(r.bev.upfrontIncentives).toBe(0);
    expect(r.diesel.upfrontIncentives).toBe(0);
  });
  it("applies a diesel incentive to diesel only", () => {
    const r = run({ finance: { incentives: { diesel: { type: "upfront_grant", amount: 1000 } } } });
    expect(r.diesel.initialCapitalRequirement).toBe(9000);
    expect(r.bev.initialCapitalRequirement).toBe(13000);
  });
});

describe("vehicle replacement", () => {
  it("buys a replacement when the horizon outlasts the life, and not at the final year", () => {
    const r = run({ operations: { analysisHorizonYears: 10 }, diesel: { usefulLifeYears: 5 } });
    expect(r.diesel.replacementYears).toEqual([5]);
    expect(r.diesel.series[5]!.components.vehicleReplacement).toBe(10000);
    expect(r.diesel.series[10]!.components.vehicleReplacement).toBe(0);
    expect(r.diesel.breakdown.undiscounted.vehicleReplacement).toBe(10000);
  });
  it("buys more than one when the horizon is longer still", () => {
    expect(run({ operations: { analysisHorizonYears: 11 }, diesel: { usefulLifeYears: 5 } }).diesel.replacementYears).toEqual([5, 10]);
  });
  it("buys none when the life equals or exceeds the horizon", () => {
    expect(run({ operations: { analysisHorizonYears: 5 }, diesel: { usefulLifeYears: 5 } }).diesel.replacementYears).toEqual([]);
    expect(run({ operations: { analysisHorizonYears: 3 }, diesel: { usefulLifeYears: 10 } }).diesel.replacementYears).toEqual([]);
  });
  it("makes replacement visible in the incremental cash flow", () => {
    const r = run({ operations: { analysisHorizonYears: 10 }, diesel: { usefulLifeYears: 5 } });
    expect(r.bevVsDiesel.rows[5]!.incrementalCashFlow).toBeCloseTo(10000 + (1500 - 700), 9);
    expect(r.bevVsDiesel.operatingSavings.byYear[4]).toBeCloseTo(800, 9); // operating savings exclude the replacement
  });
  it("repeats a conversion cost for a converted vehicle and discloses it", () => {
    const r = run({ operations: { analysisHorizonYears: 10 }, biofuel: { usefulLifeYears: 5, upfrontVehicleCost: 2000, acquisition: { mode: "conversion", existingVehicleValue: null }, residualValue: null } });
    expect(r.biofuel.series[5]!.components.vehicleReplacement).toBe(2000);
    expect(r.biofuel.vehicleAcquisitionLabel).toBe("Vehicle conversion");
    expect(codes(r)).toContain("CONVERSION_REPLACEMENT_ASSUMPTION");
  });
});

describe("battery replacement", () => {
  it("charges the cost per vehicle, times the fleet, in the replacement year", () => {
    const r = run({ fleet: { fleetSize: 2 }, bev: { batteryReplacement: { expected: "yes", year: 3, cost: 1000 } } });
    expect(r.bev.series[3]!.components.batteryReplacement).toBe(2000);
    expect(r.bev.batteryReplacementYears).toEqual([3]);
    expect(r.bev.breakdown.undiscounted.batteryReplacement).toBe(2000);
    expect(r.bevVsDiesel.operatingSavings.byYear[2]).toBeCloseTo(1500 * 2 - 700 * 2, 9); // not an operating cost
  });
  it("ignores a replacement that falls after the horizon", () => {
    const r = run({ bev: { usefulLifeYears: 20, batteryReplacement: { expected: "yes", year: 9, cost: 1000 } } });
    expect(r.bev.batteryReplacementYears).toEqual([]);
    expect(r.bev.breakdown.undiscounted.batteryReplacement).toBe(0);
  });
  it("has no cost when no replacement is expected", () => {
    expect(run().bev.breakdown.undiscounted.batteryReplacement).toBe(0);
    expect(codes(run())).not.toContain("BATTERY_REPLACEMENT_UNKNOWN");
  });
  it("excludes an unknown requirement and says so in the exact words", () => {
    const r = run({ bev: { batteryReplacement: { expected: "unknown", year: null, cost: null } } });
    expect(r.bev.breakdown.undiscounted.batteryReplacement).toBe(0);
    const w = r.warnings.find((x) => x.code === "BATTERY_REPLACEMENT_UNKNOWN");
    expect(w?.message).toBe("Battery replacement requirement is unknown and is not included in the primary cost estimate.");
    expect(r.assumptionsMissing.some((a) => a.id === "bev_battery")).toBe(true);
  });
  it("discloses a battery question that was never answered", () => {
    const r = run({ bev: { batteryReplacement: { expected: null, year: null, cost: null } } });
    expect(codes(r)).toContain("BATTERY_REPLACEMENT_UNKNOWN");
  });
  it("repeats the replacement in each vehicle cycle when vehicles are replaced", () => {
    const r = run({ operations: { analysisHorizonYears: 10 }, bev: { usefulLifeYears: 5, batteryReplacement: { expected: "yes", year: 3, cost: 100 } } });
    expect(r.bev.batteryReplacementYears).toEqual([3, 8]);
  });
});

describe("residual value", () => {
  it("credits an amount per vehicle, times the fleet, at the end of the horizon only", () => {
    const r = run({ fleet: { fleetSize: 2 } });
    expect(r.diesel.residualValue).toBe(4000);
    expect(r.diesel.series[5]!.components.residualOffset).toBe(-4000);
    expect(r.diesel.series.slice(0, 5).every((y) => y.components.residualOffset === 0)).toBe(true);
    expect(r.diesel.series.every((y) => y.netCashCost >= 0 || y.year === 5)).toBe(true);
  });
  it("applies a percentage to the acquisition price", () => {
    const r = run({ fleet: { fleetSize: 2 }, diesel: { residualValue: { kind: "percent_of_acquisition", amount: null, percent: 30 } } });
    expect(r.diesel.residualValue).toBeCloseTo(0.3 * 10000 * 2, 9);
  });
  it("credits nothing and says so when no residual value was entered", () => {
    const r = run({ diesel: { residualValue: null } });
    expect(r.diesel.residualValue).toBe(0);
    expect(codes(r)).toContain("RESIDUAL_NOT_PROVIDED");
    expect(r.assumptionsMissing.some((a) => a.id === "diesel_residual")).toBe(true);
    expect(run({ diesel: { residualValue: { kind: "amount", amount: 0, percent: null } } }).warnings.some((w) => w.code === "RESIDUAL_NOT_PROVIDED" && w.scope === "diesel")).toBe(false);
  });
  it("uses the existing vehicle's value as the base for a conversion percentage, or leaves it out with a warning", () => {
    const conv = (existing: number | null) => run({ biofuel: { acquisition: { mode: "conversion", existingVehicleValue: existing }, upfrontVehicleCost: 1000, residualValue: { kind: "percent_of_acquisition", amount: null, percent: 50 } } });
    expect(conv(8000).biofuel.residualValue).toBe(4000);
    expect(conv(null).biofuel.residualValue).toBe(0);
    expect(codes(conv(null))).toContain("RESIDUAL_BASE_UNDEFINED");
  });
  it("warns that the residual assumption is applied as entered when a replacement vehicle is in service at the end", () => {
    expect(codes(run({ operations: { analysisHorizonYears: 10 }, diesel: { usefulLifeYears: 5 } }))).toContain("RESIDUAL_WITH_REPLACEMENT");
    expect(codes(run())).not.toContain("RESIDUAL_WITH_REPLACEMENT");
  });
  it("reduces TCO and appears as a positive cash flow in the incremental case", () => {
    const withResidual = run();
    const without = run({ diesel: { residualValue: null }, bev: { residualValue: null } });
    expect(without.diesel.undiscountedTco - withResidual.diesel.undiscountedTco).toBe(2000);
    expect(withResidual.bevVsDiesel.rows[5]!.incrementalCashFlow - without.bevVsDiesel.rows[5]!.incrementalCashFlow).toBeCloseTo(1000, 9);
  });
});

describe("TCO, present cost and cost per km", () => {
  it("TCO equals the sum of every yearly cash cost and the sum of its categories", () => {
    const r = run({ operations: { analysisHorizonYears: 8 }, diesel: { usefulLifeYears: 3, fuelPriceEscalationPctPerYear: 4 }, finance: { discountRatePct: 8 } });
    for (const t of [r.diesel, r.bev, r.biofuel]) {
      expect(t.undiscountedTco).toBeCloseTo(t.series.reduce((a, y) => a + y.netCashCost, 0), 8);
      expect(t.undiscountedTco).toBeCloseTo(sumComponents(t.breakdown.undiscounted), 8);
      expect(t.presentCost).toBeCloseTo(sumComponents(t.breakdown.present), 8);
    }
  });
  it("discounts future costs by (1 + r)^t and leaves Year 0 alone", () => {
    const r = run({ finance: { discountRatePct: 10 } });
    const manual = r.diesel.series.reduce((a, y) => a + y.netCashCost / Math.pow(1.1, y.year), 0);
    expect(r.diesel.presentCost).toBeCloseTo(manual, 9);
    expect(r.diesel.series[0]!.netCashCost).toBe(10000);
    expect(r.diesel.presentCost).toBeLessThan(r.diesel.undiscountedTco);
  });
  it("discounts the residual value from the end of the horizon", () => {
    const r = run({ finance: { discountRatePct: 10 } });
    expect(r.diesel.breakdown.present.residualOffset).toBeCloseTo(-2000 / Math.pow(1.1, 5), 9);
  });
  it("uses the same distance for the discounted and undiscounted cost per km", () => {
    const r = run({ finance: { discountRatePct: 10 } });
    expect(r.diesel.tcoPerKm).toBeCloseTo(r.diesel.undiscountedTco / 50000, 12);
    expect(r.diesel.presentCostPerKm).toBeCloseTo(r.diesel.presentCost / 50000, 12);
  });
  it("lists only categories that are really present, never fake non-zero values", () => {
    const b = run().diesel.breakdown.undiscounted;
    expect(b.infrastructureCapex).toBe(0);
    expect(b.batteryReplacement).toBe(0);
    expect(b.incentiveOffsets).toBe(0);
    expect(b.vehicleReplacement).toBe(0);
    expect(COST_CATEGORIES.map((c) => c.id).sort()).toEqual(Object.keys(b).sort());
  });
});

describe("incremental analysis", () => {
  it("is diesel minus the alternative, with Year 0 equal to minus the extra investment", () => {
    const r = run();
    for (const row of r.bevVsDiesel.rows) expect(row.incrementalCashFlow).toBeCloseTo(row.dieselCost - row.greenCost, 9);
    expect(r.bevVsDiesel.rows[0]!.incrementalCashFlow).toBe(-r.bevVsDiesel.additionalInitialInvestment);
  });
  it("discounts each flow and accumulates both streams", () => {
    const r = run({ finance: { discountRatePct: 10 } });
    let cum = 0;
    let dcum = 0;
    for (const row of r.bevVsDiesel.rows) {
      cum += row.incrementalCashFlow;
      dcum += row.incrementalCashFlow / Math.pow(1.1, row.year);
      expect(row.cumulativeIncrementalCashFlow).toBeCloseTo(cum, 9);
      expect(row.discountedCumulativeCashFlow).toBeCloseTo(dcum, 9);
    }
    expect(r.bevVsDiesel.npv).toBeCloseTo(dcum, 9);
  });
  it("has a positive NPV case, a negative NPV case and an approximately zero NPV case", () => {
    expect(run().bevVsDiesel.npvDirection).toBe("advantage");
    expect(run({ bev: { upfrontVehicleCost: 20000 } }).bevVsDiesel.npvDirection).toBe("disadvantage");
    const zero = run({ bev: { upfrontVehicleCost: 15000 } }); // extra 5,000 recovered exactly by 4,000 savings + 1,000 resale gap
    expect(zero.bevVsDiesel.npv).toBeCloseTo(0, 9);
    expect(zero.bevVsDiesel.npvDirection).toBe("indifferent");
  });
  it("treats a green option that is cheaper at Year 0 as immediate payback", () => {
    const r = run({ bev: { upfrontVehicleCost: 8000 } });
    expect(r.bevVsDiesel.additionalInitialInvestment).toBe(-2000);
    expect(r.bevVsDiesel.simplePayback).toMatchObject({ status: "immediate", years: 0 });
    expect(r.bevVsDiesel.breakEvenDistanceKm).toBe(0);
  });
  it("reports negative annual savings as additional operating cost, with a negative sign", () => {
    const r = run({ bev: { annualMaintenanceCost: 2000 } });
    expect(r.bevVsDiesel.operatingSavings.year1).toBeLessThan(0);
    expect(r.bevVsDiesel.operatingSavings.year1Direction).toBe("additional_cost");
    expect(r.bevVsDiesel.simplePayback.status).toBe("not_achieved");
  });
  it("finds a discounted payback later than the simple payback", () => {
    const r = run({ finance: { discountRatePct: 10 } });
    expect(r.bevVsDiesel.simplePayback.years).toBeCloseTo(3.75, 9);
    expect(r.bevVsDiesel.discountedPayback.status).toBe("achieved");
    expect(r.bevVsDiesel.discountedPayback.years as number).toBeGreaterThan(r.bevVsDiesel.simplePayback.years as number);
  });
  it("derives break-even distance from the year-by-year path and scales with the fleet", () => {
    expect(run().bevVsDiesel.breakEvenDistanceKm).toBeCloseTo(37500, 6);
    const fleet = run({ fleet: { fleetSize: 2 } });
    expect(fleet.bevVsDiesel.simplePayback.years).toBeCloseTo(3.75, 9); // same per-vehicle economics
    expect(fleet.bevVsDiesel.breakEvenDistanceKm).toBeCloseTo(75000, 6);
  });
  it("flags a payback that is not sustained", () => {
    const r = run({ bev: { upfrontVehicleCost: 11000, batteryReplacement: { expected: "yes", year: 4, cost: 9000 } } });
    expect(r.bevVsDiesel.simplePayback.status).toBe("achieved");
    expect(r.bevVsDiesel.simplePayback.sustained).toBe(false);
    expect(codes(r)).toContain("PAYBACK_NOT_SUSTAINED");
  });
});

describe("horizon and rate edge cases", () => {
  it("handles a horizon shorter than the useful life (no replacement, residual still credited)", () => {
    const r = run({ operations: { analysisHorizonYears: 2 }, diesel: { usefulLifeYears: 12 } });
    expect(r.diesel.series).toHaveLength(3);
    expect(r.diesel.replacementYears).toEqual([]);
    expect(r.diesel.residualValue).toBe(2000);
  });
  it("handles a one-year horizon", () => {
    const r = run({ operations: { analysisHorizonYears: 1 } });
    expect(r.diesel.series).toHaveLength(2);
    expect(r.diesel.undiscountedTco).toBe(10000 + 1500 - 2000);
  });
  it("handles a horizon longer than the life", () => {
    const r = run({ operations: { analysisHorizonYears: 12 }, bev: { usefulLifeYears: 4 } });
    expect(r.bev.replacementYears).toEqual([4, 8]);
  });
  it("handles the exact useful-life boundary: replacement strictly before the end only", () => {
    expect(run({ operations: { analysisHorizonYears: 6 }, diesel: { usefulLifeYears: 6 } }).diesel.replacementYears).toEqual([]);
    expect(run({ operations: { analysisHorizonYears: 7 }, diesel: { usefulLifeYears: 6 } }).diesel.replacementYears).toEqual([6]);
  });
  it("works with a 0% discount rate and 0% escalation entered explicitly", () => {
    const r = run({ finance: { discountRatePct: 0 }, diesel: { fuelPriceEscalationPctPerYear: 0 } });
    expect(r.diesel.presentCost).toBeCloseTo(r.diesel.undiscountedTco, 9);
  });
  it("makes a high discount rate favour the option with lower upfront cost", () => {
    const low = run({ finance: { discountRatePct: 0 } }).bevVsDiesel.npv;
    const high = run({ finance: { discountRatePct: 40 } }).bevVsDiesel.npv;
    expect(high).toBeLessThan(low);
  });
});

describe("warnings and assumptions", () => {
  it("warns when daily distance exceeds the BEV range, without changing any number", () => {
    const base = run();
    const over = run({ operations: { dailyDistanceKm: 600 }, bev: { usableRangeKm: 300 } });
    expect(over.warnings.find((w) => w.code === "BEV_RANGE_BELOW_DAILY_DISTANCE")?.message).toMatch(/without a charging strategy/);
    expect(over.bev.undiscountedTco).toBe(base.bev.undiscountedTco);
    expect(codes(base)).not.toContain("BEV_RANGE_BELOW_DAILY_DISTANCE");
  });
  it("flags limited biofuel availability without changing any number", () => {
    const base = run();
    const limited = run({ biofuel: { supply: { availability: "limited" } } });
    expect(codes(limited)).toContain("BIOFUEL_AVAILABILITY");
    expect(limited.biofuel.undiscountedTco).toBe(base.biofuel.undiscountedTco);
  });
  it("records existing vehicle value as stored but not a cash cost", () => {
    const r = run({ biofuel: { acquisition: { mode: "conversion", existingVehicleValue: 7000 }, upfrontVehicleCost: 900 } });
    expect(r.biofuel.initialCapitalRequirement).toBe(900);
    expect(r.assumptions.find((a) => a.id === "biofuel_existing_value")?.status).toBe("excluded");
  });
  it("always discloses that financing and tax are excluded, and lists the method notes", () => {
    const r = run();
    expect(r.assumptions.find((a) => a.id === "financing")?.status).toBe("excluded");
    expect(r.assumptions.find((a) => a.id === "tax")?.status).toBe("excluded");
    expect(r.methodologyNotes.join(" ")).toMatch(/independently of financing structure/);
    expect(r.methodologyNotes.join(" ")).toMatch(/Tax effects are excluded/);
    expect(r.methodologyNotes.join(" ")).toMatch(/specific escalation assumptions/);
  });
  it("splits assumptions into used and missing", () => {
    const r = run();
    expect(r.assumptionsUsed.length + r.assumptionsMissing.length).toBe(r.assumptions.length);
    expect(r.assumptionsUsed.every((a) => ["user_input", "derived", "convention"].includes(a.status))).toBe(true);
  });
  it("carries the demo flag through to the result", () => {
    const r = run({ meta: { dataOrigin: "demo", illustrativeInputs: ["fleet.size"] } });
    expect(r.metadata.dataOrigin).toBe("demo");
    expect(r.metadata.illustrativeInputs).toEqual(["fleet.size"]);
  });
});

describe("robustness", () => {
  it("never produces NaN or Infinity anywhere in a result", () => {
    const results = [run(), run({ fleet: { fleetSize: 3 }, finance: { discountRatePct: 12 } }), run({ operations: { analysisHorizonYears: 12 }, bev: { chargingLossPct: 35 } })];
    const bad: string[] = [];
    const walk = (v: unknown, path: string) => {
      if (typeof v === "number" && !Number.isFinite(v)) bad.push(path);
      else if (v !== null && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
    };
    for (const r of results) walk(r, "result");
    expect(bad).toEqual([]);
  });
  it("refuses to divide by zero distance, and reports why", () => {
    expect(errorsOf({ operations: { annualDistanceKmPerVehicle: 0 } })).toContain("Annual distance must be greater than zero.");
  });
  it("rejects impossible inputs with a clear message instead of a bad number", () => {
    expect(errorsOf({ bev: { chargingLossPct: 100 } })).toContain("Charging loss must be at least 0% and below 100%.");
    expect(errorsOf({ finance: { discountRatePct: -1 } })).toContain("Discount rate must be between 0% and 100%.");
    expect(errorsOf({ fleet: { fleetSize: 0 } })[0]).toMatch(/Fleet size/);
    expect(errorsOf({ operations: { analysisHorizonYears: 0 } })[0]).toMatch(/Analysis period/);
    expect(errorsOf({ diesel: { usefulLifeYears: 0 } })).toContain("Diesel useful life must be greater than zero.");
    expect(errorsOf({ diesel: { fuelConsumptionLitresPer100Km: 0 } })).toContain("Diesel fuel consumption must be greater than zero.");
    expect(errorsOf({ bev: { upfrontVehicleCost: -5 } })).toContain("Battery-electric vehicle cost cannot be negative.");
    expect(errorsOf({ diesel: { fuelPriceEscalationPctPerYear: -100 } })[0]).toMatch(/escalation/);
  });
  it("rejects malformed objects without throwing", () => {
    expect(calculateAssessment({} as never).ok).toBe(false);
    expect(calculateAssessment({ schemaVersion: 1 } as never).ok).toBe(false);
    const broken = makeInput();
    (broken.diesel as unknown as { fuelPricePerLitre: unknown }).fuelPricePerLitre = "1.00";
    expect(calculateAssessment(broken).ok).toBe(false);
  });
  it("never mutates its input (works on a deeply frozen object and leaves it unchanged)", () => {
    const input = deepFreeze(makeInput({ fleet: { fleetSize: 2 }, finance: { discountRatePct: 7 } }));
    const before = JSON.stringify(input);
    expect(() => calculateAssessment(input)).not.toThrow();
    expect(JSON.stringify(input)).toBe(before);
  });
  it("is deterministic", () => {
    const input = makeInput({ finance: { discountRatePct: 9 } });
    expect(JSON.stringify(calculateAssessment(input))).toBe(JSON.stringify(calculateAssessment(input)));
  });
  it("does not use financing data in the primary result", () => {
    const equity = run();
    const debt = run({ finance: { structure: "debt_100", debtSharePct: 100, equitySharePct: 0, interestRatePct: 45, loanTenorYears: 3, loanFees: 9999 } });
    expect(JSON.stringify(debt.bevVsDiesel)).toBe(JSON.stringify(equity.bevVsDiesel));
    expect(debt.diesel.undiscountedTco).toBe(equity.diesel.undiscountedTco);
  });
});
