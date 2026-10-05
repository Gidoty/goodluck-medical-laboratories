import { AssumptionBadge } from "@/components/ui/assumption-badge";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { TECH_NAMES, type GreenTechId } from "@/calculation/types";
import type { EvidenceQuality } from "@/reporting/types";

const GREEN: readonly GreenTechId[] = ["bev", "biofuel"];
const th = "px-3 py-2 text-left text-xs font-semibold";
const td = "px-3 py-2 align-top text-xs text-navy-900";

/** Evidence quality as descriptive states and counts. There is no score and no confidence percentage. */
export function EvidenceSummary({ evidence: e }: { evidence: EvidenceQuality }) {
  const p = e.provenance;
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-navy-950">{e.overall}</p>
      <ResponsiveTable caption="Evidence completeness by dimension and alternative">
        <thead><tr className="border-b border-line bg-navy-50 text-navy-800"><th scope="col" className={th}>Dimension</th>{GREEN.map((t) => <th key={t} scope="col" className={th}>{TECH_NAMES[t]}</th>)}</tr></thead>
        <tbody>
          {(["economic", "operational", "environmental"] as const).map((d) => (
            <tr key={d} className="border-b border-line last:border-0 align-top">
              <th scope="row" className="px-3 py-2 text-left text-xs font-medium capitalize">{d}</th>
              {GREEN.map((t) => <td key={t} className={td}><strong>{e.dimensions[t][d].state}</strong><span className="block text-slate-700">{e.dimensions[t][d].detail}</span></td>)}
            </tr>
          ))}
        </tbody>
      </ResponsiveTable>
      <ul className="space-y-1 text-sm text-navy-900">{GREEN.map((t) => <li key={t}><strong>{TECH_NAMES[t]}:</strong> {e.statements[t]}</li>)}</ul>
      <div className="report-card">
        <h3 className="text-sm font-semibold text-navy-950">Provenance composition</h3>
        <dl className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          {([["user", p.userInputs], ["sourced", p.sourced], ["illustrative", p.illustrative], ["derived", p.derived], ["convention", p.conventions], ["excluded", p.missingExcluded]] as const).map(([k, n]) => (
            <div key={k} className="flex items-center justify-between gap-2 border-b border-line py-1"><dt><AssumptionBadge kind={k} /></dt><dd className="font-semibold tabular-nums">{n}</dd></div>
          ))}
        </dl>
        <p className="mt-1 text-xs text-slate-600">Counts of the assumption records behind the results. A missing value is counted as missing, never as zero.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="report-card"><h3 className="text-sm font-semibold text-navy-950">Critical missing inputs ({e.criticalMissing.length})</h3>{e.criticalMissing.length === 0 ? <p className="text-sm text-slate-600">None.</p> : <ul className="list-disc pl-5 text-sm">{e.criticalMissing.map((x, i) => <li key={i}>{TECH_NAMES[x.technology]}: {x.text}</li>)}</ul>}</div>
        <div className="report-card"><h3 className="text-sm font-semibold text-navy-950">Material uncertainties ({e.materialUncertainties.length})</h3>{e.materialUncertainties.length === 0 ? <p className="text-sm text-slate-600">None identified.</p> : <ul className="list-disc pl-5 text-sm">{e.materialUncertainties.map((x, i) => <li key={i}>{TECH_NAMES[x.technology]}: {x.text}</li>)}</ul>}</div>
      </div>
      <div className="report-card">
        <h3 className="text-sm font-semibold text-navy-950">Assumptions that materially affect the conclusion</h3>
        {e.materialAssumptions.length === 0 ? <p className="text-sm text-slate-600">None identified from the decision logic. Run the sensitivity page to add tested drivers.</p> : <ul className="mt-1 space-y-1 text-sm">{e.materialAssumptions.map((m) => <li key={m.label}><strong>{m.label}</strong><span className="block text-xs text-slate-700">{m.because.join(" ")}</span></li>)}</ul>}
      </div>
      <p className="text-xs text-slate-700">{e.confidenceNote}</p>
    </div>
  );
}
