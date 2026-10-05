import type { Metadata } from "next";
import { OverviewView } from "@/components/results/overview-view";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage() {
  return (
    <>
      <PageHeader help="home" eyebrow="Workspace" title="Overview" description="Pick up your assessment, or see how the full journey fits together." />
      <OverviewView />
    </>
  );
}
