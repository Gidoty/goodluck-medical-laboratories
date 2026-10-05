"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { checkAssessment } from "@/domain/checks";
import { stepCompletions } from "@/domain/completion";
import { DEMO_NOTICE } from "@/domain/demo";
import { neighbours, stepById, type StepId } from "@/domain/steps";
import { useAssessmentState } from "@/state/StoreProvider";
import { ReviewScreen } from "./review-screen";
import { StartActions } from "./start-actions";
import { StepGuidanceNote } from "./step-guidance-note";
import { StepForm } from "./step-form";
import { StepProgress } from "./step-progress";

export function AssessmentWizard({ stepId }: { stepId: StepId }) {
  const { assessment, hydrated } = useAssessmentState();
  const [revealedFor, setRevealedFor] = useState<StepId | null>(null);
  const issues = useMemo(() => checkAssessment(assessment), [assessment]);
  const completion = useMemo(() => Object.fromEntries(stepCompletions(assessment, issues).map((c) => [c.stepId, c])), [assessment, issues]);

  // After saved work has loaded, honour a #section-... link (for example "Edit" on the review screen).
  useEffect(() => {
    if (!hydrated || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hydrated, stepId]);

  const step = stepById(stepId);
  if (!step) return null;
  if (!hydrated) {
    return (
      <Card aria-busy="true">
        <CardBody>
          <p role="status" className="text-sm text-slate-600">Loading your saved work…</p>
        </CardBody>
      </Card>
    );
  }
  const { prev, next } = neighbours(stepId);
  const current = completion[stepId];

  return (
    <div className="space-y-6">
      <StepProgress current={stepId} completion={completion} />

      {assessment.illustrative.length > 0 && (
        <Alert tone="demo" title="Illustrative demo values are loaded">
          {DEMO_NOTICE} Replace them with your own figures. A value stops being labelled as illustrative as soon as you edit it.
        </Alert>
      )}

      <Card>
        <CardHeader
          title={`Step ${step.number}: ${step.title}`}
          description={step.description}
          action={stepId !== "review" ? <StartActions variant="compact" /> : undefined}
        />
        <CardBody>
          <StepGuidanceNote stepId={stepId} />
          {stepId === "review" ? (
            <ReviewScreen assessment={assessment} />
          ) : (
            <div className="space-y-6">
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                {current && current.requiredTotal > 0 && <span className="font-semibold text-navy-800">{current.requiredDone} of {current.requiredTotal} required inputs complete</span>}
                <span>Enter <strong>0</strong> when a value is genuinely zero. Blank means “not entered yet”. Your entries are saved as you go.</span>
              </p>
              <StepForm stepId={stepId} assessment={assessment} issues={issues} showIssues={revealedFor === stepId} />
            </div>
          )}
        </CardBody>
      </Card>

      <div className="flex items-center justify-between gap-3">
        {prev ? (
          <ButtonLink href={`/assessment/${prev.id}`} variant="secondary">
            <ArrowLeft aria-hidden className="size-4" /> Back
          </ButtonLink>
        ) : (
          <span />
        )}
        {next && (
          <ButtonLink href={`/assessment/${next.id}`} onClick={() => setRevealedFor(stepId)}>
            Next: {next.title} <ArrowRight aria-hidden className="size-4" />
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
