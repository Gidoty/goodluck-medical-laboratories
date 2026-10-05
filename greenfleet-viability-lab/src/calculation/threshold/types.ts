import type { OperationalStatus } from "../operational/types";
import type { GreenTechId } from "../types";
import type { VariableId, ValueUnit } from "../analysis/variables";
import type { CommercialClassification, EconomicCase, ReasonCode } from "../viability/types";

export type ThresholdTarget = "economic_break_even" | "classification_transition";

/** Why a threshold was or was not produced. A failure state never carries a numeric threshold. */
export type ThresholdStatus =
  | "FOUND"
  | "ALREADY_SATISFIED"
  | "NOT_BRACKETED"
  | "NON_MONOTONIC"
  | "MAX_ITERATIONS"
  | "VERIFICATION_FAILED"
  | "INSUFFICIENT_DATA"
  | "NOT_APPLICABLE"
  | "BLOCKED_BY_OPERATIONAL_CONSTRAINT"
  | "BLOCKED_BY_OPEN_CONDITIONS";

/**
 * required: the value that must be reached to get the target.
 * headroom: the target already holds, and this is how far the variable can move before it stops holding.
 * at_threshold: the current value is already at the threshold.
 */
export type ThresholdKind = "required" | "headroom" | "at_threshold";

export interface SolverSettings {
  /** Bisection stops when the bracket is narrower than this fraction of max(1, |x|). */
  rootToleranceRelative: number;
  /** The target function counts as zero within this fraction of the diesel present cost. */
  valueToleranceFraction: number;
  /** Looser tolerance used to verify the solution by re-running the engine. */
  verifyToleranceFraction: number;
  maxIterations: number;
  /** The search step doubles each time until the target is bracketed or a solver bound is reached. */
  expansionFactor: number;
  maxExpansions: number;
  /** Intervals sampled across the bracket to check the function is monotonic. */
  monotonicSamples: number;
  /** Points scanned when searching for a change of classification. */
  scanPoints: number;
}

export const SOLVER_SETTINGS: SolverSettings = {
  rootToleranceRelative: 1e-10,
  valueToleranceFraction: 1e-9,
  verifyToleranceFraction: 1e-6,
  maxIterations: 100,
  expansionFactor: 2,
  maxExpansions: 60,
  monotonicSamples: 12,
  scanPoints: 48,
};

export interface SolverReport {
  method: "bisection" | "scan_and_bisection";
  iterations: number;
  evaluations: number;
  expansions: number;
  bounds: { lo: number; hi: number };
  bracket: [number, number] | null;
  monotonic: boolean | null;
  settings: SolverSettings;
}

export interface Outcome {
  npv: number;
  classification: CommercialClassification;
  economicCase: EconomicCase;
  operationalStatus: OperationalStatus;
  reasonCodes: ReasonCode[];
  decisionTrace: string[];
}

export interface RequiredChange {
  absolute: number;
  /** Null when the current value is zero. */
  percent: number | null;
  direction: "increase" | "decrease" | "none";
}

export interface TransitionInfo {
  from: CommercialClassification;
  to: CommercialClassification;
  /** The gate that moved: the economic case, the operational status, or both. */
  changedGate: "economic" | "operational" | "both" | "conditions";
  economicCase: { from: EconomicCase; to: EconomicCase };
  operationalStatus: { from: OperationalStatus; to: OperationalStatus };
  reasonCodesAdded: ReasonCode[];
  reasonCodesRemoved: ReasonCode[];
  explanation: string;
}

export interface Blockers {
  hardConstraints: { code: ReasonCode; text: string }[];
  conditions: { code: ReasonCode; text: string }[];
  uncertainties: { code: ReasonCode; text: string }[];
}

export interface ThresholdResult {
  status: ThresholdStatus;
  target: ThresholdTarget;
  thresholdKind: ThresholdKind | null;
  technology: GreenTechId;
  variableId: VariableId;
  variableLabel: string;
  unit: ValueUnit;
  currentValue: number | null;
  /** Full precision. Null for every failure state. */
  thresholdValue: number | null;
  /** The same value rounded for display, with the {cur} token where money is involved. */
  thresholdDisplay: string | null;
  currentDisplay: string | null;
  requiredChange: RequiredChange | null;
  before: Outcome | null;
  /** The authoritative engine re-run at the threshold. */
  after: Outcome | null;
  transition: TransitionInfo | null;
  blockers: Blockers;
  statement: string;
  caveats: string[];
  solver: SolverReport | null;
  allElseEqual: true;
  policyVersion: string;
}
