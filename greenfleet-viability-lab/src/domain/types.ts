import type { CurrencyCode } from "@/lib/currency";
import type { UnitId } from "@/lib/units";
import type { Assessment } from "./stored";

export type TechnologyId = "diesel" | "electric" | "biofuel";

export type { Assessment };

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
  /** Id of the input that is flexed (see domain/schema/fields.ts). */
  inputId: string;
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
