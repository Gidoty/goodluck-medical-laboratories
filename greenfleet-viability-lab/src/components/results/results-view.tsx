"use client";

import { Calculator, FlaskConical, Pencil } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DEMO_LABEL } from "@/domain/demo";
import { isUntouched } from "@/domain/mutations";
import { runAssessment } from "@/domain/runAssessment";
import { formatNumber } from "@/lib/format";
import { useAssessmentState } from "@/state/StoreProvider";
import type { AssessmentCalculationResult } from "@/calculation/types";
import type { Assessment } from "@/domain/stored";
import { resultFormatter } from "./format-results";
import { CashFlowChart, CostComponentsChart, TcoChart } from "./results-charts";
import { CommercialHeadline, CommercialMatrix, CommercialPolicyNote, WhyPanels } from "./commercial-sections";
import { CompletenessIndicators, DomainWarnings, EnvironmentalSection, OperationalSection, economicWarnings } from "./analysis-sections";
import { AssumptionsPanel, CashFlowTables, ComparisonTables, HeadlineTiles, TechnologyCards, WarningsPanel } from "./result-sections";
import type { CurrencyCode } from "@/lib/currency";

export function ResultsView() {
  const { assessment, hydrated } = useAssessmentState();
  if (!hydrated) {
    return (
      <Card aria-busy="true">
        <CardBody><p role="status" className="text-sm text-slate-600">Loading your saved work…</p></CardBody>
      </Card>
    );
  }
  return <ResultsBody assessment={assessment} />;
}

/** Everything the results page shows, as a function of the assessment alone. */
export function ResultsBody({ assessment }: { assessment: Assessment }) {
  // Pure and instant, so results are recomputed from the saved inputs rather than stored.
  const outcome = useMemo(() => runAssessment(assessment), [assessment]);

  if (outcome.status === "invalid_inputs") {
    const blank = isUntouched(assessment);
    const missing = outcome.issues.filter((i) => i.code === "missing").length;
    return (
      <Card>
        <CardHeader title="Headline comparison" description="The cost of diesel, battery-electric and biofuel vehicles over your analysis period." />
        <CardBody>
          <EmptyState icon={Calculator} title="Complete an assessment to generate results." action={<ButtonLink href={blank ? "/assessment/business" : "/assessment/review"}>{blank ? "Start New Assessment" : "Review missing inputs"}</ButtonLink>}>
            {blank ? "Results appear here once the inputs are complete." : `${outcome.issues.length} ${outcome.issues.length === 1 ? "input needs" : "inputs need"} attention${missing > 0 ? `, including ${missing} still missing` : ""}. Results are calculated only from a complete, valid assessment.`}
          </EmptyState>
        </CardBody>
      </Card>
    );
  }

  if (outcome.status === "calculation_error") {
    return (
      <Alert tone="warning" title="The assessment could not be calculated">
        <ul className="list-disc pl-5">{outcome.errors.map((e) => <li key={e.field}>{e.message}</li>)}</ul>
        <p className="mt-2"><Link href="/assessment/review" className="font-semibold underline underline-offset-2">Review your inputs</Link></p>
      </Alert>
    );
  }

  return <ResultsDashboard result={outcome.result} currency={outcome.input.meta.currency} arrangement={outcome.input.infrastructure?.bevCharging?.arrangement ?? null} />;
}

function ResultsDashboard({ result, currency, arrangement }: { result: AssessmentCalculationResult; currency: CurrencyCode; arrangement: string | null }) {
  const f = resultFormatter(currency);
  const m = result.metadata;
  const isDemo = m.illustrativeInputs.length > 0;
  return (
    <div className="space-y-8">
      <Card>
        <CardBody className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-navy-950">{m.assessmentName || "Untitled assessment"}</p>
            <p className="mt-1 text-sm text-slate-600">
              {formatNumber(m.fleetSize, 0)} {m.fleetSize === 1 ? "vehicle" : "vehicles"} · {m.horizonYears} {m.horizonYears === 1 ? "year" : "years"} · {formatNumber(m.annualDistancePerVehicleKm, 0)} km per vehicle per year · discount rate {formatNumber(m.discountRate * 100, 2)}% · amounts in {currency}
            </p>
            <p className="mt-1 text-xs text-slate-600">Calculated from your current inputs. Change an input and these figures update.</p>
          </div>
          <ButtonLink href="/assessment/review" variant="secondary" size="sm"><Pencil aria-hidden className="size-4" /> Review inputs</ButtonLink>
        </CardBody>
      </Card>

      {isDemo && (
        <Alert tone="demo" title="These results use illustrative demo values">
          <span className="flex items-center gap-2"><FlaskConical aria-hidden className="size-4 shrink-0" />{DEMO_LABEL} They show how the tool works and say nothing about real costs.</span>
        </Alert>
      )}

      <CommercialHeadline r={result} f={f} />
      <CommercialMatrix r={result} />
      <WhyPanels r={result} f={f} />
      <CompletenessIndicators r={result} />
      <CommercialPolicyNote r={result} />

      <section aria-labelledby="econ-title" className="space-y-6">
        <div>
          <h2 id="econ-title" className="text-xl font-semibold text-navy-950">Economic attractiveness</h2>
          <p className="text-sm text-slate-600">Cost only. Nothing in this section says whether the vehicles can do the work or what they emit. The commercial classification above combines this with operational feasibility by fixed rules.</p>
        </div>
        <HeadlineTiles r={result} f={f} />
        <TechnologyCards r={result} f={f} />
        <WarningsPanel warnings={economicWarnings(result.warnings)} />
        <ComparisonTables r={result} f={f} />
      </section>

      <section aria-labelledby="charts-title" className="space-y-4">
        <h2 id="charts-title" className="text-lg font-semibold text-navy-950">Charts</h2>
        <CashFlowChart result={result} f={f} />
        <div className="grid gap-4 xl:grid-cols-2">
          <TcoChart result={result} f={f} />
          <CostComponentsChart result={result} f={f} />
        </div>
      </section>

      <CashFlowTables r={result} f={f} />

      <OperationalSection r={result} arrangement={arrangement} />
      <EnvironmentalSection r={result} />
      <DomainWarnings r={result} />

      <AssumptionsPanel r={result} f={f} />

      <Card>
        <CardHeader title="How to read these results" description={<>Read the <Link href="/methodology" className="font-semibold underline underline-offset-2">methodology</Link> for the formulas.</>} />
        <CardBody>
          <ul className="list-disc space-y-2 pl-5 text-sm text-navy-800">
            {result.methodologyNotes.map((n) => <li key={n}>{n}</li>)}
            <li>A positive net present value means the alternative has an economic advantage over diesel under the assumptions entered. It does not mean the alternative is environmentally better or operationally feasible.</li>
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
