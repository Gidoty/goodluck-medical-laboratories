import type { CurrencyCode } from "@/lib/currency";
import type { FuelUnit } from "@/lib/fuel";

/**
 * NormalizedAssessmentInput: the contract between the input system and the calculation engine.
 *
 * Every number is already validated, in the canonical unit named in its field name or comment, and
 * free of formatting. Optional inputs are `null` when the user left them blank, marked them not
 * applicable, or when they were hidden by another answer. `inputStatus` records which, so the
 * calculation stage can decide explicitly how to treat each gap. Nothing here assumes a default.
 *
 * Canonical units: money = whole units of `meta.currency`; distance = km; electricity = kWh;
 * mass = kg; time = years (hours where stated); percentages = 0..100 (never 0..1); fuel use =
 * fuel units per 100 km. Documented in full in docs/NORMALIZED_INPUT.md.
 */

export type InputStatus = "value" | "missing" | "not_applicable" | "hidden";
export type YesNoUnknown = "yes" | "no" | "unknown";

export interface ResidualValueInput {
  /** "amount": a fixed money amount per vehicle. "percent_of_acquisition": share of the acquisition price. */
  kind: "amount" | "percent_of_acquisition";
  amount: number | null;
  percent: number | null;
}

/** Cost items every vehicle pathway shares. */
export interface VehicleCostInput {
  /** Per vehicle, money. Diesel and BEV: acquisition price. Biofuel: acquisition price (new) or conversion cost (conversion). */
  upfrontVehicleCost: number;
  annualMaintenanceCost: number; // money / vehicle / year
  usefulLifeYears: number;
  residualValue: ResidualValueInput | null;
  annualInsurance: number | null; // money / vehicle / year
  annualRegistration: number | null; // money / vehicle / year
  otherFixedAnnualCost: number | null; // money / vehicle / year
  otherVariableCostPerKm: number | null; // money / km
}

export interface DieselInput extends VehicleCostInput {
  fuelPricePerLitre: number;
  fuelConsumptionLitresPer100Km: number;
  fuelPriceEscalationPctPerYear: number | null;
}

export interface BevInput extends VehicleCostInput {
  electricityTariffPerKwh: number;
  energyConsumptionKwhPer100Km: number; // at the vehicle, before charging losses
  usableRangeKm: number;
  batteryCapacityKwh: number | null;
  chargingLossPct: number | null;
  electricityPriceEscalationPctPerYear: number | null;
  batteryReplacement: { expected: YesNoUnknown | null; year: number | null; cost: number | null };
  operational: {
    chargingOpportunity: string | null;
    chargingDowntimeHoursPerDay: number | null;
    payloadImpact: "none" | "reduced" | "unknown" | null;
    payloadReductionKg: number | null;
    payloadReductionPct: number | null;
  };
}

export interface BiofuelInput extends VehicleCostInput {
  pathway: string;
  /** Biofuel share by volume for blend pathways, otherwise null. */
  blendPct: number | null;
  /** Unit the fuel is bought and burned in. Prices and consumption below use this unit. */
  fuelUnit: FuelUnit;
  acquisition: { mode: "new_vehicle" | "conversion"; existingVehicleValue: number | null };
  fuelPricePerFuelUnit: number;
  fuelConsumptionFuelUnitsPer100Km: number;
  fuelPriceEscalationPctPerYear: number | null;
  incrementalMaintenance: { kind: "amount_per_year" | "percent_of_maintenance"; amount: number | null; percent: number | null } | null;
  supply: {
    availability: string | null;
    additionalRefuellingKmPerDay: number | null;
    downtimeHoursPerMonth: number | null;
    specialInfrastructure: YesNoUnknown | null;
  };
}

export interface IncentiveInput {
  type: "none" | "upfront_grant" | "percent_subsidy" | "tax_credit" | "other" | null;
  /** Money per vehicle, for grant / tax credit / other. */
  amount: number | null;
  /** Share of purchase price, for percentage subsidy. */
  percentOfPurchasePrice: number | null;
}

export type EmissionScopeInput = "direct" | "fuel_cycle" | "lifecycle";

export interface EmissionFactorInput {
  value: number | null;
  /** Display label of the unit, e.g. "kg CO2e/litre". */
  unit: string;
  /** Machine-readable unit id, e.g. "kgco2e_per_litre". The engine checks it against the quantity it is applied to. */
  unitId: string;
  /** What the factor covers, if the user said. Null means not stated. */
  scope: EmissionScopeInput | null;
  source: string | null;
  sourceYear: number | null;
  notes: string | null;
  lifecycleAdjustmentPct: number | null;
}

export interface NormalizedAssessmentInput {
  schemaVersion: 1;
  meta: {
    assessmentId: string;
    assessmentName: string;
    scenarioName: string;
    currency: CurrencyCode;
    dataOrigin: "blank" | "demo" | "user";
    /** Ids of inputs still holding an unedited illustrative demo value. Empty for real assessments. */
    illustrativeInputs: string[];
    updatedAt: string;
  };
  business: { businessName: string | null; businessType: string | null; country: string | null; operatingLocation: string | null };
  fleet: { fleetSize: number; vehicleCategory: string | null; payloadCapacityKg: number | null; averagePayloadKg: number | null };
  operations: {
    distanceInputMode: "daily" | "annual";
    dailyDistanceKm: number; // per vehicle; derived when annual distance was entered
    operatingDaysPerYear: number;
    annualDistanceKmPerVehicle: number; // derived when daily distance was entered
    fleetAnnualDistanceKm: number;
    operatingPattern: string | null;
    averageRouteDistanceKm: number | null;
    averageTripsPerDay: number | null;
    analysisHorizonYears: number;
  };
  diesel: DieselInput;
  bev: BevInput;
  biofuel: BiofuelInput;
  finance: {
    structure: "equity_100" | "debt_equity" | "debt_100" | "custom";
    debtSharePct: number;
    equitySharePct: number;
    interestRatePct: number | null; // null when there is no debt
    loanTenorYears: number | null;
    loanFees: number | null;
    discountRatePct: number;
    incentives: { diesel: IncentiveInput; bev: IncentiveInput; biofuel: IncentiveInput };
  };
  infrastructure: {
    bevCharging: {
      arrangement: string | null;
      investmentRequired: boolean;
      equipmentCost: number | null;
      installationCost: number | null;
      electricalUpgradeCost: number | null;
      numberOfChargers: number | null;
      vehiclesSharing: number | null;
      usefulLifeYears: number | null;
      annualMaintenanceCost: number | null;
      otherAnnualCost: number | null;
      utilisationPct: number | null;
    };
    biofuel: {
      investmentRequired: YesNoUnknown | null;
      storageEquipmentCost: number | null;
      refuellingInfrastructureCost: number | null;
      installationCost: number | null;
      annualMaintenanceCost: number | null;
      usefulLifeYears: number | null;
    };
  };
  environmentalAssumptions: {
    diesel: EmissionFactorInput; // unit: kg CO2e / litre
    gridElectricity: EmissionFactorInput; // unit: kg CO2e / kWh
    biofuel: EmissionFactorInput; // unit: kg CO2e / `biofuel.fuelUnit`
  };
  /** Optional source metadata the user attached to volatile inputs, keyed by field id. */
  provenance: Record<string, { source: string | null; reference: string | null; year: number | null }>;
  /** Per-field entry status for every visible and hidden input, for auditing gaps. */
  inputStatus: Record<string, InputStatus>;
}
