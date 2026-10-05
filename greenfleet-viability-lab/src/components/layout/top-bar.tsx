"use client";

import { useId } from "react";
import { formatDateTime } from "@/lib/format";
import { useAssessmentActions, useAssessmentState } from "@/state/StoreProvider";
import { CurrencySelect } from "@/components/assessment/currency-select";
import { createReader, getCurrency } from "@/domain/reader";
import { HelpButton } from "@/guidance/HelpButtons";
import { MobileNav } from "./mobile-nav";

export function TopBar() {
  const { assessment, hydrated } = useAssessmentState();
  const { setCurrency } = useAssessmentActions();
  const currencyId = useId();
  const saved = hydrated && assessment.origin !== "blank";
  const name = createReader(assessment).text("business.assessmentName").trim();

  return (
    <div className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur print:hidden">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <MobileNav />
        <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3 xl:grid-cols-4">
          <div className="min-w-0">
            <dt className="text-xs text-slate-600">Assessment</dt>
            <dd className="truncate font-semibold text-navy-950">{name || "Untitled assessment"}</dd>
          </div>
          <div className="hidden min-w-0 sm:block">
            <dt className="text-xs text-slate-600">Scenario</dt>
            <dd className="truncate font-semibold text-navy-950">{assessment.scenarioName}</dd>
          </div>
          <div className="hidden min-w-0 sm:block">
            <dt className="text-xs text-slate-600">Last updated</dt>
            <dd className="truncate font-semibold text-navy-950" suppressHydrationWarning>
              {saved ? formatDateTime(assessment.updatedAt) : "Nothing saved yet"}
            </dd>
          </div>
        </dl>
        <HelpButton className="shrink-0" />
        <div className="shrink-0">
          <label htmlFor={currencyId} className="block text-xs text-slate-600">
            Currency
          </label>
          <CurrencySelect id={currencyId} value={getCurrency(assessment)} onChange={setCurrency} className="w-auto max-w-[8.5rem]" />
        </div>
      </div>
    </div>
  );
}
