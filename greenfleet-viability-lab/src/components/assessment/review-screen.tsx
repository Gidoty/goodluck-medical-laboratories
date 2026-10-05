"use client";

import { AlertCircle, Calculator, CheckCircle2, CircleDashed, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { AssumptionBadge, type AssumptionKind } from "@/components/ui/assumption-badge";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { checkAssessment, type FieldIssue } from "@/domain/checks";
import { assessReadiness, type Readiness } from "@/domain/completion";
import { deriveOperations } from "@/domain/derive";
import { createReader } from "@/domain/reader";
import { FIELDS } from "@/domain/schema/fields";
import type { FieldDef } from "@/domain/schema/types";
import type { Assessment } from "@/domain/stored";
import { formatQuantity, EMPTY_VALUE } from "@/lib/format";
import { cn } from "@/lib/cn";
import { DebugPanel } from "./debug-panel";
import { REVIEW_GROUPS, type ReviewGroup } from "./review-groups";
import { describeValue } from "./review-format";

export function ReviewScreen({ assessment }: { assessment: Assessment }) {
  const issues = useMemo(() => checkAssessment(assessment), [assessment]);
  const readiness = useMemo(() => assessReadiness(assessment, issues), [assessment, issues]);
  const reader = useMemo(() => createReader(assessment), [assessment]);
  return (
    <div className="space-y-6">
      <Completeness readiness={readiness} />
      {REVIEW_GROUPS.map((g) => (
        <GroupCard key={g.id} group={g} assessment={assessment} reader={reader} issues={issues} />
      ))}
      <CalculatePanel readiness={readiness} />
      <DebugPanel assessment={assessment} />
    </div>
  );
}

const sectionHref = (step: string, section: string) => `/assessment/${step}#section-${section}`;

function Completeness({ readiness }: { readiness: Readiness }) {
  const env = readiness.environmental;
  return (
    <Card>
      <CardHeader title="Assumption completeness" description="What is ready, and what still needs your attention." />
      <CardBody className="space-y-4">
        <ul className="grid gap-3 sm:grid-cols-2">
          <li className="flex items-start gap-3 rounded-xl border border-line p-4">
            {readiness.commercialReady ? <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-forest-700" /> : <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-amber-800" />}
            <span>
              <span className="block text-sm font-semibold text-navy-950">{readiness.commercialReady ? "Ready for commercial analysis" : "Commercial analysis: inputs missing"}</span>
              <span className="block text-xs text-slate-600">{readiness.commercialReady ? "Every required input is present and valid." : `${readiness.blockingIssues.length} ${readiness.blockingIssues.length === 1 ? "problem" : "problems"} to fix below.`}</span>
            </span>
          </li>
          <li className="flex items-start gap-3 rounded-xl border border-line p-4">
            {env === "complete" ? <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-forest-700" /> : <CircleDashed aria-hidden className="mt-0.5 size-5 shrink-0 text-navy-500" />}
            <span>
              <span className="block text-sm font-semibold text-navy-950">{env === "complete" ? "Environmental comparison inputs complete" : env === "partial" ? "Environmental comparison incomplete" : "Environmental comparison not started"}</span>
              <span className="block text-xs text-slate-600">{env === "complete" ? "All three emission factors are entered." : "Optional for the commercial analysis. Add emission factors in Step 5 to compare emissions."}</span>
            </span>
          </li>
        </ul>
        {readiness.missingRequired.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-navy-950">Missing required inputs</p>
            <ul className="mt-2 space-y-1 text-sm">
              {readiness.missingRequired.map((m) => (
                <li key={m.fieldId}>
                  <Link href={sectionHref(m.stepId, m.sectionId)} className="text-red-900 underline underline-offset-2 hover:text-red-950">
                    {m.label}
                  </Link>
                  <span className="text-slate-600"> ({m.sectionTitle})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function basisOf(def: FieldDef, a: Assessment): AssumptionKind | null {
  if (def.kind !== "number" && def.kind !== "qnumber") return null;
  if (a.illustrative.includes(def.id)) return "illustrative";
  const source = a.provenance[def.id]?.source;
  return source && source !== "user_estimate" ? "sourced" : "user";
}

function GroupCard({ group, assessment, reader, issues }: { group: ReviewGroup; assessment: Assessment; reader: ReturnType<typeof createReader>; issues: FieldIssue[] }) {
  const fields = FIELDS.filter((f) => group.sections.includes(f.section) && reader.isVisible(f.id) && !(f.kind === "choice" && f.presentation === "switch"));
  const rows = fields.map((def) => ({ def, value: describeValue(def, reader), problems: issues.filter((i) => i.fieldId === def.id) }));
  const shown = rows.filter((r) => r.value.state !== "empty" || r.def.required);
  const blankOptional = rows.length - shown.length;
  const groupIssues = issues.filter((i) => group.sections.includes(i.sectionId));
  const errors = groupIssues.filter((i) => i.severity === "error");
  const entered = rows.some((r) => r.value.state !== "empty" && !(r.def.id === "business.currency"));
  const target = errors[0]?.sectionId ?? group.sections[0]!;
  const ops = group.id === "business" ? deriveOperations(assessment, reader) : null;
  const optionalGroup = group.id === "environment";

  const status = errors.length === 0 && (entered || !optionalGroup) ? { label: entered ? "Complete" : "Complete", tone: "forest" as const } : optionalGroup && !entered ? { label: "Optional, not started", tone: "neutral" as const } : { label: `${errors.length} to fix`, tone: "amber" as const };

  return (
    <Card>
      <CardHeader
        title={group.title}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            <ButtonLink href={sectionHref(group.step, target)} variant="secondary" size="sm">
              <Pencil aria-hidden className="size-4" /> Edit<span className="sr-only"> {group.title}</span>
            </ButtonLink>
          </div>
        }
      />
      <CardBody>
        {shown.length === 0 && !ops ? (
          <p className="text-sm text-slate-600">{group.id === "infrastructure" ? "No infrastructure investment is indicated by your answers so far." : "Nothing entered yet."}</p>
        ) : (
          <dl className="divide-y divide-line">
            {shown.map(({ def, value, problems }) => {
              const basis = value.state === "value" ? basisOf(def, assessment) : null;
              const errs = problems.filter((p) => p.severity === "error");
              return (
                <div key={def.id} className="grid gap-1 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:gap-4">
                  <dt className="text-sm text-navy-800">{def.label}</dt>
                  <dd className="min-w-0 text-sm">
                    <span className={cn("break-words font-semibold", value.state === "empty" ? "inline-flex items-center gap-1 text-red-900" : "text-navy-950")}>
                      {value.state === "empty" && <AlertCircle aria-hidden className="size-4 shrink-0" />}
                      {value.state === "empty" ? `${value.text}: required` : value.text}
                    </span>
                    {value.note && <span className="ml-2 text-xs text-slate-600">{value.note}</span>}
                    {basis && <AssumptionBadge kind={basis} className="ml-2 align-middle" />}
                    {errs.map((e) => (
                      <span key={e.message} className="mt-1 block text-xs font-medium text-red-800">{e.message}</span>
                    ))}
                  </dd>
                </div>
              );
            })}
            {ops && (
              <>
                <DerivedRow label="Annual distance per vehicle" value={ops.annualDistanceKm === null ? EMPTY_VALUE : formatQuantity(ops.annualDistanceKm, "km_per_year", reader.currency, 2)} />
                <DerivedRow label="Fleet annual distance" value={ops.fleetAnnualDistanceKm === null ? EMPTY_VALUE : formatQuantity(ops.fleetAnnualDistanceKm, "km_per_year", reader.currency, 2)} />
              </>
            )}
          </dl>
        )}
        {blankOptional > 0 && <p className="mt-3 text-xs text-slate-600">{blankOptional} optional {blankOptional === 1 ? "input" : "inputs"} left blank. Blanks are never filled with assumed values.</p>}
      </CardBody>
    </Card>
  );
}

function DerivedRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:gap-4">
      <dt className="text-sm text-navy-800">{label}</dt>
      <dd className="text-sm">
        <span className="font-semibold text-navy-950">{value}</span>
        <AssumptionBadge kind="derived" className="ml-2 align-middle" />
      </dd>
    </div>
  );
}

function CalculatePanel({ readiness }: { readiness: Readiness }) {
  const router = useRouter();
  const [attempted, setAttempted] = useState(false);
  const run = () => {
    if (readiness.commercialReady) router.push("/results");
    else setAttempted(true);
  };
  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={run}>
            <Calculator aria-hidden className="size-5" /> Run Commercial Viability Assessment
          </Button>
          <p className="max-w-xl text-xs text-slate-600">When you run the assessment, GreenFleet will calculate economic performance, operational feasibility, environmental performance where emission factors are available, and commercial viability.</p>
        </div>
        <div role="status" aria-live="polite">
          {attempted && !readiness.commercialReady && (
            <Alert tone="warning" title="Some required inputs are still missing">
              <p>The assessment cannot run until these are fixed:</p>
              <ul className="mt-1 list-disc pl-5">
                {readiness.missingRequired.slice(0, 6).map((m) => (
                  <li key={m.fieldId}>
                    <Link href={sectionHref(m.stepId, m.sectionId)} className="underline underline-offset-2">{m.label}</Link>
                  </li>
                ))}
                {readiness.missingRequired.length === 0 && <li>Fix the highlighted problems above.</li>}
              </ul>
            </Alert>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
