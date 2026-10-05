import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AssessmentWizard } from "@/components/assessment/wizard";
import { PageHeader } from "@/components/ui/page-header";
import { ASSESSMENT_STEPS, stepById } from "@/domain/steps";

import { STEP_GUIDANCE } from "@/guidance/registry";

export const dynamicParams = false;

export function generateStaticParams() {
  return ASSESSMENT_STEPS.map((s) => ({ step: s.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ step: string }> }): Promise<Metadata> {
  const step = stepById((await params).step);
  return { title: step ? `${step.title} | New Assessment` : "New Assessment" };
}

export default async function AssessmentStepPage({ params }: { params: Promise<{ step: string }> }) {
  const step = stepById((await params).step);
  if (!step) notFound();
  return (
    <>
      <PageHeader
        help={STEP_GUIDANCE[step.id]}
        eyebrow="New assessment"
        title="Build your fleet comparison"
        description="Work through six short steps. Your entries are saved in this browser as you go."
      />
      <AssessmentWizard stepId={step.id} />
    </>
  );
}
