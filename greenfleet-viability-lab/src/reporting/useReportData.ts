"use client";

import { useMemo } from "react";
import { isUntouched } from "@/domain/mutations";
import { runAssessment } from "@/domain/runAssessment";
import type { NormalizedAssessmentInput } from "@/domain/normalized";
import type { AssessmentCalculationResult } from "@/calculation/types";
import type { Scenario } from "@/calculation/scenario";
import { resultFormatter, type ResultFormatter } from "@/components/results/format-results";
import { useAssessmentState } from "@/state/StoreProvider";
import { useAnalysisStore } from "@/state/useAnalysis";
import { useScenarios } from "@/state/useScenarios";
import { recordFor, type AnalysisRecord } from "./analysisRecord";

export type ReportData =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "incomplete"; count: number }
  | { status: "error"; messages: string[] }
  | { status: "ok"; input: NormalizedAssessmentInput; result: AssessmentCalculationResult; analysis: AnalysisRecord | null; scenarios: readonly Scenario[]; f: ResultFormatter };

/**
 * Everything the report and the presentation need, read from the one authoritative pipeline and from
 * the analyses the user has already run. Nothing is recalculated here beyond the Base Case itself,
 * which is the same calculation the Results page makes.
 */
export function useReportData(): ReportData {
  const { assessment, hydrated } = useAssessmentState();
  const { record } = useAnalysisStore();
  const { state: sc } = useScenarios();
  const run = useMemo(() => (hydrated ? runAssessment(assessment) : null), [assessment, hydrated]);
  if (!run) return { status: "loading" };
  if (run.status === "invalid_inputs") return isUntouched(assessment) ? { status: "empty" } : { status: "incomplete", count: run.issues.length };
  if (run.status === "calculation_error") return { status: "error", messages: run.errors.map((e) => e.message) };
  return { status: "ok", input: run.input, result: run.result, analysis: recordFor(record, run.input), scenarios: sc.scenarios, f: resultFormatter(run.input.meta.currency) };
}
