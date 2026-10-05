import { calculateAssessment } from "@/calculation/engine";
import type { AssessmentCalculationResult, CalculationError } from "@/calculation/types";
import { normalizeAssessment } from "./normalize";
import type { FieldIssue } from "./checks";
import type { NormalizedAssessmentInput } from "./normalized";
import type { Assessment } from "./stored";

export type RunOutcome =
  | { status: "invalid_inputs"; issues: FieldIssue[] }
  | { status: "calculation_error"; errors: CalculationError[] }
  | { status: "ok"; input: NormalizedAssessmentInput; result: AssessmentCalculationResult };

/**
 * Stored assessment -> validated, normalized input -> calculation. A pure function: running it twice
 * on the same assessment gives the same answer, so results are recomputed whenever they are needed
 * and never stored.
 */
export function runAssessment(assessment: Assessment): RunOutcome {
  const normalized = normalizeAssessment(assessment);
  if (!normalized.ok) return { status: "invalid_inputs", issues: normalized.issues };
  const outcome = calculateAssessment(normalized.input);
  if (!outcome.ok) return { status: "calculation_error", errors: outcome.errors };
  return { status: "ok", input: normalized.input, result: outcome.result };
}
