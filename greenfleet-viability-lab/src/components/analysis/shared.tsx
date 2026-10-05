"use client";

import { useMemo, type ReactNode } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { runAssessment } from "@/domain/runAssessment";
import { useAssessmentState } from "@/state/StoreProvider";
import { Calculator } from "lucide-react";
import type { NormalizedAssessmentInput } from "@/domain/normalized";
import type { CommercialClassification } from "@/calculation/viability/types";
import type { OperationalStatus } from "@/calculation/operational/types";
import { OPERATIONAL_STATUS_LABEL } from "@/calculation/operational/types";
import { resultFormatter, type ResultFormatter } from "@/components/results/format-results";
import { BADGE_STATUS } from "@/components/results/commercial-sections";

export type BaseInputState =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "incomplete"; count: number }
  | { kind: "error"; messages: string[] }
  | { kind: "ok"; input: NormalizedAssessmentInput; f: ResultFormatter };

/** The Base Case: the user's current assessment, normalized. It is only ever read. */
export function useBaseInput(): BaseInputState {
  const { assessment, hydrated } = useAssessmentState();
  return useMemo<BaseInputState>(() => {
    if (!hydrated) return { kind: "loading" };
    const out = runAssessment(assessment);
    if (out.status === "invalid_inputs") return out.issues.length > 0 && assessment.origin === "blank" ? { kind: "empty" } : { kind: "incomplete", count: out.issues.length };
    if (out.status === "calculation_error") return { kind: "error", messages: out.errors.map((e) => e.message) };
    return { kind: "ok", input: out.input, f: resultFormatter(out.input.meta.currency) };
  }, [assessment, hydrated]);
}

export function BaseGate({ state, children }: { state: BaseInputState; children: (s: Extract<BaseInputState, { kind: "ok" }>) => ReactNode }) {
  if (state.kind === "ok") return <>{children(state)}</>;
  if (state.kind === "loading") return <Card aria-busy="true"><CardBody><p role="status" className="text-sm text-slate-600">Loading your saved work…</p></CardBody></Card>;
  const blank = state.kind === "empty";
  return (
    <Card>
      <CardBody>
        <EmptyState
          icon={Calculator}
          title={blank ? "Run an assessment first" : "Complete the assessment first"}
          action={<ButtonLink href={blank ? "/assessment/business" : "/assessment/review"}>{blank ? "Start an Assessment" : "Review missing inputs"}</ButtonLink>}
        >
          {state.kind === "error"
            ? state.messages.join(" ")
            : "This analysis starts from your Base Case, which is your current assessment. Results appear here once the inputs are complete."}
        </EmptyState>
      </CardBody>
    </Card>
  );
}

export const ClassBadge = ({ c, size = "sm" }: { c: CommercialClassification; size?: "sm" | "md" | "lg" }) => <StatusBadge status={BADGE_STATUS[c]} size={size} />;
export const opLabel = (s: OperationalStatus) => OPERATIONAL_STATUS_LABEL[s];
export const ECON_WORD = { FAVOURABLE: "Favourable", NEAR_BREAK_EVEN: "Near break-even", UNFAVOURABLE: "Unfavourable", INSUFFICIENT_DATA: "Insufficient data" } as const;
export const TECH_LABEL = { bev: "Battery electric", biofuel: "Biofuel" } as const;

export const MODEL_DISCLAIMER = "Sensitivity and threshold results are model-derived decision-support estimates based on the entered assumptions. They are not forecasts, quotations or investment guarantees.";

export function Disclaimer() {
  return <p className="text-xs text-slate-600">{MODEL_DISCLAIMER}</p>;
}
