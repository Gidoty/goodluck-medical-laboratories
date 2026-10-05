"use client";

import { BarChart3, Banknote, Calculator, Clock, Gauge, Leaf, PiggyBank, Route, Scale, TrendingUp, Wallet } from "lucide-react";
import { assessReadiness } from "@/domain/completion";
import { TECH_LABELS } from "@/domain/labels";
import { useAssessmentState } from "@/state/StoreProvider";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { StatusBadge } from "@/components/ui/status-badge";

const KPIS = [
  { label: "Total cost of ownership", icon: Wallet, hint: "Whole-life cost per technology" },
  { label: "Cost per kilometre", icon: Route, hint: "Cost for every kilometre driven" },
  { label: "Annual operating cost", icon: Banknote, hint: "Energy, maintenance and fixed costs" },
  { label: "Net present value", icon: TrendingUp, hint: "Value versus the diesel baseline" },
  { label: "Payback period", icon: Clock, hint: "Years to recover extra upfront cost" },
  { label: "Annual savings", icon: PiggyBank, hint: "Yearly saving versus diesel" },
  { label: "Emissions", icon: Leaf, hint: "Estimated greenhouse-gas emissions" },
] as const;

const TECHS = ["diesel", "electric", "biofuel"] as const;

export function ResultsView() {
  const { assessment, hydrated } = useAssessmentState();
  const ready = hydrated && assessReadiness(assessment).commercialReady;

  return (
    <div className="space-y-6">
      <section aria-labelledby="headline-title">
        <Card>
          <CardHeader id="headline-title" title="Headline recommendation" description="The plain-language answer to which technology has the strongest commercial case." />
          <CardBody>
            <EmptyState
              icon={Calculator}
              title="Complete an assessment to generate results."
              action={
                <ButtonLink href={ready ? "/assessment/review" : "/assessment/business"}>
                  {ready ? "Review inputs" : "Start New Assessment"}
                </ButtonLink>
              }
            >
              {ready
                ? "Your inputs are complete. Results will appear here once the calculation engine is added in a later development batch."
                : "Results appear here after the inputs are complete and the assessment is run."}
            </EmptyState>
          </CardBody>
        </Card>
      </section>

      <section aria-labelledby="kpi-title">
        <h2 id="kpi-title" className="mb-3 text-lg font-semibold text-navy-950">Key metrics</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {KPIS.map((k) => (
            <KpiCard key={k.label} label={k.label} icon={k.icon} value={null} hint={k.hint} />
          ))}
        </div>
      </section>

      <section aria-labelledby="compare-title">
        <Card>
          <CardHeader id="compare-title" title="Technology comparison" description="Diesel, battery-electric and biofuel side by side." />
          <CardBody>
            <ResponsiveTable caption="Technology comparison (no results yet)">
              <thead>
                <tr className="border-b border-line bg-navy-50 text-navy-800">
                  <th scope="col" className="px-4 py-3 font-semibold">Metric</th>
                  {TECHS.map((t) => (
                    <th key={t} scope="col" className="px-4 py-3 font-semibold">{TECH_LABELS[t]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {KPIS.map((k) => (
                  <tr key={k.label} className="border-b border-line last:border-0">
                    <th scope="row" className="px-4 py-3 font-medium text-navy-900">{k.label}</th>
                    {TECHS.map((t) => (
                      <td key={t} className="px-4 py-3 text-navy-300">
                        <span aria-label="Not yet calculated">—</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </ResponsiveTable>
          </CardBody>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Cumulative cash flow" description="Running balance of each alternative against diesel." />
          <CardBody>
            <EmptyState icon={BarChart3} title="No cash-flow chart yet">The chart appears after an assessment has been run.</EmptyState>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Break-even conditions" description="What would have to change for an alternative to match diesel." />
          <CardBody>
            <EmptyState icon={Scale} title="No break-even analysis yet">Break-even thresholds are calculated from your completed assessment.</EmptyState>
          </CardBody>
        </Card>
      </div>

      <section aria-labelledby="class-title">
        <Card>
          <CardHeader id="class-title" title="Commercial viability classification" description="Each alternative will be classified against transparent, predefined rules." />
          <CardBody className="space-y-4">
            <Alert tone="info">
              No classification is assigned in this release. The decision rules are defined in a later batch. The key below only shows how
              the three statuses will look.
            </Alert>
            <div>
              <p className="mb-2 text-sm font-semibold text-navy-900">Status key (display preview)</p>
              <div className="flex flex-wrap gap-3">
                <StatusBadge status="viable" />
                <StatusBadge status="conditionally_viable" />
                <StatusBadge status="not_yet_viable" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Gauge aria-hidden className="size-4" />
              Environmental performance is reported separately from commercial viability.
            </div>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
