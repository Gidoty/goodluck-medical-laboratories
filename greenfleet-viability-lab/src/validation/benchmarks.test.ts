import { describe, expect, it } from "vitest";
import { calculateAssessment } from "@/calculation";
import { makeInput } from "@/calculation/fixtures";
import type { AssessmentCalculationResult } from "@/calculation/types";
import type { NormalizedAssessmentInput } from "@/domain/normalized";

/**
 * VALIDATION FIXTURES: SYNTHETIC VALUES.
 *
 * Every number below is an abstract currency unit chosen so the arithmetic can be done on paper.
 * None of it is Nigerian (or any other) market data. Every expected value is written out as plain
 * arithmetic in the test. No production helper (discountFactor, replacementYears, paybackOf, ...) is
 * used to compute an expectation, so these tests cannot pass merely because a helper agrees with itself.
 * The worksheets are reproduced in docs/VALIDATION_AND_VERIFICATION.md.
 */

const run = (input: NormalizedAssessmentInput): AssessmentCalculationResult => {
  const out = calculateAssessment(input);
  if (!out.ok) throw new Error(`engine rejected the benchmark input: ${out.errors.map((e) => e.message).join("; ")}`);
  return out.result;
};

const amount = (a: number) => ({ kind: "amount" as const, amount: a, percent: null });

/** Shared geometry: 2 vehicles x 10,000 km/year (50 km/day x 200 days) = 20,000 km/year, 3-year horizon. */
const simple = (overrides: Parameters<typeof makeInput>[0] = {}) =>
  makeInput({
    fleet: { fleetSize: 2 },
    operations: { dailyDistanceKm: 50, operatingDaysPerYear: 200, annualDistanceKmPerVehicle: 10_000, fleetAnnualDistanceKm: 20_000, analysisHorizonYears: 3 },
    finance: { discountRatePct: 0 },
    diesel: { upfrontVehicleCost: 1_000_000, annualMaintenanceCost: 50_000, usefulLifeYears: 10, residualValue: amount(200_000), fuelPricePerLitre: 100, fuelConsumptionLitresPer100Km: 10 },
    bev: {
      upfrontVehicleCost: 1_200_000, annualMaintenanceCost: 20_000, usefulLifeYears: 10, residualValue: amount(300_000),
      electricityTariffPerKwh: 25, energyConsumptionKwhPer100Km: 20, chargingLossPct: 0,
    },
    biofuel: { upfrontVehicleCost: 1_000_000, annualMaintenanceCost: 50_000, usefulLifeYears: 10, residualValue: amount(200_000), fuelPricePerFuelUnit: 80, fuelConsumptionFuelUnitsPer100Km: 12 },
    ...overrides,
  });

describe("Benchmark 1: simple hand-calculable case (VALIDATION FIXTURE, SYNTHETIC VALUES)", () => {
  /*
   * Fleet 2, 10,000 km/vehicle/year, horizon 3, discount 0%, no escalation, no replacement, no infrastructure.
   *
   * DIESEL   fuel      2 x 10,000 km x 0.10 L/km  = 2,000 L/yr;  2,000 x 100      = 200,000 /yr
   *          maint     2 x 50,000                                                  = 100,000 /yr
   *          opex                                                                  = 300,000 /yr
   *          capex     2 x 1,000,000 = 2,000,000;  residual 2 x 200,000 = 400,000
   *          TCO       2,000,000 + 3 x 300,000 - 400,000                           = 2,500,000
   * BEV      energy    2 x 10,000 x 0.20 kWh/km = 4,000 kWh/yr (0% loss);  4,000 x 25 = 100,000 /yr
   *          maint     2 x 20,000                                                  =  40,000 /yr
   *          opex                                                                  = 140,000 /yr
   *          capex     2 x 1,200,000 = 2,400,000;  residual 2 x 300,000 = 600,000
   *          TCO       2,400,000 + 3 x 140,000 - 600,000                           = 2,220,000
   * BIOFUEL  fuel      2 x 10,000 x 0.12 = 2,400 L/yr;  2,400 x 80                 = 192,000 /yr
   *          maint                                                                 = 100,000 /yr
   *          opex                                                                  = 292,000 /yr
   *          capex 2,000,000; residual 400,000
   *          TCO       2,000,000 + 3 x 292,000 - 400,000                           = 2,476,000
   *
   * BEV minus diesel, incremental cash flow = diesel - BEV:
   *   Year 0: 2,000,000 - 2,400,000 = -400,000
   *   Years 1 and 2: 300,000 - 140,000 = +160,000
   *   Year 3: (300,000 - 400,000) - (140,000 - 600,000) = -100,000 + 460,000 = +360,000
   *   Running total: -400,000, -240,000, -80,000, +280,000   => NPV(0%) = +280,000 = 2,500,000 - 2,220,000
   *   Simple payback: crosses zero in Year 3: (3 - 1) + 80,000 / 360,000 = 2.2222... years
   * Horizon distance: 20,000 km x 3 = 60,000 km.
   */
  const r = run(simple());

  it("diesel annual fuel quantity and cost", () => {
    expect(r.diesel.energy.unit).toBe("litre");
    expect(r.diesel.energy.fleetQuantityYear1).toBeCloseTo(2 * 10_000 * 0.1, 9); // 2,000 L
    expect(r.diesel.year1EnergyCost).toBeCloseTo(2_000 * 100, 6); // 200,000
  });

  it("BEV delivered energy, grid energy (0% loss) and electricity cost", () => {
    expect(r.bev.energy.vehicleDeliveredKwhFleetYear1).toBeCloseTo(4_000, 9);
    expect(r.bev.energy.fleetQuantityYear1).toBeCloseTo(4_000, 9);
    expect(r.bev.year1EnergyCost).toBeCloseTo(4_000 * 25, 6); // 100,000
  });

  it("biofuel annual quantity and cost", () => {
    expect(r.biofuel.energy.fleetQuantityYear1).toBeCloseTo(2_400, 9);
    expect(r.biofuel.year1EnergyCost).toBeCloseTo(2_400 * 80, 6); // 192,000
  });

  it("annual operating cost, maintenance, initial investment and residual value", () => {
    expect(r.diesel.year1OperatingCost).toBeCloseTo(300_000, 6);
    expect(r.bev.year1OperatingCost).toBeCloseTo(140_000, 6);
    expect(r.biofuel.year1OperatingCost).toBeCloseTo(292_000, 6);
    expect(r.diesel.series[1]!.components.maintenance).toBe(100_000);
    expect(r.bev.series[1]!.components.maintenance).toBe(40_000);
    expect(r.diesel.initialCapitalRequirement).toBe(2_000_000);
    expect(r.bev.initialCapitalRequirement).toBe(2_400_000);
    expect(r.diesel.residualValue).toBe(400_000);
    expect(r.bev.residualValue).toBe(600_000);
  });

  it("no replacement, no infrastructure, no battery cost", () => {
    for (const t of [r.diesel, r.bev, r.biofuel]) {
      expect(t.replacementYears).toEqual([]);
      expect(t.batteryReplacementYears).toEqual([]);
      expect(t.series.every((y) => y.components.vehicleReplacement === 0 && y.components.infrastructureCapex === 0 && y.components.infrastructureOpex === 0)).toBe(true);
    }
  });

  it("undiscounted TCO", () => {
    expect(r.diesel.undiscountedTco).toBeCloseTo(2_500_000, 6);
    expect(r.bev.undiscountedTco).toBeCloseTo(2_220_000, 6);
    expect(r.biofuel.undiscountedTco).toBeCloseTo(2_476_000, 6);
  });

  it("with a 0% discount rate, present cost equals undiscounted TCO", () => {
    expect(r.diesel.presentCost).toBeCloseTo(2_500_000, 6);
    expect(r.bev.presentCost).toBeCloseTo(2_220_000, 6);
  });

  it("cost per km uses the whole-fleet distance over the whole horizon", () => {
    expect(r.metadata.fleetHorizonDistanceKm).toBe(60_000);
    expect(r.diesel.tcoPerKm).toBeCloseTo(2_500_000 / 60_000, 9); // 41.6667
    expect(r.bev.tcoPerKm).toBeCloseTo(2_220_000 / 60_000, 9); // 37
    expect(r.bev.tcoPerKm).toBeCloseTo(37, 9);
    expect(r.bev.presentCostPerKm).toBeCloseTo(37, 9);
  });

  it("incremental cash flow, NPV and payback (BEV vs diesel)", () => {
    expect(r.bevVsDiesel.rows.map((x) => x.incrementalCashFlow)).toEqual([-400_000, 160_000, 160_000, 360_000]);
    expect(r.bevVsDiesel.rows.map((x) => x.cumulativeIncrementalCashFlow)).toEqual([-400_000, -240_000, -80_000, 280_000]);
    expect(r.bevVsDiesel.npv).toBeCloseTo(280_000, 6);
    expect(r.bevVsDiesel.additionalInitialInvestment).toBe(400_000);
    expect(r.bevVsDiesel.simplePayback.status).toBe("achieved");
    expect(r.bevVsDiesel.simplePayback.years).toBeCloseTo(2 + 80_000 / 360_000, 9);
    expect(r.bevVsDiesel.discountedPayback.years).toBeCloseTo(2 + 80_000 / 360_000, 9); // 0% rate: identical
  });

  it("biofuel vs diesel: no extra investment at Year 0, so payback is immediate", () => {
    // Year 0: 2,000,000 - 2,000,000 = 0; Years 1..3: 300,000 - 292,000 = +8,000 each; NPV = 24,000 = 2,500,000 - 2,476,000
    expect(r.biofuelVsDiesel.rows.map((x) => x.incrementalCashFlow)).toEqual([0, 8_000, 8_000, 8_000]);
    expect(r.biofuelVsDiesel.npv).toBeCloseTo(24_000, 6);
    expect(r.biofuelVsDiesel.simplePayback.status).toBe("immediate");
    expect(r.biofuelVsDiesel.simplePayback.years).toBe(0);
  });
});

describe("Benchmark 1b: the same case at a 10% discount rate", () => {
  const r = run(simple({ finance: { discountRatePct: 10 } }));
  // Incremental cash flows are unchanged: -400,000, 160,000, 160,000, 360,000.
  const npv = -400_000 + 160_000 / 1.1 + 160_000 / 1.21 + 360_000 / 1.331;
  const dieselPc = 2_000_000 + 300_000 / 1.1 + 300_000 / 1.21 + -100_000 / 1.331;
  const bevPc = 2_400_000 + 140_000 / 1.1 + 140_000 / 1.21 + -460_000 / 1.331;

  it("discounted present cost of each technology", () => {
    expect(r.diesel.presentCost).toBeCloseTo(dieselPc, 4);
    expect(r.bev.presentCost).toBeCloseTo(bevPc, 4);
    expect(r.diesel.undiscountedTco).toBeCloseTo(2_500_000, 6); // TCO is not discounted
  });

  it("NPV equals the present-cost difference and the discounted incremental stream", () => {
    expect(r.bevVsDiesel.npv).toBeCloseTo(npv, 4);
    expect(r.bevVsDiesel.npv).toBeCloseTo(dieselPc - bevPc, 4);
    expect(r.bevVsDiesel.rows[1]!.discountedIncrementalCashFlow).toBeCloseTo(160_000 / 1.1, 6);
    expect(r.bevVsDiesel.rows[3]!.discountedIncrementalCashFlow).toBeCloseTo(360_000 / 1.331, 6);
  });

  it("discounted payback is later than simple payback and interpolates inside Year 3", () => {
    const afterYear2 = -400_000 + 160_000 / 1.1 + 160_000 / 1.21; // -122,314.05
    const inYear3 = 360_000 / 1.331;
    expect(r.bevVsDiesel.discountedPayback.status).toBe("achieved");
    expect(r.bevVsDiesel.discountedPayback.years).toBeCloseTo(2 + -afterYear2 / inYear3, 6);
    expect(r.bevVsDiesel.discountedPayback.years!).toBeGreaterThan(r.bevVsDiesel.simplePayback.years!);
  });

  it("Year 0 is not discounted", () => {
    expect(r.bevVsDiesel.rows[0]!.discountedIncrementalCashFlow).toBe(-400_000);
  });
});

describe("Benchmark 2: replacement cycles, residual value, battery replacement (SYNTHETIC)", () => {
  /*
   * 1 vehicle, 10,000 km/yr, horizon 7, discount 10%.
   * DIESEL  life 3: replaced when 3 and 6 elapse (3 x 3 = 9 >= 7 stops); nothing at Year 7.
   *         price 1,000,000; fuel 1,000 L x 100 = 100,000; maintenance 50,000; residual 100,000 at Year 7.
   *   net cash by year: 0: 1,000,000 | 1: 150,000 | 2: 150,000 | 3: 1,150,000 | 4: 150,000 | 5: 150,000 | 6: 1,150,000 | 7: 50,000
   * BEV     life 4: replaced when 4 elapses (8 >= 7). Battery replaced 2 years into each cycle: Years 2 and 4+2 = 6. (300,000 each.)
   *         price 1,500,000; energy 2,000 kWh x 25 = 50,000; maintenance 20,000; residual 200,000 at Year 7.
   *   net cash by year: 0: 1,500,000 | 1: 70,000 | 2: 370,000 | 3: 70,000 | 4: 1,570,000 | 5: 70,000 | 6: 370,000 | 7: -130,000
   */
  const input = makeInput({
    fleet: { fleetSize: 1 },
    operations: { dailyDistanceKm: 50, operatingDaysPerYear: 200, annualDistanceKmPerVehicle: 10_000, fleetAnnualDistanceKm: 10_000, analysisHorizonYears: 7 },
    finance: { discountRatePct: 10 },
    diesel: { upfrontVehicleCost: 1_000_000, annualMaintenanceCost: 50_000, usefulLifeYears: 3, residualValue: amount(100_000), fuelPricePerLitre: 100, fuelConsumptionLitresPer100Km: 10 },
    bev: {
      upfrontVehicleCost: 1_500_000, annualMaintenanceCost: 20_000, usefulLifeYears: 4, residualValue: amount(200_000),
      electricityTariffPerKwh: 25, energyConsumptionKwhPer100Km: 20, chargingLossPct: 0,
      batteryReplacement: { expected: "yes", year: 2, cost: 300_000 },
    },
  });
  const r = run(input);
  const dieselNet = [1_000_000, 150_000, 150_000, 1_150_000, 150_000, 150_000, 1_150_000, 50_000];
  const bevNet = [1_500_000, 70_000, 370_000, 70_000, 1_570_000, 70_000, 370_000, -130_000];

  it("vehicle replacement years follow the useful-life cycle and exclude the final year", () => {
    expect(r.diesel.replacementYears).toEqual([3, 6]);
    expect(r.bev.replacementYears).toEqual([4]);
  });

  it("battery replacement follows the cycle convention (measured from the start of each vehicle cycle)", () => {
    expect(r.bev.batteryReplacementYears).toEqual([2, 6]);
  });

  it("year-by-year net cash cost matches the hand schedule", () => {
    expect(r.diesel.series.map((y) => y.netCashCost)).toEqual(dieselNet);
    expect(r.bev.series.map((y) => y.netCashCost)).toEqual(bevNet);
  });

  it("residual value is credited once, at Year 7, for the vehicle in service, and not at replacement", () => {
    expect(r.diesel.series.map((y) => y.components.residualOffset)).toEqual([0, 0, 0, 0, 0, 0, 0, -100_000]);
    expect(r.bev.series.map((y) => y.components.residualOffset)).toEqual([0, 0, 0, 0, 0, 0, 0, -200_000]);
  });

  it("undiscounted and discounted totals", () => {
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    expect(r.diesel.undiscountedTco).toBe(sum(dieselNet)); // 3,000,000
    expect(r.bev.undiscountedTco).toBe(sum(bevNet));
    const pc = (xs: number[]) => xs[0]! + xs[1]! / 1.1 + xs[2]! / 1.21 + xs[3]! / 1.331 + xs[4]! / 1.4641 + xs[5]! / 1.61051 + xs[6]! / 1.771561 + xs[7]! / 1.9487171;
    expect(r.diesel.presentCost).toBeCloseTo(pc(dieselNet), 4);
    expect(r.bev.presentCost).toBeCloseTo(pc(bevNet), 4);
    expect(r.bevVsDiesel.npv).toBeCloseTo(pc(dieselNet) - pc(bevNet), 4);
  });

  it("no vehicle replacement exactly at the final horizon year (life divides the horizon)", () => {
    // horizon 6, life 3: only Year 3. Horizon 8, life 4: only Year 4. Horizon 3, life 3: none at all.
    const at = (horizon: number, life: number) => run(makeInput({ operations: { analysisHorizonYears: horizon }, diesel: { usefulLifeYears: life } })).diesel.replacementYears;
    expect(at(6, 3)).toEqual([3]);
    expect(at(8, 4)).toEqual([4]);
    expect(at(3, 3)).toEqual([]);
    expect(at(9, 3)).toEqual([3, 6]);
    expect(at(10, 3)).toEqual([3, 6, 9]);
  });

  it("a vehicle that outlives the horizon is never replaced", () => {
    expect(run(makeInput({ operations: { analysisHorizonYears: 5 }, diesel: { usefulLifeYears: 12 } })).diesel.replacementYears).toEqual([]);
  });

  it("a non-integer life places the replacement at the end of the year in which life expires", () => {
    // life 2.5, horizon 6: due 2.5 (-> Year 3) and 5.0 (-> Year 5); 7.5 >= 6 stops.
    expect(run(makeInput({ operations: { analysisHorizonYears: 6 }, diesel: { usefulLifeYears: 2.5 } })).diesel.replacementYears).toEqual([3, 5]);
  });

  it("battery replacement in the second cycle is skipped when the cycle ends first, and at exactly the horizon it still counts", () => {
    const withBattery = (horizon: number, life: number, year: number) =>
      run(makeInput({ operations: { analysisHorizonYears: horizon }, bev: { usefulLifeYears: life, batteryReplacement: { expected: "yes", year, cost: 1000 } } })).bev.batteryReplacementYears;
    expect(withBattery(9, 4, 2)).toEqual([2, 6]); // cycles start 0, 4, 8; the third cycle's battery (Year 10) is beyond the horizon
    expect(withBattery(10, 4, 2)).toEqual([2, 6, 10]); // Year 10 is exactly the horizon: still paid
    expect(withBattery(10, 4, 4)).toEqual([]); // battery due when the vehicle itself is replaced: the new vehicle comes with a battery
    expect(withBattery(5, 10, 5)).toEqual([5]); // exactly at the horizon: still paid
    expect(withBattery(5, 10, 6)).toEqual([]); // beyond the horizon: not paid
  });

  it("battery cost scales with fleet size", () => {
    const big = run(makeInput({ fleet: { fleetSize: 3 }, operations: { annualDistanceKmPerVehicle: 10_000, fleetAnnualDistanceKm: 30_000 }, bev: { batteryReplacement: { expected: "yes", year: 2, cost: 100_000 } } }));
    expect(big.bev.series[2]!.components.batteryReplacement).toBe(300_000);
  });
});

describe("Benchmark 3: infrastructure allocation (SYNTHETIC)", () => {
  /*
   * Fleet 4. Project total CAPEX = 600,000 equipment + 300,000 installation + 100,000 upgrade = 1,000,000.
   * Annual running = 50,000 maintenance + 10,000 other = 60,000.
   * Chargers are used by 10 vehicles: the assessed fleet pays min(1, 4 / 10) = 0.4 of both.
   *   CAPEX in Year 0 = 400,000;  running cost = 24,000 per year.
   */
  const base = (infra: Record<string, unknown>) =>
    run(
      makeInput({
        fleet: { fleetSize: 4 },
        operations: { annualDistanceKmPerVehicle: 10_000, fleetAnnualDistanceKm: 40_000, analysisHorizonYears: 5 },
        infrastructure: { bevCharging: { arrangement: "dedicated_private", investmentRequired: true, equipmentCost: 600_000, installationCost: 300_000, electricalUpgradeCost: 100_000, annualMaintenanceCost: 50_000, otherAnnualCost: 10_000, ...infra } as never },
      }),
    );

  it("the fleet pays its share of a larger user base", () => {
    const r = base({ vehiclesSharing: 10, numberOfChargers: 2, usefulLifeYears: 10 });
    expect(r.bev.series[0]!.components.infrastructureCapex).toBeCloseTo(400_000, 6);
    expect(r.bev.series[1]!.components.infrastructureOpex).toBeCloseTo(24_000, 6);
    expect(r.bev.series[5]!.components.infrastructureOpex).toBeCloseTo(24_000, 6);
    expect(r.bev.grossInitialCapex).toBeCloseTo(4 * 13_000 + 400_000, 6);
  });

  it("the fleet pays everything when it is the only user, or when sharing is not stated", () => {
    expect(base({ vehiclesSharing: 4, numberOfChargers: 2, usefulLifeYears: 10 }).bev.series[0]!.components.infrastructureCapex).toBe(1_000_000);
    expect(base({ vehiclesSharing: null, numberOfChargers: null, usefulLifeYears: 10 }).bev.series[0]!.components.infrastructureCapex).toBe(1_000_000);
  });

  it("a user base smaller than the fleet never gives the fleet more than 100% of the cost, and warns", () => {
    const r = base({ vehiclesSharing: 2, usefulLifeYears: 10 });
    expect(r.bev.series[0]!.components.infrastructureCapex).toBe(1_000_000);
    expect(r.warnings.some((w) => w.code === "INFRA_SHARING_BELOW_FLEET")).toBe(true);
  });

  it("charger count and utilisation do not change the cost", () => {
    const a = base({ vehiclesSharing: 10, numberOfChargers: 1, utilisationPct: 10, usefulLifeYears: 10 });
    const b = base({ vehiclesSharing: 10, numberOfChargers: 9, utilisationPct: 95, usefulLifeYears: 10 });
    expect(a.bev.series.map((y) => y.netCashCost)).toEqual(b.bev.series.map((y) => y.netCashCost));
  });

  it("infrastructure is discounted like any other cash flow and enters NPV through the cost difference", () => {
    const withInfra = base({ vehiclesSharing: 10, usefulLifeYears: 10 });
    const without = run(makeInput({ fleet: { fleetSize: 4 }, operations: { annualDistanceKmPerVehicle: 10_000, fleetAnnualDistanceKm: 40_000, analysisHorizonYears: 5 } }));
    // Discount rate is 0% in the base fixture, so the NPV change is exactly -(400,000 + 5 x 24,000).
    expect(withInfra.bevVsDiesel.npv - without.bevVsDiesel.npv).toBeCloseTo(-(400_000 + 5 * 24_000), 6);
    const discounted = run(makeInput({ fleet: { fleetSize: 4 }, finance: { discountRatePct: 10 }, operations: { annualDistanceKmPerVehicle: 10_000, fleetAnnualDistanceKm: 40_000, analysisHorizonYears: 5 }, infrastructure: { bevCharging: { arrangement: "dedicated_private", investmentRequired: true, equipmentCost: 1_000_000, installationCost: 0, electricalUpgradeCost: 0, annualMaintenanceCost: 60_000, otherAnnualCost: 0, vehiclesSharing: 4, usefulLifeYears: 10 } as never } }));
    const plain = run(makeInput({ fleet: { fleetSize: 4 }, finance: { discountRatePct: 10 }, operations: { annualDistanceKmPerVehicle: 10_000, fleetAnnualDistanceKm: 40_000, analysisHorizonYears: 5 } }));
    const annuity = 1 / 1.1 + 1 / 1.21 + 1 / 1.331 + 1 / 1.4641 + 1 / 1.61051;
    expect(discounted.bev.presentCost - plain.bev.presentCost).toBeCloseTo(1_000_000 + 60_000 * annuity, 4);
  });

  it("biofuel infrastructure is a project total charged in full (no sharing rule)", () => {
    const r = run(
      makeInput({
        fleet: { fleetSize: 4 },
        operations: { annualDistanceKmPerVehicle: 10_000, fleetAnnualDistanceKm: 40_000, analysisHorizonYears: 5 },
        biofuel: { supply: { availability: "reliable", additionalRefuellingKmPerDay: null, downtimeHoursPerMonth: null, specialInfrastructure: "yes" } },
        infrastructure: { biofuel: { investmentRequired: "yes", storageEquipmentCost: 200_000, refuellingInfrastructureCost: 100_000, installationCost: 50_000, annualMaintenanceCost: 12_000, usefulLifeYears: 10 } },
      }),
    );
    expect(r.biofuel.series[0]!.components.infrastructureCapex).toBe(350_000);
    expect(r.biofuel.series[3]!.components.infrastructureOpex).toBe(12_000);
  });
});

describe("Benchmark 4: price escalation, year indexing and compounding (SYNTHETIC)", () => {
  /*
   * 1 vehicle, 10,000 km/yr, horizon 3, discount 10%.
   * Price in Year 1 is the entered price. Year t price = entered x (1 + g)^(t - 1). Nothing changes at Year 0.
   * Diesel 100/L, 1,000 L/yr, g = 10%:   100,000 | 110,000 | 121,000
   * BEV    25/kWh, 2,000 kWh/yr, g = 5%:  50,000 |  52,500 |  55,125
   * Biofuel 80/L, 1,200 L/yr, g = 20%:    96,000 | 115,200 | 138,240
   * Maintenance is NOT escalated (documented convention).
   */
  const input = (g: { d: number | null; b: number | null; f: number | null }) =>
    makeInput({
      fleet: { fleetSize: 1 },
      operations: { annualDistanceKmPerVehicle: 10_000, fleetAnnualDistanceKm: 10_000, analysisHorizonYears: 3 },
      finance: { discountRatePct: 10 },
      diesel: { fuelPricePerLitre: 100, fuelConsumptionLitresPer100Km: 10, fuelPriceEscalationPctPerYear: g.d },
      bev: { electricityTariffPerKwh: 25, energyConsumptionKwhPer100Km: 20, chargingLossPct: 0, electricityPriceEscalationPctPerYear: g.b },
      biofuel: { fuelPricePerFuelUnit: 80, fuelConsumptionFuelUnitsPer100Km: 12, fuelPriceEscalationPctPerYear: g.f },
    });

  it("each technology compounds from Year 1, with Year 0 holding no energy cost", () => {
    const r = run(input({ d: 10, b: 5, f: 20 }));
    const energy = (t: { series: { components: { energy: number } }[] }) => t.series.map((y) => y.components.energy);
    const close = (got: number[], want: number[]) => want.forEach((w, i) => expect(got[i]).toBeCloseTo(w, 6));
    close(energy(r.diesel), [0, 100_000, 110_000, 121_000]);
    close(energy(r.bev), [0, 50_000, 52_500, 55_125]);
    close(energy(r.biofuel), [0, 96_000, 115_200, 138_240]);
  });

  it("maintenance is held at its entered nominal value", () => {
    const r = run(input({ d: 10, b: 5, f: 20 }));
    expect(new Set(r.diesel.series.slice(1).map((y) => y.components.maintenance)).size).toBe(1);
  });

  it("escalated energy is discounted by the year in which it is paid", () => {
    const r = run(input({ d: 10, b: null, f: null }));
    // diesel energy PV = 100,000/1.1 + 110,000/1.21 + 121,000/1.331 = 90,909.09 + 90,909.09 + 90,909.09
    expect(r.diesel.presentCost - r.diesel.breakdown.present.vehicleAcquisition - r.diesel.breakdown.present.maintenance - r.diesel.breakdown.present.residualOffset).toBeCloseTo(100_000 / 1.1 + 110_000 / 1.21 + 121_000 / 1.331, 4);
  });

  it("a blank escalation equals an entered 0% numerically, but is recorded as missing rather than as a user input", () => {
    const blank = run(input({ d: null, b: null, f: null }));
    const zero = run(input({ d: 0, b: 0, f: 0 }));
    expect(blank.diesel.presentCost).toBeCloseTo(zero.diesel.presentCost, 9);
    expect(blank.bevVsDiesel.npv).toBeCloseTo(zero.bevVsDiesel.npv, 9);
    expect(blank.assumptions.find((a) => a.id === "diesel_escalation")?.status).toBe("missing");
    expect(zero.assumptions.find((a) => a.id === "diesel_escalation")?.status).toBe("user_input");
  });

  it("negative escalation (price falls) is supported above -100%", () => {
    const r = run(input({ d: -10, b: null, f: null }));
    expect(r.diesel.series[3]!.components.energy).toBeCloseTo(100_000 * 0.9 * 0.9, 6);
  });
});

describe("Financing boundary: loans, interest and debt/equity never enter project TCO or NPV", () => {
  const equity = run(makeInput({ finance: { discountRatePct: 10 } }));
  const levered = run(
    makeInput({ finance: { discountRatePct: 10, structure: "debt_equity", debtSharePct: 80, equitySharePct: 20, interestRatePct: 25, loanTenorYears: 4, loanFees: 500_000 } }),
  );

  it("identical results for 100% equity and for 80% debt at 25% interest", () => {
    expect(levered.diesel).toEqual(equity.diesel);
    expect(levered.bev).toEqual(equity.bev);
    expect(levered.biofuel).toEqual(equity.biofuel);
    expect(levered.bevVsDiesel).toEqual(equity.bevVsDiesel);
    expect(levered.biofuelVsDiesel).toEqual(equity.biofuelVsDiesel);
    expect(levered.commercial.bev.classification).toBe(equity.commercial.bev.classification);
  });

  it("no cost category carries loan principal, interest or fees", () => {
    const totals = levered.bev.breakdown.undiscounted;
    expect(totals.vehicleAcquisition).toBe(13_000);
    expect(Object.keys(totals)).not.toEqual(expect.arrayContaining(["loanPrincipal", "interest", "financing"]));
  });

  it("the exclusion is stated in the assumptions, not hidden", () => {
    const financing = levered.assumptions.find((a) => a.id === "financing");
    expect(financing?.status).toBe("excluded");
    expect(financing?.note).toMatch(/independently of how it is financed/i);
  });

  it("the discount rate (not the debt cost) is the only finance input that moves NPV", () => {
    const other = run(makeInput({ finance: { discountRatePct: 12 } }));
    expect(other.bevVsDiesel.npv).not.toBeCloseTo(equity.bevVsDiesel.npv, 3);
  });
});

describe("NPV sign convention: positive incremental NPV = advantage of the green alternative over diesel", () => {
  it("green cheaper over the horizon gives positive NPV and an advantage direction", () => {
    const r = run(simple()); // BEV TCO 2,220,000 < diesel 2,500,000
    expect(r.bevVsDiesel.npv).toBeGreaterThan(0);
    expect(r.bevVsDiesel.npvDirection).toBe("advantage");
    expect(r.diesel.presentCost - r.bev.presentCost).toBeCloseTo(r.bevVsDiesel.npv, 6);
  });

  it("green dearer gives negative NPV and a disadvantage direction", () => {
    const r = run(simple({ bev: { upfrontVehicleCost: 2_000_000 } })); // BEV capex 4,000,000
    expect(r.bevVsDiesel.npv).toBeLessThan(0);
    expect(r.bevVsDiesel.npvDirection).toBe("disadvantage");
  });

  it("exactly equal cost gives zero and indifference", () => {
    // Make BEV equal diesel: same price, same opex, same residual.
    const r = run(
      makeInput({
        diesel: { upfrontVehicleCost: 10_000, annualMaintenanceCost: 500, residualValue: amount(2_000), fuelPricePerLitre: 1, fuelConsumptionLitresPer100Km: 10 },
        bev: { upfrontVehicleCost: 10_000, annualMaintenanceCost: 500, residualValue: amount(2_000), electricityTariffPerKwh: 0.1, energyConsumptionKwhPer100Km: 100, chargingLossPct: 0 },
      }),
    );
    expect(r.bevVsDiesel.npv).toBeCloseTo(0, 6);
    expect(r.bevVsDiesel.npvDirection).toBe("indifferent");
  });

  it("the incremental cash flow is always diesel minus green", () => {
    const r = run(simple());
    r.bevVsDiesel.rows.forEach((row, t) => expect(row.incrementalCashFlow).toBeCloseTo(r.diesel.series[t]!.netCashCost - r.bev.series[t]!.netCashCost, 9));
  });
});

describe("Payback validation", () => {
  /** 1 vehicle, 10,000 km/yr. Diesel opex is 1,000 + 500 = 1,500/yr. The green alternative is built to give chosen savings. */
  const build = (extraInvestment: number, annualSaving: number, horizon: number, rate = 0) =>
    run(
      makeInput({
        fleet: { fleetSize: 1 },
        operations: { annualDistanceKmPerVehicle: 10_000, fleetAnnualDistanceKm: 10_000, analysisHorizonYears: horizon },
        finance: { discountRatePct: rate },
        diesel: { upfrontVehicleCost: 10_000, annualMaintenanceCost: 500, residualValue: null, fuelPricePerLitre: 1, fuelConsumptionLitresPer100Km: 10, usefulLifeYears: 50 },
        bev: { upfrontVehicleCost: 10_000 + extraInvestment, annualMaintenanceCost: 1_500 - annualSaving, residualValue: null, electricityTariffPerKwh: 0, energyConsumptionKwhPer100Km: 100, chargingLossPct: 0, usefulLifeYears: 50 },
      }),
    ).bevVsDiesel;

  it("immediate: the green alternative is not dearer at Year 0", () => {
    expect(build(0, 100, 5).simplePayback).toMatchObject({ status: "immediate", years: 0 });
    expect(build(-2_000, 100, 5).simplePayback).toMatchObject({ status: "immediate", years: 0 }); // negative additional investment
    expect(build(-2_000, 100, 5).additionalInitialInvestment).toBe(-2_000);
  });

  it("payback inside Year 1 is interpolated", () => {
    // extra 1,000, saving 1,500/yr: running -1,000, +500 => (1 - 1) + 1,000/1,500 = 0.6667
    const p = build(1_000, 1_500, 5).simplePayback;
    expect(p.status).toBe("achieved");
    expect(p.years).toBeCloseTo(1_000 / 1_500, 9);
  });

  it("payback mid-horizon is interpolated", () => {
    // extra 4,500, saving 1,000/yr: crosses in Year 5: 4 + 500/1,000 = 4.5 (horizon 8)
    expect(build(4_500, 1_000, 8).simplePayback.years).toBeCloseTo(4.5, 9);
  });

  it("payback exactly at the horizon counts as achieved, and equals the horizon", () => {
    // extra 5,000, saving 1,000/yr, horizon 5: running total reaches exactly 0 at Year 5.
    const p = build(5_000, 1_000, 5).simplePayback;
    expect(p.status).toBe("achieved");
    expect(p.years).toBeCloseTo(5, 9);
  });

  it("no payback within the horizon is 'not_achieved' with null years, never zero", () => {
    const p = build(5_001, 1_000, 5).simplePayback;
    expect(p.status).toBe("not_achieved");
    expect(p.years).toBeNull();
    expect(p.sustained).toBeNull();
  });

  it("discounted payback is later than simple payback, or not achieved when discounting removes the gain", () => {
    const flat = build(4_000, 1_000, 6, 10);
    expect(flat.simplePayback.status).toBe("achieved"); // 4 years undiscounted
    expect(flat.simplePayback.years).toBeCloseTo(4, 9);
    expect(flat.discountedPayback.status).toBe("achieved");
    expect(flat.discountedPayback.years!).toBeGreaterThan(4);
    const tough = build(5_000, 1_000, 5, 10);
    expect(tough.simplePayback.status).toBe("achieved");
    expect(tough.discountedPayback.status).toBe("not_achieved");
    expect(tough.discountedPayback.years).toBeNull();
  });

  it("a payback that is not sustained after later replacement costs is flagged", () => {
    const r = run(
      makeInput({
        fleet: { fleetSize: 1 },
        operations: { annualDistanceKmPerVehicle: 10_000, fleetAnnualDistanceKm: 10_000, analysisHorizonYears: 6 },
        bev: { batteryReplacement: { expected: "yes", year: 5, cost: 20_000 } },
      }),
    );
    expect(r.bevVsDiesel.simplePayback.status).toBe("achieved");
    expect(r.bevVsDiesel.simplePayback.sustained).toBe(false);
    expect(r.warnings.some((w) => w.code === "PAYBACK_NOT_SUSTAINED")).toBe(true);
  });
});

describe("Cost-per-km validation", () => {
  it("scales with distance, not with fleet size (identical vehicles)", () => {
    const one = run(makeInput({ fleet: { fleetSize: 1 }, operations: { annualDistanceKmPerVehicle: 10_000, fleetAnnualDistanceKm: 10_000 } }));
    const four = run(makeInput({ fleet: { fleetSize: 4 }, operations: { annualDistanceKmPerVehicle: 10_000, fleetAnnualDistanceKm: 40_000 } }));
    expect(four.metadata.fleetHorizonDistanceKm).toBe(4 * one.metadata.fleetHorizonDistanceKm);
    expect(four.diesel.tcoPerKm).toBeCloseTo(one.diesel.tcoPerKm, 9);
    expect(four.diesel.undiscountedTco).toBeCloseTo(4 * one.diesel.undiscountedTco, 6);
  });

  it("uses the horizon distance for every technology", () => {
    const r = run(simple());
    expect(r.diesel.fleetHorizonDistanceKm).toBe(60_000);
    expect(r.bev.fleetHorizonDistanceKm).toBe(60_000);
    expect(r.biofuel.fleetHorizonDistanceKm).toBe(60_000);
  });

  it("zero or missing distance is rejected by the engine, never divided by", () => {
    for (const bad of [0, -5, Number.NaN, null as unknown as number]) {
      const out = calculateAssessment(makeInput({ operations: { annualDistanceKmPerVehicle: bad } }));
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.errors.some((e) => e.field === "operations.annualDistanceKmPerVehicle")).toBe(true);
    }
  });

  it("a very small distance still gives finite figures", () => {
    const r = run(makeInput({ operations: { annualDistanceKmPerVehicle: 1e-6, fleetAnnualDistanceKm: 1e-6 } }));
    expect(Number.isFinite(r.diesel.tcoPerKm)).toBe(true);
    expect(Number.isFinite(r.bev.presentCostPerKm)).toBe(true);
  });
});

describe("Charging-loss validation: grid energy = delivered energy / (1 - loss)", () => {
  const grid = (lossPct: number | null) => run(makeInput({ bev: { chargingLossPct: lossPct, energyConsumptionKwhPer100Km: 20 } })).bev.energy;
  // Base fixture: 1 vehicle, 10,000 km/yr; delivered = 10,000 x 0.20 = 2,000 kWh.

  it("0% loss: grid = delivered", () => {
    expect(grid(0).fleetQuantityYear1).toBeCloseTo(2_000, 9);
    expect(grid(0).chargingLossRate).toBe(0);
  });

  it("10% loss: grid = 2,000 / 0.9 = 2,222.22 (not 2,000 x 1.1 = 2,200)", () => {
    expect(grid(10).fleetQuantityYear1).toBeCloseTo(2_000 / 0.9, 9);
    expect(grid(10).fleetQuantityYear1).not.toBeCloseTo(2_200, 1);
    expect(grid(10).vehicleDeliveredKwhFleetYear1).toBeCloseTo(2_000, 9);
  });

  it("50% loss doubles the grid energy", () => {
    expect(grid(50).fleetQuantityYear1).toBeCloseTo(4_000, 9);
  });

  it("near the upper boundary (99.9%) the result is large but finite", () => {
    const e = grid(99.9).fleetQuantityYear1;
    expect(Number.isFinite(e)).toBe(true);
    expect(e).toBeCloseTo(2_000 / 0.001, 4);
  });

  it("100%, above 100% and negative loss are rejected, never divided by", () => {
    for (const bad of [100, 100.0001, 150, -0.1, -50]) {
      const out = calculateAssessment(makeInput({ bev: { chargingLossPct: bad } }));
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.errors.some((e) => e.field === "bev.chargingLossPct")).toBe(true);
    }
  });

  it("a blank loss is 'not modelled' and disclosed, which is not the same as an entered 0%", () => {
    const blank = run(makeInput({ bev: { chargingLossPct: null } }));
    expect(blank.assumptions.find((a) => a.id === "bev_charging_loss")?.status).toBe("missing");
    expect(blank.warnings.some((w) => w.code === "CHARGING_LOSS_NOT_MODELLED")).toBe(true);
    const zero = run(makeInput({ bev: { chargingLossPct: 0 } }));
    expect(zero.assumptions.find((a) => a.id === "bev_charging_loss")?.status).toBe("user_input");
    expect(zero.warnings.some((w) => w.code === "CHARGING_LOSS_NOT_MODELLED")).toBe(false);
  });

  it("electricity cost follows the grid energy", () => {
    const r = run(makeInput({ bev: { chargingLossPct: 20, energyConsumptionKwhPer100Km: 20, electricityTariffPerKwh: 0.5 } }));
    expect(r.bev.year1EnergyCost).toBeCloseTo((2_000 / 0.8) * 0.5, 9);
  });
});
