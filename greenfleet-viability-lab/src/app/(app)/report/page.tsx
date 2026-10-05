import type { Metadata } from "next";
import { ReportView } from "@/components/report/report-view";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Professional Report" };

export default function ReportPage() {
  return (
    <>
      <div className="print:hidden">
        <PageHeader help="report" eyebrow="Report" title="Professional assessment report" description="A structured, printable document built from your assessment and the analysis you have run. It does not calculate anything new." />
      </div>
      <ReportView />
    </>
  );
}
