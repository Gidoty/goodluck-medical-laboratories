import type { CurrencyCode } from "@/lib/currency";
import type { UnitId } from "@/lib/units";
import type { NumericField } from "./fieldValue";

/* -------------------------------------------------------------------------- */
/* Inputs. Every numeric input is a NumericField (value | missing | N/A), in   */
/* the canonical unit documented in lib/units.ts. Money is in the assessment   */
/* currency.                                                                   */
/* -------------------------------------------------------------------------- */

export type TechnologyId = "diesel" | "electric" | "biofuel";

export interface BusinessProfile {
  businessName: string;
  operatingRegion: string;
  /** Number of vehicles in the fleet being assessed. */
  fleetSize: NumericField;
}

export interface OperationalProfile {
  dailyDistanceKm: NumericField;
  operatingDaysPerYear: NumericField;
  analysisHorizonYears: NumericField;
  /** Average payload carried as a share of rated payload. */
  loadFactorPct: NumericField;
}

/** Shared by all three pathways so comparison code can treat them uniformly. */
export interface VehicleTechnology {
  technology: TechnologyId;
  acquisitionCost: NumericField;
  lifetimeYears: NumericField;
  /** Resale value at end of lifetime as a share of acquisition cost. */
  residualValuePct: NumericField;
  maintenanceCostPerKm: NumericField;
  annualFixedCosts: NumericField;
  ratedPayloadKg: NumericField;
}

export interface DieselVehicle extends VehicleTechnology {
  technology: "diesel";
  fuelConsumptionLPer100Km: NumericField;
}

export interface ElectricVehicle extends VehicleTechnology {
  technology: "electric";
  energyConsumptionKwhPer100Km: NumericField;
  batteryCapacityKwh: NumericField;
  usableBatteryPct: NumericField;
  chargingLossPct: NumericField;
  batteryReplacementCost: NumericField;
}

export interface BiofuelVehicle extends VehicleTechnology {
  technology: "biofuel";
  /** Litres of biofuel blend per 100 km. */
  fuelConsumptionLPer100Km: NumericField;
  /** Biofuel share of the blend, by volume. */
  blendSharePct: NumericField;
  /** Maximum blend share approved for the engine. */
  approvedMaxBlendPct: NumericField;
}

export interface TechnologySet {
  diesel: DieselVehicle;
  electric: ElectricVehicle;
  biofuel: BiofuelVehicle;
}

export interface EnergyProfile {
  dieselPricePerLitre: NumericField;
  electricityPricePerKwh: NumericField;
  biofuelPricePerLitre: NumericField;
  dieselPriceEscalationPct: NumericField;
  electricityPriceEscalationPct: NumericField;
  biofuelPriceEscalationPct: NumericField;
}

export interface InfrastructureProfile {
  chargingInfrastructureCost: NumericField;
  vehiclesSharingChargers: NumericField;
  chargerPowerKw: NumericField;
  chargingHoursPerDay: NumericField;
  fuelStorageAndBlendingCost: NumericField;
}

export interface FinancingProfile {
  financedSharePct: NumericField;
  interestRatePct: NumericField;
  loanTermYears: NumericField;
  discountRatePct: NumericField;
}

export interface EnvironmentalAssumptions {
  dieselEmissionFactorKgCo2ePerLitre: NumericField;
  biofuelEmissionFactorKgCo2ePerLitre: NumericField;
  gridEmissionFactorKgCo2ePerKwh: NumericField;
}

export type DataOrigin = "blank" | "demo" | "user";

export interface Assessment {
  id: string;
  name: string;
  currency: CurrencyCode;
  /** Label of the scenario being edited. A saved Scenario wraps an Assessment snapshot. */
  scenarioName: string;
  /** "demo" while the loaded illustrative values are untouched; "user" once the user edits anything. */
  origin: DataOrigin;
  createdAt: string;
  updatedAt: string;
  business: BusinessProfile;
  operations: OperationalProfile;
  energy: EnergyProfile;
  technologies: TechnologySet;
  infrastructure: InfrastructureProfile;
  financing: FinancingProfile;
  environment: EnvironmentalAssumptions;
}

/* -------------------------------------------------------------------------- */
/* Scenarios and sensitivity (structure only; behaviour arrives in later       */
/* batches).                                                                   */
/* -------------------------------------------------------------------------- */

export interface Scenario {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  /** Immutable snapshot of the inputs this scenario evaluates. */
  assessment: Assessment;
}

export interface SensitivityVariable {
  id: string;
  label: string;
  unit: UnitId;
  /** Path to the input that is flexed, in dotted form (see domain/fields.ts). */
  inputPath: string;
  /** Lowest and highest values to test, in the input's canonical unit. */
  min: number;
  max: number;
  steps: number;
}

/* -------------------------------------------------------------------------- */
/* Outputs (shape only). Nothing in Batch 1 produces these.                    */
/* -------------------------------------------------------------------------- */

export type ViabilityStatus = "viable" | "conditionally_viable" | "not_yet_viable";

export interface TechnologyResult {
  technology: TechnologyId;
  totalCostOfOwnership: number;
  costPerKm: number;
  annualOperatingCost: number;
  annualEnergyCost: number;
  netPresentValue: number;
  /** null when the investment is not recovered within the horizon. */
  paybackYears: number | null;
  annualSavingsVsBaseline: number;
  annualEmissionsTonnesCo2e: number;
  cumulativeCashFlow: ReadonlyArray<number>;
}

export interface ViabilityResult {
  technology: Exclude<TechnologyId, "diesel">;
  status: ViabilityStatus;
  /** Plain-language reasons, each traceable to a named rule. */
  reasons: ReadonlyArray<{ ruleId: string; text: string }>;
}

export interface AssessmentResult {
  assessmentId: string;
  currency: CurrencyCode;
  computedAt: string;
  technologies: Record<TechnologyId, TechnologyResult>;
  viability: ReadonlyArray<ViabilityResult>;
}
