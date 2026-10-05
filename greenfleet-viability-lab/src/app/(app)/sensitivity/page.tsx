import { BarChart3, Grid3x3, Target } from "lucide-react";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Sensitivity Analysis" };

const PLANNED = [
  { icon: BarChart3, title: "One-way sensitivity", text: "Change one assumption at a time, such as diesel price or electricity tariff, and see its effect on the result." },
  { icon: Grid3x3, title: "Two-way scenarios", text: "Vary two assumptions together to see where each technology wins." },
  { icon: Target, title: "Viability thresholds", text: "Solve for the value an assumption must reach for an alternative to become viable." },
] as const;

export default function SensitivityPage() {
  return (
    <>
      <PageHeader
        eyebrow="Analysis"
        title="Scenario and sensitivity analysis"
        description="Green transport viability is conditional, not universal. This is where you test how far your assumptions can move."
      />
      <Card>
        <CardBody>
          <EmptyState
            icon={BarChart3}
            title="Run an assessment first"
            action={<ButtonLink href="/assessment/business">Start New Assessment</ButtonLink>}
          >
            Sensitivity analysis needs a completed assessment and the calculation engine, which is added in a later development batch.
          </EmptyState>
        </CardBody>
      </Card>
      <section aria-labelledby="planned-title" className="mt-8">
        <Card>
          <CardHeader id="planned-title" title="What this page will offer" />
          <CardBody>
            <ul className="grid gap-6 md:grid-cols-3">
              {PLANNED.map(({ icon: Icon, title, text }) => (
                <li key={title}>
                  <Icon aria-hidden className="size-6 text-forest-700" />
                  <h3 className="mt-3 font-semibold text-navy-950">{title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{text}</p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </section>
    </>
  );
}
