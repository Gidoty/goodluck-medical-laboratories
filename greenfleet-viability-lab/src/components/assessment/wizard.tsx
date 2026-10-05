"use client";

import { ArrowLeft, ArrowRight, FlaskConical, RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { assessmentCompletion } from "@/domain/assessmentValidation";
import { fieldsForStep } from "@/domain/fields";
import { DEMO_LABEL } from "@/domain/demo";
import { neighbours, stepById, type StepId } from "@/domain/steps";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useAssessmentActions, useAssessmentState } from "@/state/StoreProvider";
import { CurrencySelect, NumberField, TextField } from "./fields";
import { ReviewPanel } from "./review-panel";
import { StepProgress } from "./step-progress";

export function AssessmentWizard({ stepId }: { stepId: StepId }) {
  const { assessment, hydrated } = useAssessmentState();
  const actions = useAssessmentActions();
  const currencyId = useId();
  const [showIssues, setShowIssues] = useState<StepId | null>(null);

  const step = stepById(stepId);
  if (!step) return null;
  const { prev, next } = neighbours(stepId);
  const completion = Object.fromEntries(assessmentCompletion(assessment).map((c) => [c.stepId, c]));
  const { numeric, text } = fieldsForStep(stepId);
  const revealIssues = showIssues === stepId;

  return (
    <div className="space-y-6">
      <StepProgress current={stepId} completion={completion} />

      {assessment.origin === "demo" && (
        <Alert tone="demo" title="Illustrative demo values are loaded">
          {DEMO_LABEL} Replace them with your own figures. They are here only to show how the interface behaves.
        </Alert>
      )}

      <Card aria-busy={!hydrated}>
        <CardHeader
          title={`Step ${step.number}: ${step.title}`}
          description={step.description}
          action={
            stepId !== "review" && (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={actions.loadDemo}>
                  <FlaskConical aria-hidden className="size-4" /> Load demo values
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (window.confirm("Clear everything you have entered in this assessment?")) actions.reset();
                  }}
                >
                  <RotateCcw aria-hidden className="size-4" /> Clear
                </Button>
              </div>
            )
          }
        />
        <CardBody>
          {stepId === "review" ? (
            <ReviewPanel assessment={assessment} />
          ) : (
            <div className="space-y-6">
              <p className="text-xs text-slate-600">
                Fields marked optional can be left blank. Enter <strong>0</strong> when a value is genuinely zero. Your entries are kept
                when you move between steps.
              </p>
              <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
                {stepId === "business" && (
                  <div>
                    <label htmlFor={currencyId} className="block text-sm font-semibold text-navy-900">
                      Currency
                    </label>
                    <CurrencySelect id={currencyId} value={assessment.currency} onChange={actions.setCurrency} className="mt-1.5" showNames />
                    <p className="mt-1.5 text-xs text-slate-600">
                      Changing currency relabels the units. It does not convert any amount you have entered.
                    </p>
                  </div>
                )}
                {text.map((f) => (
                  <TextField key={f.id} definition={f} assessment={assessment} showIssues={revealIssues} />
                ))}
                {numeric.map((f) => (
                  <NumberField key={f.id} definition={f} assessment={assessment} showIssues={revealIssues} />
                ))}
              </div>
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
          <ButtonLink href={`/assessment/${next.id}`} onClick={() => setShowIssues(stepId)}>
            Next: {next.title} <ArrowRight aria-hidden className="size-4" />
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
