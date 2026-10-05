"use client";

import { useMemo, useState } from "react";
import { AssumptionBadge, type AssumptionKind } from "@/components/ui/assumption-badge";
import { Collapsible } from "@/components/ui/collapsible";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { PageHelpButton } from "@/guidance/HelpButtons";
import type { NormalizedAssessmentInput } from "@/domain/normalized";
import type { AssessmentCalculationResult } from "@/calculation/types";
import type { ResultFormatter } from "@/components/results/format-results";
import { recordFor } from "@/reporting/analysisRecord";
import { buildEvidenceQuality } from "@/reporting/evidence";
import { PROVENANCE_LABEL, classifyAssumption, contextOf, sourceOf } from "@/reporting/provenance";
import { useAnalysisStore } from "@/state/useAnalysis";
import { EvidenceSummary } from "./evidence-panel";

const KINDS: AssumptionKind[] = ["user", "sourced", "illustrative", "derived", "convention", "excluded"];

/** "Evidence & Assumptions" on the Results page. Descriptive states and counts only; no score. */
export function EvidenceAssumptions({ input, result, f }: { input: NormalizedAssessmentInput; result: AssessmentCalculationResult; f: ResultFormatter }) {
  const { record } = useAnalysisStore();
  const analysis = recordFor(record, input);
  const evidence = useMemo(() => buildEvidenceQuality(result, input, analysis), [result, input, analysis]);
  const [filter, setFilter] = useState<AssumptionKind | "all">("all");
  const ctx = contextOf(input);
  const rows = result.assumptions.map((a) => ({ a, kind: classifyAssumption(a, ctx), src: sourceOf(a, input) })).filter((r) => filter === "all" || r.kind === filter);
  return (
    <Collapsible title="Evidence & Assumptions" summary="Which values you entered, which are sourced, illustrative, derived or missing, and which assumptions matter.">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2"><PageHelpButton id="evidence" label="How to read this" /></div>
        <EvidenceSummary evidence={evidence} />
        <div>
          <label className="text-sm font-semibold text-navy-950">Show assumptions
            <select className="ml-2 rounded-lg border border-navy-200 bg-surface px-2 py-1.5 text-sm font-normal" value={filter} onChange={(e) => setFilter(e.target.value as AssumptionKind | "all")}>
              <option value="all">All</option>
              {KINDS.map((k) => <option key={k} value={k}>{PROVENANCE_LABEL[k]}</option>)}
            </select>
          </label>
          <div className="mt-2">
            <ResponsiveTable caption="Assumptions and their provenance">
              <thead><tr className="border-b border-line bg-navy-50 text-navy-800">{["Assumption", "Value", "Provenance", "Source", "Year"].map((h) => <th key={h} scope="col" className="px-3 py-2 text-left text-xs font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {rows.map(({ a, kind, src }) => (
                  <tr key={a.id} className="border-b border-line align-top last:border-0">
                    <th scope="row" className="px-3 py-2 text-left text-xs font-medium text-navy-900">{a.label}</th>
                    <td className="px-3 py-2 text-xs">{f.text(a.value)}{a.unit ? ` ${f.text(a.unit)}` : ""}</td>
                    <td className="px-3 py-2"><AssumptionBadge kind={kind} /></td>
                    <td className="px-3 py-2 text-xs">{kind === "user" || kind === "sourced" || kind === "illustrative" ? src.source ?? "Not supplied" : ""}</td>
                    <td className="px-3 py-2 text-xs">{src.year ?? ""}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-3 text-xs text-slate-600">No assumptions of this kind.</td></tr>}
              </tbody>
            </ResponsiveTable>
          </div>
        </div>
      </div>
    </Collapsible>
  );
}
