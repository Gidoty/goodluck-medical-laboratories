import type { Metadata } from "next";
import { SensitivityWorkspace } from "@/components/analysis/sensitivity-workspace";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Sensitivity Analysis" };

export default function SensitivityPage() {
  return (
    <>
      <PageHeader
        help="sensitivity"
        eyebrow="Analysis"
        title="Sensitivity, thresholds and drivers"
        description="Green transport viability is conditional, not universal. See how far your assumptions can move, and what would have to change to reach a target. Your Base Case is never changed."
      />
      <SensitivityWorkspace />
    </>
  );
}
