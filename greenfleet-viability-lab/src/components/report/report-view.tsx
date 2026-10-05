"use client";

import { Download, Printer, Presentation } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHelpButton } from "@/guidance/HelpButtons";
import { buildReportModel } from "@/reporting/model";
import { CSV_LABEL, availability, buildExportFile, type CsvKind, type ExportKind } from "@/reporting/exports";
import { downloadFile } from "@/reporting/download";
import { useReportData, type ReportData } from "@/reporting/useReportData";
import { DEFAULT_REPORT_OPTIONS, type ReportOptions } from "@/reporting/types";
import { FileText } from "lucide-react";
import { ReportDocument } from "./report-document";

const OPTION_LABEL: Record<keyof ReportOptions, string> = { sensitivity: "Sensitivity analysis", scenarios: "Scenarios", thresholds: "Threshold analysis", detailedAssumptions: "Detailed assumptions", methodologyAppendix: "Methodology appendix" };

export function EmptyReport({ status }: { status: Exclude<ReportData["status"], "ok" | "loading"> | "loading"; }) {
  if (status === "loading") return <Card aria-busy="true"><CardBody><p role="status" className="text-sm text-slate-600">Loading your saved work…</p></CardBody></Card>;
  return (
    <Card>
      <CardBody>
        <EmptyState icon={FileText} title="No completed assessment is available to report." action={<ButtonLink href={status === "empty" ? "/assessment/business" : "/assessment/review"}>{status === "empty" ? "Start an Assessment" : "Review missing inputs"}</ButtonLink>}>
          {status === "empty" ? "The report is built from a completed assessment." : "Complete the required inputs and run the assessment first."}
        </EmptyState>
      </CardBody>
    </Card>
  );
}

export function ReportView() {
  const data = useReportData();
  const [options, setOptions] = useState<ReportOptions>(DEFAULT_REPORT_OPTIONS);
  const [now] = useState(() => new Date().toISOString());
  const model = useMemo(() => (data.status === "ok" ? buildReportModel({ input: data.input, result: data.result, analysis: data.analysis, scenarios: data.scenarios, options, now }) : null), [data, options, now]);
  if (data.status !== "ok" || !model) return <EmptyReport status={data.status === "ok" ? "loading" : data.status} />;
  const avail = availability(model);
  const exportIt = (k: ExportKind) => downloadFile(buildExportFile(k, { model, input: data.input, result: data.result, analysis: data.analysis, scenarios: data.scenarios }));
  return (
    <div className="space-y-6">
      <Card className="print:hidden">
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => window.print()}><Printer aria-hidden className="size-4" /> Print / Save as PDF</Button>
            <details className="relative">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-navy-200 bg-surface px-4 py-2 text-sm font-semibold text-navy-800 hover:bg-navy-50 [&::-webkit-details-marker]:hidden"><Download aria-hidden className="size-4" /> Export</summary>
              <ul className="absolute left-0 z-30 mt-1 w-72 max-w-[85vw] space-y-1 rounded-xl border border-line bg-surface p-2 shadow-raised">
                {(Object.keys(CSV_LABEL) as CsvKind[]).map((k) => (
                  <li key={k}><button type="button" disabled={!avail[k].available} onClick={() => exportIt(k)} className="min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-navy-900 hover:bg-navy-50 disabled:cursor-not-allowed disabled:text-slate-500 disabled:hover:bg-transparent">CSV: {CSV_LABEL[k]}{avail[k].reason && <span className="block text-xs font-normal">{avail[k].reason}</span>}</button></li>
                ))}
                <li><button type="button" onClick={() => exportIt("json")} className="min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-navy-900 hover:bg-navy-50">JSON: full assessment and results</button></li>
              </ul>
            </details>
            <ButtonLink href="/present" variant="secondary"><Presentation aria-hidden className="size-4" /> Presentation Mode</ButtonLink>
            <ButtonLink href="/results" variant="ghost">Back to Results</ButtonLink>
            <PageHelpButton id="report" label="How the report works" />
          </div>
          <fieldset>
            <legend className="text-sm font-semibold text-navy-900">Include in the report</legend>
            <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
              {(Object.keys(OPTION_LABEL) as (keyof ReportOptions)[]).map((k) => (
                <label key={k} className="inline-flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={options[k]} onChange={(e) => setOptions({ ...options, [k]: e.target.checked })} /> {OPTION_LABEL[k]}</label>
              ))}
            </div>
          </fieldset>
          <p className="text-xs text-slate-600">The report reorganises results the model has already produced and does not calculate anything new. Print / Save as PDF opens your browser&apos;s print dialog, where you can choose Save as PDF. Exports are created on this device and are not uploaded. {(!model.sensitivity.drivers.length && model.sensitivity.state === "not_run") || model.thresholds.state === "not_run" ? <>To add sensitivity and threshold sections, open the <Link href="/sensitivity" className="font-semibold underline underline-offset-2">Sensitivity page</Link> first.</> : null}</p>
        </CardBody>
      </Card>
      <ReportDocument model={model} result={data.result} f={data.f} />
    </div>
  );
}
