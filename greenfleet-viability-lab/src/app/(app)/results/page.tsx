import type { Metadata } from "next";
import { ResultsView } from "@/components/results/results-view";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Results" };

export default function ResultsPage() {
  return (
    <>
      <PageHeader eyebrow="Results" title="Results dashboard" description="Comparative performance of diesel, electric and biofuel for your fleet." />
      <ResultsView />
    </>
  );
}
