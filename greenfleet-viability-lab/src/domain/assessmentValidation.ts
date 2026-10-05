import { getNumeric, getText } from "./assessment";
import { fieldsForStep } from "./fields";
import { valueOrUndefined } from "./fieldValue";
import { ASSESSMENT_STEPS, type StepId } from "./steps";
import type { Assessment } from "./types";
import { validateCurrency, validateNumeric, type ValidationIssue } from "./validation";

/** Cross-field checks that a single-field rule cannot express. */
function crossFieldIssues(a: Assessment, stepId: StepId): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (stepId === "finance") {
    const financed = valueOrUndefined(getNumeric(a, ["financing", "financedSharePct"]));
    const term = getNumeric(a, ["financing", "loanTermYears"]);
    if (financed !== undefined && financed > 0 && term.status !== "value") {
      issues.push({
        fieldId: "financing.loanTermYears",
        code: "missing",
        severity: "error",
        message: "Loan term is required because part of the purchase is financed.",
      });
    }
  }
  if (stepId === "biofuel") {
    const blend = valueOrUndefined(getNumeric(a, ["technologies", "biofuel", "blendSharePct"]));
    const approved = valueOrUndefined(getNumeric(a, ["technologies", "biofuel", "approvedMaxBlendPct"]));
    if (blend !== undefined && approved !== undefined && blend > approved) {
      issues.push({
        fieldId: "technologies.biofuel.blendSharePct",
        code: "above_max",
        severity: "error",
        message: "Biofuel share of blend cannot exceed the maximum blend approved for the engine.",
      });
    }
  }
  return issues;
}

export function validateStep(a: Assessment, stepId: StepId): ValidationIssue[] {
  const { numeric, text } = fieldsForStep(stepId);
  const issues: ValidationIssue[] = [];
  if (stepId === "business") issues.push(...validateCurrency("currency", a.currency));
  for (const f of text) {
    if (f.required && getText(a, f.path).trim() === "") {
      issues.push({ fieldId: f.id, code: "missing", severity: "error", message: `${f.label} is required.` });
    }
  }
  for (const f of numeric) issues.push(...validateNumeric(f.id, getNumeric(a, f.path), f.rule, a.currency));
  issues.push(...crossFieldIssues(a, stepId));
  return issues;
}

export type StepState = "not_started" | "in_progress" | "complete";

export interface StepCompletion {
  stepId: StepId;
  state: StepState;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

/**
 * "not_started": nothing entered. "complete": no blocking errors. Anything else is in progress.
 * Entering 0 counts as entering something.
 */
export function stepCompletion(a: Assessment, stepId: StepId): StepCompletion {
  const issues = validateStep(a, stepId);
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const { numeric, text } = fieldsForStep(stepId);
  const touched =
    numeric.some((f) => getNumeric(a, f.path).status !== "missing") ||
    text.some((f) => getText(a, f.path).trim() !== "");
  const state: StepState = errors.length === 0 ? "complete" : touched ? "in_progress" : "not_started";
  return { stepId, state, errors, warnings };
}

export function assessmentCompletion(a: Assessment): StepCompletion[] {
  return ASSESSMENT_STEPS.filter((s) => s.id !== "review").map((s) => stepCompletion(a, s.id));
}

export const isAssessmentReady = (a: Assessment): boolean => assessmentCompletion(a).every((s) => s.state === "complete");
