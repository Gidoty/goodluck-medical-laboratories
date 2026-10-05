import type { EnvironmentalCompleteness, EnvironmentalPerformanceResult } from "./environmental/types";
import type { CommercialViabilityResult } from "./viability/types";
import type { OperationalFeasibilityResult, OperationalStatus } from "./operational/types";

/**
 * Result model of the techno-economic engine.
 *
 * Canonical units used throughout the engine:
 *   money           whole units of `meta.currency` (nominal, as entered)
 *   distance        km
 *   liquid fuel     litres;  gaseous fuel: kg or m3 (per `energy.unit`)
 *   electricity     kWh
 *   rates           DECIMALS inside the engine (0.10 = 10%); the normalized input uses 0..100
 *   time            years; Year 0 is the purchase date, Year t is the end of operating year t
 *
 * Sign convention: costs are positive numbers, offsets (incentives, residual value) are negative
 * numbers inside a cost series. Incremental cash flow is positive when the green alternative is
 * cheaper than diesel in that year.
 */

export type TechId = "diesel" | "bev" | "biofuel";
export type GreenTechId = Exclude<TechId, "diesel">;

export const TECH_NAMES: Record<TechId, string> = {
  diesel: "Diesel (baseline)",
  bev: "Battery electric",
  biofuel: "Biofuel",
};

export type CostCategory =
  | "vehicleAcquisition"
  | "vehicleReplacement"
  | "infrastructureCapex"
  | "incentiveOffsets"
  | "energy"
  | "maintenance"
  | "insurance"
  | "licensing"
  | "otherFixed"
  | "otherVariable"
  | "infrastructureOpex"
  | "batteryReplacement"
  | "residualOffset";

export type CostKind = "capital" | "operating" | "offset";

export const COST_CATEGORIES: ReadonlyArray<{ id: CostCategory; label: string; kind: CostKind }> = [
  { id: "vehicleAcquisition", label: "Vehicle acquisition", kind: "capital" },
  { id: "vehicleReplacement", label: "Vehicle replacement", kind: "capital" },
  { id: "infrastructureCapex", label: "Infrastructure (capital)", kind: "capital" },
  { id: "batteryReplacement", label: "Battery replacement", kind: "capital" },
  { id: "energy", label: "Energy / fuel", kind: "operating" },
  { id: "maintenance", label: "Maintenance", kind: "operating" },
  { id: "insurance", label: "Insurance", kind: "operating" },
  { id: "licensing", label: "Licensing and registration", kind: "operating" },
  { id: "otherFixed", label: "Other fixed costs", kind: "operating" },
  { id: "otherVariable", label: "Other variable costs", kind: "operating" },
  { id: "infrastructureOpex", label: "Infrastructure (running)", kind: "operating" },
  { id: "incentiveOffsets", label: "Incentives (offset)", kind: "offset" },
  { id: "residualOffset", label: "Residual value (offset)", kind: "offset" },
];

export type CostVector = Record<CostCategory, number>;

export type WarningSeverity = "info" | "warning";
export type WarningScope = "general" | TechId | "bev_vs_diesel" | "biofuel_vs_diesel";

/** Which analytical layer a warning belongs to. Absent means the economic (Batch 3) layer. */
export type AnalysisDomain = "economic" | "environmental" | "operational";

export interface CalcWarning {
  code: string;
  severity: WarningSeverity;
  scope: WarningScope;
  message: string;
  domain?: AnalysisDomain;
}

export type AssumptionStatus = "user_input" | "derived" | "convention" | "missing" | "excluded";

export interface AssumptionRecord {
  id: string;
  group: "scope" | "operations" | "diesel" | "bev" | "biofuel" | "finance" | "infrastructure" | "environment" | "operational" | "method";
  label: string;
  /** Human-readable value. The token {cur} stands for the currency symbol, which the UI fills in. */
  value: string;
  unit?: string;
  status: AssumptionStatus;
  note?: string;
  /** Normalized-input field ids this record came from, so the UI can mark illustrative demo values. */
  fieldIds?: string[];
}

export interface YearlyCosts {
  year: number;
  components: CostVector;
  /** Sum of the operating categories (energy, maintenance, insurance, licensing, other fixed/variable, infrastructure running). */
  operatingCost: number;
  /** Everything paid or received in this year: capital + operating + offsets. */
  netCashCost: number;
  /** Fleet distance driven in this year (0 for Year 0). */
  fleetDistanceKm: number;
}

export interface EnergyUse {
  /** Unit of the fuel or energy that is bought. */
  unit: "litre" | "kg" | "m3" | "kWh";
  /** Fleet quantity bought in Year 1 (constant while utilisation is constant). */
  fleetQuantityYear1: number;
  unitPriceYear1: number;
  /** BEV only: energy the vehicles use, before charging losses. */
  vehicleDeliveredKwhFleetYear1?: number;
  /** BEV only: loss rate as a decimal, or null when no loss was entered (not modelled). */
  chargingLossRate?: number | null;
}

export interface TechnologyEconomics {
  technology: TechId;
  label: string;
  vehicleAcquisitionLabel: string;
  energy: EnergyUse;
  series: YearlyCosts[];
  /** Gross Year-0 purchase of vehicles and infrastructure, before incentives. */
  grossInitialCapex: number;
  /** Upfront incentives applied in Year 0 (positive number = money received). */
  upfrontIncentives: number;
  /** Year-0 net cash cost: what must be invested at the start. */
  initialCapitalRequirement: number;
  /** Fleet residual value credited at the end of the horizon. */
  residualValue: number;
  replacementYears: number[];
  batteryReplacementYears: number[];
  year1OperatingCost: number;
  year1EnergyCost: number;
  undiscountedTco: number;
  presentCost: number;
  fleetHorizonDistanceKm: number;
  tcoPerKm: number;
  presentCostPerKm: number;
  breakdown: { undiscounted: CostVector; present: CostVector };
}

export type PaybackStatus = "immediate" | "achieved" | "not_achieved";

export interface PaybackResult {
  status: PaybackStatus;
  /** Years from Year 0. 0 when `immediate`; null when `not_achieved`. Never infinity, never the horizon by default. */
  years: number | null;
  /** True when cumulative savings stay non-negative from the crossing to the end of the horizon. Null when not applicable. */
  sustained: boolean | null;
}

export interface CashFlowRow {
  year: number;
  dieselCost: number;
  greenCost: number;
  incrementalCashFlow: number;
  discountedIncrementalCashFlow: number;
  cumulativeIncrementalCashFlow: number;
  discountedCumulativeCashFlow: number;
}

export type NpvDirection = "advantage" | "indifferent" | "disadvantage";
export type SavingsDirection = "saving" | "additional_cost" | "none";

export interface OperatingSavings {
  /** Diesel operating cost minus green operating cost, years 1..T. Excludes capital, replacement and battery costs. */
  byYear: number[];
  year1: number;
  averageAnnual: number;
  cumulative: number;
  year1Direction: SavingsDirection;
}

export interface IncrementalAnalysis {
  technology: GreenTechId;
  /** Extra Year-0 investment needed versus diesel (negative = green is cheaper at Year 0). */
  additionalInitialInvestment: number;
  rows: CashFlowRow[];
  npv: number;
  npvDirection: NpvDirection;
  /** Sum of undiscounted incremental cash flows over the whole horizon. */
  cumulativeSavings: number;
  simplePayback: PaybackResult;
  discountedPayback: PaybackResult;
  breakEvenYear: number | null;
  breakEvenDistanceKm: number | null;
  operatingSavings: OperatingSavings;
}

export interface CalculationMetadata {
  engineVersion: string;
  assessmentId: string;
  assessmentName: string;
  currency: string;
  dataOrigin: "blank" | "demo" | "user";
  illustrativeInputs: string[];
  horizonYears: number;
  discountRate: number;
  fleetSize: number;
  annualDistancePerVehicleKm: number;
  fleetAnnualDistanceKm: number;
  fleetHorizonDistanceKm: number;
}

export type EconomicDataState = "complete" | "partial" | "insufficient";

/** Three separate data-completeness indicators. They are never merged into one percentage. */
export interface DataCompletenessSummary {
  /** Complete when no optional assumption that shapes the cost figures is missing or left out. */
  economic: { state: EconomicDataState; missing: string[] };
  operational: OperationalFeasibilityResult["dataCompleteness"];
  environmental: { state: EnvironmentalCompleteness; unavailable: TechId[] };
}

/**
 * What each analytical layer says about one alternative. The three answers are reported side by
 * side and never combined: a favourable NPV does not change an operational constraint, and lower
 * emissions do not change a negative NPV.
 */
export interface DimensionSummary {
  technology: GreenTechId;
  economic: { direction: NpvDirection; npv: number; label: string };
  operational: { status: OperationalStatus; label: string };
  environmental: { state: "lower" | "higher" | "unchanged" | "unavailable"; percentChange: number | null; label: string; reason: string | null };
}

export interface AssessmentCalculationResult {
  metadata: CalculationMetadata;
  diesel: TechnologyEconomics;
  bev: TechnologyEconomics;
  biofuel: TechnologyEconomics;
  bevVsDiesel: IncrementalAnalysis;
  biofuelVsDiesel: IncrementalAnalysis;
  warnings: CalcWarning[];
  assumptions: AssumptionRecord[];
  /** Assumptions that shaped the numbers: entered, derived, or fixed model conventions. */
  assumptionsUsed: AssumptionRecord[];
  /** Inputs that were missing or deliberately left out of the primary calculation. */
  assumptionsMissing: AssumptionRecord[];
  methodologyNotes: string[];
  /** Estimated operational energy/fuel-related GHG emissions. Independent of the financial figures. */
  environmental: EnvironmentalPerformanceResult;
  /** Rule-based operational feasibility. Independent of the financial figures. */
  operational: OperationalFeasibilityResult;
  dataCompleteness: DataCompletenessSummary;
  dimensions: Record<GreenTechId, DimensionSummary>;
  /** Batch 5: hierarchical, rule-based commercial classification of each green alternative against diesel. Diesel has none. */
  commercial: Record<GreenTechId, CommercialViabilityResult>;
}

export interface CalculationError {
  field: string;
  message: string;
}

export type CalculationOutcome = { ok: true; result: AssessmentCalculationResult } | { ok: false; errors: CalculationError[] };
