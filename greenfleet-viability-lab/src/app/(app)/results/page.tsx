import type { Metadata } from "next";
import { ResultsView } from "@/components/results/results-view";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Results" };

export default function ResultsPage() {
  return (
    <>
      <PageHeader eyebrow="Results" title="Results dashboard" description="What diesel, battery-electric and biofuel vehicles cost your fleet over the analysis period, and whether the alternatives pay for themselves." />
      <ResultsView />
    </>
  );
}
