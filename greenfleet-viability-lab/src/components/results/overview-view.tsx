"use client";

import { ArrowRight, CheckCircle2, CircleDashed, Hourglass } from "lucide-react";
import { useMemo } from "react";
import { StartActions } from "@/components/assessment/start-actions";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { stepCompletions } from "@/domain/completion";
import { isUntouched } from "@/domain/mutations";
import { createReader } from "@/domain/reader";
import { JOURNEY, stepById } from "@/domain/steps";
import { useAssessmentState } from "@/state/StoreProvider";

export function OverviewView() {
  const { assessment, hydrated } = useAssessmentState();
  const completion = useMemo(() => stepCompletions(assessment), [assessment]);
  const done = completion.filter((c) => c.state === "complete").length;
  const started = !isUntouched(assessment);
  const firstOpen = completion.find((c) => c.state !== "complete");
  const target = firstOpen ? stepById(firstOpen.stepId) : stepById("review");
  const name = createReader(assessment).text("business.assessmentName").trim();

  if (!hydrated) {
    return (
      <Card aria-busy="true">
        <CardBody>
          <p role="status" className="text-sm text-slate-600">Loading your saved work…</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <Card>
        <CardHeader title="Current assessment" description="Your work is saved in this browser." />
        <CardBody className="space-y-5">
          <div>
            <p className="text-lg font-semibold text-navy-950">{started ? name || "Untitled assessment" : "No assessment started"}</p>
            <p className="text-sm text-slate-600">{done} of {completion.length} input steps complete</p>
          </div>
          <div role="progressbar" aria-label="Input steps complete" aria-valuemin={0} aria-valuemax={completion.length} aria-valuenow={done} className="h-2.5 overflow-hidden rounded-full bg-navy-100">
            <div className="h-full rounded-full bg-forest-600" style={{ width: `${(done / completion.length) * 100}%` }} />
          </div>
          <ul className="space-y-2 text-sm">
            {completion.map((c) => (
              <li key={c.stepId} className="flex items-center gap-2">
                {c.state === "complete" ? <CheckCircle2 aria-hidden className="size-4 text-forest-700" /> : <CircleDashed aria-hidden className="size-4 text-navy-400" />}
                <span className="text-navy-900">{stepById(c.stepId)?.title}</span>
                <span className="sr-only">{c.state === "complete" ? "complete" : "not complete"}</span>
              </li>
            ))}
          </ul>
          {started ? (
            <div className="space-y-3">
              <ButtonLink href={`/assessment/${target?.id ?? "business"}`}>
                Continue assessment <ArrowRight aria-hidden className="size-4" />
              </ButtonLink>
              <StartActions variant="compact" />
            </div>
          ) : (
            <StartActions variant="overview" />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="The assessment journey" description="Ten stages from fleet context to viability thresholds." />
        <CardBody>
          <ol className="space-y-3">
            {JOURNEY.map((j) => (
              <li key={j.n} className="flex items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-navy-100 text-xs font-bold text-navy-800">{j.n}</span>
                <span className="min-w-0 flex-1 text-sm font-medium text-navy-900">{j.title}</span>
                {j.state === "ready" ? (
                  <Badge tone="forest">Available</Badge>
                ) : (
                  <Badge tone="neutral"><Hourglass aria-hidden className="size-3" /> Later batch</Badge>
                )}
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>
    </div>
  );
}
