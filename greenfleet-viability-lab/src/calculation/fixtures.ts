import type { NormalizedAssessmentInput } from "@/domain/normalized";

/**
 * Synthetic inputs for tests. Every number is in ABSTRACT currency units chosen so the arithmetic
 * can be done by hand. None of it is Nigerian (or any other) market data.
 *
 * VERIFICATION CASE 1 (the default), discount rate 0%, horizon 5 years, 1 vehicle, 10,000 km/year:
 *
 *   Diesel   10 km/litre -> 1,000 litres/yr x 1.00 = 1,000 fuel + 500 maintenance = 1,500/yr
 *            buy 10,000, resale 2,000            -> TCO = 10,000 + 5 x 1,500 - 2,000 = 15,500
 *   BEV      1 kWh/km    -> 10,000 kWh/yr x 0.05 =   500 energy + 200 maintenance =   700/yr
 *            buy 13,000, resale 3,000            -> TCO = 13,000 + 5 x   700 - 3,000 = 13,500
 *   Biofuel  8 km/litre  -> 1,250 litres/yr x 0.80 = 1,000 energy + 550 maintenance = 1,550/yr
 *            buy 10,500, resale 2,000            -> TCO = 10,500 + 5 x 1,550 - 2,000 = 16,250
 *
 *   BEV vs diesel:     Year 0 = -3,000; years 1-4 = +800; year 5 = +800 + (3,000 - 2,000) = +1,800
 *                      NPV = 2,000; running total -3,000, -2,200, -1,400, -600, +200
 *                      simple payback = 3 + 600/800 = 3.75 years; break-even distance = 37,500 km
 *   Biofuel vs diesel: Year 0 = -500; years 1-5 = -50 (extra running cost); resale cancels
 *                      NPV = -750; payback not achieved
 */
export function baseInput(): NormalizedAssessmentInput {
  const noInfra = {
    arrangement: "existing_access",
    investmentRequired: false,
    equipmentCost: null,
    installationCost: null,
    electricalUpgradeCost: null,
    numberOfChargers: null,
    vehiclesSharing: null,
    usefulLifeYears: null,
    annualMaintenanceCost: null,
    otherAnnualCost: null,
    utilisationPct: null,
  };
  const noIncentive = { type: null, amount: null, percentOfPurchasePrice: null } as const;
  const emission = (unit: string, unitId: string) => ({ value: null, unit, unitId, scope: null, source: null, sourceYear: null, notes: null, lifecycleAdjustmentPct: null });
  const costs = { annualInsurance: null, annualRegistration: null, otherFixedAnnualCost: null, otherVariableCostPerKm: null };
  return {
    schemaVersion: 1,
    meta: { assessmentId: "test", assessmentName: "Synthetic test case", scenarioName: "Base", currency: "NGN", dataOrigin: "user", illustrativeInputs: [], updatedAt: "2026-01-01T00:00:00.000Z" },
    business: { businessName: null, businessType: null, country: null, operatingLocation: null },
    fleet: { fleetSize: 1, vehicleCategory: null, payloadCapacityKg: null, averagePayloadKg: null },
    operations: { distanceInputMode: "daily", dailyDistanceKm: 100, operatingDaysPerYear: 100, annualDistanceKmPerVehicle: 10000, fleetAnnualDistanceKm: 10000, operatingPattern: null, averageRouteDistanceKm: null, averageTripsPerDay: null, analysisHorizonYears: 5 },
    diesel: { upfrontVehicleCost: 10000, annualMaintenanceCost: 500, usefulLifeYears: 10, residualValue: { kind: "amount", amount: 2000, percent: null }, ...costs, fuelPricePerLitre: 1, fuelConsumptionLitresPer100Km: 10, fuelPriceEscalationPctPerYear: null },
    bev: {
      upfrontVehicleCost: 13000, annualMaintenanceCost: 200, usefulLifeYears: 10, residualValue: { kind: "amount", amount: 3000, percent: null }, ...costs,
      electricityTariffPerKwh: 0.05, energyConsumptionKwhPer100Km: 100, usableRangeKm: 500, batteryCapacityKwh: null, chargingLossPct: null, electricityPriceEscalationPctPerYear: null,
      batteryReplacement: { expected: "no", year: null, cost: null },
      operational: { chargingOpportunity: null, chargingDowntimeHoursPerDay: null, payloadImpact: null, payloadReductionKg: null, payloadReductionPct: null },
    },
    biofuel: {
      upfrontVehicleCost: 10500, annualMaintenanceCost: 550, usefulLifeYears: 10, residualValue: { kind: "amount", amount: 2000, percent: null }, ...costs,
      pathway: "biodiesel_blend", blendPct: 20, fuelUnit: "litre", acquisition: { mode: "new_vehicle", existingVehicleValue: null },
      fuelPricePerFuelUnit: 0.8, fuelConsumptionFuelUnitsPer100Km: 12.5, fuelPriceEscalationPctPerYear: null, incrementalMaintenance: null,
      supply: { availability: "reliable", additionalRefuellingKmPerDay: null, downtimeHoursPerMonth: null, specialInfrastructure: "no" },
    },
    finance: {
      structure: "equity_100", debtSharePct: 0, equitySharePct: 100, interestRatePct: null, loanTenorYears: null, loanFees: null, discountRatePct: 0,
      incentives: { diesel: { ...noIncentive }, bev: { ...noIncentive }, biofuel: { ...noIncentive } },
    },
    infrastructure: {
      bevCharging: noInfra,
      biofuel: { investmentRequired: "no", storageEquipmentCost: null, refuellingInfrastructureCost: null, installationCost: null, annualMaintenanceCost: null, usefulLifeYears: null },
    },
    environmentalAssumptions: { diesel: emission("kg CO2e/litre", "kgco2e_per_litre"), gridElectricity: emission("kg CO2e/kWh", "kgco2e_per_kwh"), biofuel: emission("kg CO2e/litre", "kgco2e_per_litre") },
    provenance: {},
    inputStatus: {},
  };
}

type Patch<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends readonly unknown[] ? T[K] : Patch<T[K]> | null) : T[K] };

const isPlain = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === "object" && !Array.isArray(x);

/** Recursively overlays a patch on the base input. `null` in a patch sets a null, objects merge. */
export function makeInput(patch: Patch<NormalizedAssessmentInput> = {}): NormalizedAssessmentInput {
  const merge = (base: unknown, over: unknown): unknown => {
    if (!isPlain(base) || !isPlain(over)) return over;
    const out: Record<string, unknown> = { ...base };
    for (const [k, v] of Object.entries(over)) out[k] = k in base ? merge(base[k], v) : v;
    return out;
  };
  return merge(baseInput(), patch) as NormalizedAssessmentInput;
}

/** Recursively freezes a value so any attempt to change it throws in strict mode. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}
