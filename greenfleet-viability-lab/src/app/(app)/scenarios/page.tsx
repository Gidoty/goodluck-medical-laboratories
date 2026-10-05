import type { Metadata } from "next";
import { ScenarioWorkspace } from "@/components/analysis/scenario-workspace";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Saved Scenarios" };

export default function ScenariosPage() {
  return (
    <>
      <PageHeader
        help="scenarios"
        eyebrow="Library"
        title="Scenarios"
        description="Keep named sets of changes to your assessment, for example a different fuel price or better charging access, and compare them with the Base Case. The Base Case is never changed."
      />
      <ScenarioWorkspace />
    </>
  );
}
