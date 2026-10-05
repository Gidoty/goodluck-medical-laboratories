import { Calculator } from "lucide-react";
import Link from "next/link";
import { assessmentCompletion, isAssessmentReady, type StepState } from "@/domain/assessmentValidation";
import { stepById } from "@/domain/steps";
import type { Assessment } from "@/domain/types";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATE_LABEL: Record<StepState, { label: string; tone: "forest" | "amber" | "neutral" }> = {
  complete: { label: "Complete", tone: "forest" },
  in_progress: { label: "Needs attention", tone: "amber" },
  not_started: { label: "Not started", tone: "neutral" },
};

export function ReviewPanel({ assessment }: { assessment: Assessment }) {
  const completion = assessmentCompletion(assessment);
  const ready = isAssessmentReady(assessment);
  return (
    <div className="space-y-6">
      <ul className="divide-y divide-line rounded-xl border border-line">
        {completion.map((c) => {
          const step = stepById(c.stepId);
          if (!step) return null;
          const s = STATE_LABEL[c.state];
          return (
            <li key={c.stepId} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/assessment/${step.id}`} className="font-semibold text-navy-950 hover:underline">
                  {step.number}. {step.title}
                </Link>
                <Badge tone={s.tone}>{s.label}</Badge>
              </div>
              {c.errors.length > 0 && c.state !== "not_started" && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-900">
                  {c.errors.map((e) => (
                    <li key={e.fieldId + e.code}>{e.message}</li>
                  ))}
                </ul>
              )}
              {c.errors.length > 0 && c.state === "not_started" && (
                <p className="mt-2 text-sm text-slate-600">{c.errors.length} required inputs still to enter.</p>
              )}
              {c.warnings.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
                  {c.warnings.map((w) => (
                    <li key={w.fieldId + w.code}>{w.message}</li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <Alert tone="info" title={ready ? "Inputs are complete" : "Inputs are not complete yet"}>
        {ready
          ? "Your inputs pass every validation rule. The calculation engine is not part of this release, so no results are produced yet."
          : "Complete the steps marked above. Validation runs on every input, and 0 is accepted wherever zero is a valid value."}
      </Alert>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled aria-describedby="run-note">
          <Calculator aria-hidden className="size-4" /> Run assessment
        </Button>
        <p id="run-note" className="text-sm text-slate-600">
          Available when the calculation engine is added in a later development batch.
        </p>
      </div>
    </div>
  );
}
