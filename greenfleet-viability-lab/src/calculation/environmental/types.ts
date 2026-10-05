import type { CalcWarning, AssumptionRecord, TechId } from "../types";

/**
 * Environmental performance: ESTIMATED OPERATIONAL ENERGY/FUEL-RELATED GHG EMISSIONS, expressed as
 * CO2-equivalent (CO2e) where the supplied factors are on that basis.
 *
 * This is NOT a life-cycle assessment. Vehicle manufacturing, battery manufacturing, disposal and
 * infrastructure embodied emissions are outside the scope. Physical quantities (litres, kWh) are
 * multiplied by an emission factor the USER supplied; GreenFleet ships no factors of its own.
 *
 * Canonical units inside the engine: kg CO2e (tonnes and g are display or input conversions only),
 * litres / kg / m3 for fuel, kWh for electricity, km for distance.
 */

export type PhysicalUnit = "litre" | "kg" | "m3" | "kWh";

/** What the user said the factor covers. */
export type EmissionScope = "direct" | "fuel_cycle" | "lifecycle" | "not_stated";

export const SCOPE_LABEL: Record<EmissionScope, string> = {
  direct: "Direct operational emissions",
  fuel_cycle: "Energy/fuel-cycle emissions",
  lifecycle: "Lifecycle emissions (as declared for the factor)",
  not_stated: "Scope of the factor not stated",
};

export interface FactorUsed {
  /** Exactly what the user entered, in the unit they entered it. */
  enteredValue: number;
  enteredUnit: string;
  /** The same factor converted to kg CO2e (or kg CO2) per physical unit; the number used in calculations. */
  kgPerUnit: number;
  perUnit: PhysicalUnit;
  gas: "CO2e" | "CO2";
  source: string | null;
  sourceYear: number | null;
  notes: string | null;
  /** There are no built-in or default factors, so every factor is supplied by the user. */
  origin: "user_supplied";
  /** True only when a source or reference was written down. A year or a note alone is not a source. */
  hasProvenance: boolean;
  scope: EmissionScope;
  scopeLabel: string;
  /** Recorded from the input but deliberately not applied; see LIFECYCLE_ADJUSTMENT_NOT_APPLIED. */
  lifecycleAdjustmentPct: number | null;
  lifecycleAdjustmentApplied: false;
}

export interface PhysicalUse {
  unit: PhysicalUnit;
  /** Quantity bought each year, index 0..T (index 0 = Year 0 = nothing). */
  byYear: number[];
  annualQuantity: number;
}

export interface TechnologyEmissions {
  technology: TechId;
  /** "unavailable" never means zero: it means nothing could be calculated and `unavailableReason` says why. */
  status: "calculated" | "unavailable";
  unavailableReason: string | null;
  /** The physical quantity is known even when no factor was supplied. */
  physicalUse: PhysicalUse;
  annualEmissionsKg: number | null;
  annualEmissionsTonnes: number | null;
  horizonEmissionsKg: number | null;
  horizonEmissionsTonnes: number | null;
  /** kg CO2e per km driven by the whole fleet. */
  emissionsPerKmKg: number | null;
  byYearKg: number[] | null;
  factor: FactorUsed | null;
  scopeLabel: string;
  warnings: CalcWarning[];
}

export type EmissionDirection = "lower" | "higher" | "unchanged" | "undefined";

export interface EmissionsComparison {
  technology: Exclude<TechId, "diesel">;
  status: "calculated" | "unavailable";
  unavailableReason: string | null;
  /** diesel - alternative. Positive = the alternative emits less. */
  absoluteDifferenceAnnualKg: number | null;
  absoluteDifferenceAnnualTonnes: number | null;
  absoluteDifferenceHorizonTonnes: number | null;
  /** (diesel - alternative) / diesel x 100. Positive = lower than diesel. Null when diesel emissions are zero. */
  percentageChange: number | null;
  direction: EmissionDirection;
  /** "Emissions reduction" or "Emissions increase": a negative result is never called a reduction. */
  label: string | null;
  /** Whether the two factors cover the same thing, or null when either scope is not stated. */
  sameStatedScope: boolean | null;
}

export type EnvironmentalCompleteness = "complete" | "partial" | "unavailable";

export interface EnvironmentalPerformanceResult {
  scopeStatement: string;
  diesel: TechnologyEmissions;
  bev: TechnologyEmissions;
  biofuel: TechnologyEmissions;
  bevVsDiesel: EmissionsComparison;
  biofuelVsDiesel: EmissionsComparison;
  dataCompleteness: { state: EnvironmentalCompleteness; calculated: TechId[]; unavailable: TechId[] };
  warnings: CalcWarning[];
  assumptions: AssumptionRecord[];
  notes: string[];
}
