import { blankValue } from "./blank";
import { checkAssessment, type FieldIssue } from "./checks";
import { createReader } from "./reader";
import { FIELDS, FIELD_BY_ID } from "./schema/fields";
import { SECTION_BY_ID } from "./schema/sections";
import { isQNumber } from "./shapes";
import { ASSESSMENT_STEPS, type StepId } from "./steps";
import type { Assessment } from "./stored";

export type StepState = "not_started" | "in_progress" | "complete";

export interface StepCompletion {
  stepId: StepId;
  state: StepState;
  errors: FieldIssue[];
  warnings: FieldIssue[];
  /** Required inputs currently shown on this step, and how many already have a valid entry. */
  requiredTotal: number;
  requiredDone: number;
}

const INPUT_STEPS = ASSESSMENT_STEPS.filter((s) => s.id !== "review");

/** Environmental fields are optional for the commercial analysis, so they never block a step. */
const isEnvironmental = (fieldId: string) => FIELD_BY_ID[fieldId]?.section === "fin-env";

export function stepCompletions(a: Assessment, issues: readonly FieldIssue[] = checkAssessment(a)): StepCompletion[] {
  const r = createReader(a);
  return INPUT_STEPS.map((step) => {
    const stepIssues = issues.filter((i) => i.stepId === step.id);
    const errors = stepIssues.filter((i) => i.severity === "error");
    const warnings = stepIssues.filter((i) => i.severity === "warning");
    const visible = FIELDS.filter((f) => f.step === step.id && r.isVisible(f.id) && !isEnvironmental(f.id));
    const required = visible.filter((f) => f.required);
    const failing = new Set(errors.map((e) => e.fieldId));
    const requiredDone = required.filter((f) => !failing.has(f.id) && isFilled(a, f.id)).length;
    const touched = visible.some((f) => JSON.stringify(a.inputs[f.id]) !== JSON.stringify(blankValue(f)) && isFilled(a, f.id));
    const state: StepState = errors.length === 0 ? "complete" : touched ? "in_progress" : "not_started";
    return { stepId: step.id, state, errors, warnings, requiredTotal: required.length, requiredDone };
  });
}

function isFilled(a: Assessment, id: string): boolean {
  const def = FIELD_BY_ID[id]!;
  const raw = a.inputs[id];
  switch (def.kind) {
    case "text":
      return typeof raw === "string" && raw.trim() !== "";
    case "number":
    case "choice":
      return typeof raw === "object" && raw !== null && "status" in raw && raw.status === "value";
    case "qnumber":
      return isQNumber(raw) && raw.value.status === "value";
  }
}

export type EnvironmentalState = "complete" | "partial" | "not_started";

export interface Readiness {
  /** True when every required commercial input is present and valid. */
  commercialReady: boolean;
  environmental: EnvironmentalState;
  missingRequired: { fieldId: string; label: string; stepId: StepId; sectionId: string; sectionTitle: string }[];
  blockingIssues: FieldIssue[];
  /** One line per remaining gap, in plain language, most important first. */
  summary: string[];
}

const EF_VALUE_IDS = ["env.diesel.value", "env.grid.value", "env.biofuel.value"] as const;

export function assessReadiness(a: Assessment, issues: readonly FieldIssue[] = checkAssessment(a)): Readiness {
  const errors = issues.filter((i) => i.severity === "error" && !isEnvironmental(i.fieldId));
  const missingRequired = errors
    .filter((e) => e.code === "missing")
    .map((e) => ({ fieldId: e.fieldId, label: FIELD_BY_ID[e.fieldId]?.label ?? e.fieldId, stepId: e.stepId, sectionId: e.sectionId, sectionTitle: SECTION_BY_ID[e.sectionId]?.title ?? "" }));

  const filledEf = EF_VALUE_IDS.filter((id) => isFilled(a, id)).length;
  const environmental: EnvironmentalState = filledEf === EF_VALUE_IDS.length ? "complete" : filledEf === 0 ? "not_started" : "partial";

  const stepName = (s: StepId) => ASSESSMENT_STEPS.find((x) => x.id === s)?.title ?? s;
  const summary: string[] = [];
  const byStep = new Map<StepId, number>();
  for (const e of errors) byStep.set(e.stepId, (byStep.get(e.stepId) ?? 0) + 1);
  for (const [step, n] of byStep) summary.push(`${stepName(step)}: ${n} ${n === 1 ? "input needs" : "inputs need"} attention`);
  if (errors.length === 0) summary.push("Ready for commercial analysis");
  if (environmental === "complete") summary.push("Environmental comparison inputs complete");
  else if (environmental === "partial") summary.push("Environmental comparison incomplete: some emission factors are missing");
  else summary.push("Environmental comparison not started (optional for the commercial analysis)");

  return { commercialReady: errors.length === 0, environmental, missingRequired, blockingIssues: errors, summary };
}
