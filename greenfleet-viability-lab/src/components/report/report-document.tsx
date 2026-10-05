import type { ReactNode } from "react";
import { AssumptionBadge } from "@/components/ui/assumption-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { BADGE_STATUS } from "@/components/results/commercial-sections";
import type { ResultFormatter } from "@/components/results/format-results";
import { CashFlowChart, TcoChart } from "@/components/results/results-charts";
import { formatValue } from "@/calculation/analysis/format";
import { OPERATIONAL_STATUS_LABEL } from "@/calculation/operational/types";
import { TECH_NAMES, type AssessmentCalculationResult, type GreenTechId } from "@/calculation/types";
import { CLASSIFICATION_LABEL } from "@/calculation/viability/types";
import { formatDateTime, formatNumber } from "@/lib/format";
import { cellText } from "@/reporting/cells";
import { PROVENANCE_LABEL } from "@/reporting/provenance";
import type { ReportModel, TableRow } from "@/reporting/types";
import { EvidenceSummary } from "./evidence-panel";

const th = "px-3 py-2 text-left text-xs font-semibold";
const td = "px-3 py-2 align-top text-xs text-navy-900";

function Section({ n, title, id, children, pageBreak }: { n: number; title: string; id: string; children: ReactNode; pageBreak?: boolean }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={`report-section mt-10 ${pageBreak ? "report-page-break" : ""}`}>
      <h2 id={`${id}-h`} className="border-b border-line pb-1 text-xl font-semibold text-navy-950"><span className="text-forest-700">{n}.</span> {title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Table({ caption, columns, rows, f }: { caption: string; columns: string[]; rows: TableRow[]; f: ResultFormatter }) {
  return (
    <ResponsiveTable caption={caption}>
      <thead><tr className="border-b border-line bg-navy-50 text-navy-800"><th scope="col" className={th}>Metric</th>{columns.map((c) => <th key={c} scope="col" className={th}>{c}</th>)}</tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-line last:border-0">
            <th scope="row" className="px-3 py-2 text-left text-xs font-medium text-navy-900">{r.label}{r.note && <span className="block font-normal text-slate-600">{r.note}</span>}</th>
            {r.cells.map((c, i) => <td key={i} className={`${td} tabular-nums`}>{c.kind === "class" ? <StatusBadge status={BADGE_STATUS[c.value]} size="sm" /> : cellText(c, f)}</td>)}
          </tr>
        ))}
      </tbody>
    </ResponsiveTable>
  );
}

const Notice = ({ children }: { children: ReactNode }) => <p className="rounded-lg border border-line bg-navy-50/60 p-3 text-sm text-navy-900">{children}</p>;
const Bullets = ({ items, f }: { items: string[]; f: ResultFormatter }) => (items.length === 0 ? null : <ul className="list-disc space-y-1 pl-5 text-sm text-navy-900">{items.map((x, i) => <li key={i}>{f.text(x)}</li>)}</ul>);

export function ReportDocument({ model: m, result, f }: { model: ReportModel; result: AssessmentCalculationResult; f: ResultFormatter }) {
  const id = m.identity;
  const sections: { id: string; title: string; node: ReactNode; pageBreak?: boolean }[] = [];

  sections.push({
    id: "executive", title: "Executive decision summary", node: (
      <>
        <div className="space-y-3 text-sm leading-relaxed text-navy-900">{m.executive.paragraphs.map((p, i) => <p key={i}>{f.text(p)}</p>)}</div>
        <div className="grid gap-3 md:grid-cols-3">
          {m.executive.cards.map((c) => (
            <div key={c.technology} className="report-card rounded-xl border border-line p-4">
              <h3 className="text-sm font-semibold text-navy-950">{c.title}</h3>
              <div className="mt-1">{c.classification === "BASELINE" ? <span className="inline-block rounded-md border-2 border-slate-400 bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-800">BASELINE</span> : <StatusBadge status={BADGE_STATUS[c.classification]} size="sm" />}</div>
              <dl className="mt-2 divide-y divide-line text-xs">{c.rows.map((r) => <div key={r.label} className="flex flex-wrap justify-between gap-x-2 py-1"><dt className="text-slate-700">{r.label}</dt><dd className="text-right font-semibold text-navy-950">{cellText(r.cells[0]!, f)}</dd></div>)}</dl>
            </div>
          ))}
        </div>
        <div className="report-card">
          <h3 className="text-sm font-semibold text-navy-950">Key decision points</h3>
          <Bullets items={m.executive.keyDecisionPoints} f={f} />
        </div>
      </>
    ),
  });

  sections.push({
    id: "profile", title: "Assessment profile", node: <dl className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">{m.profile.map((p) => <div key={p.label} className="flex justify-between gap-3 border-b border-line py-1"><dt className="text-slate-700">{p.label}</dt><dd className="text-right font-medium text-navy-950">{p.value}</dd></div>)}</dl>,
  });

  if (m.assumptions.length > 0) {
    sections.push({
      id: "assumptions", title: "Assumptions and data sources", pageBreak: true, node: (
        <>
          <p className="text-xs text-slate-700">Source, year and notes are shown only where the user supplied them. Where none was supplied the report says &ldquo;Not supplied&rdquo; and does not invent a citation.</p>
          <ResponsiveTable caption="Assumptions, provenance and sources">
            <thead><tr className="border-b border-line bg-navy-50 text-navy-800">{["Category", "Variable", "Value", "Unit", "Provenance", "Source", "Year", "Notes"].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {m.assumptions.map((a, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className={td}>{a.category}</td>
                  <th scope="row" className="px-3 py-2 text-left text-xs font-medium text-navy-900">{a.label}</th>
                  <td className={td}>{f.text(a.value)}</td>
                  <td className={td}>{a.unit ? f.text(a.unit) : ""}</td>
                  <td className={td}><AssumptionBadge kind={a.provenance} /><span className="sr-only">{PROVENANCE_LABEL[a.provenance]}</span></td>
                  <td className={td}>{a.provenance === "user" || a.provenance === "sourced" || a.provenance === "illustrative" ? a.source ?? "Not supplied" : ""}</td>
                  <td className={td}>{a.year ?? (a.provenance === "user" || a.provenance === "sourced" ? "Not supplied" : "")}</td>
                  <td className={td}>{a.notes ? f.text(a.notes) : ""}</td>
                </tr>
              ))}
            </tbody>
          </ResponsiveTable>
        </>
      ),
    });
  }

  sections.push({ id: "comparison", title: "Technology comparison", node: <Table caption="Diesel, battery electric and biofuel compared" columns={m.comparison.columns} rows={m.comparison.rows} f={f} /> });

  sections.push({
    id: "economic", title: "Economic performance", pageBreak: true, node: (
      <>
        <Table caption="Additional economic measures" columns={m.comparison.columns} rows={m.economic.rows} f={f} />
        <div className="grid gap-4 lg:grid-cols-2"><TcoChart result={result} f={f} /><CashFlowChart result={result} f={f} /></div>
        <dl className="grid gap-2 text-xs sm:grid-cols-2">{m.economic.definitions.map((d) => <div key={d.term} className="report-card"><dt className="font-semibold text-navy-950">{d.term}</dt><dd className="text-slate-700">{d.text}</dd></div>)}</dl>
      </>
    ),
  });

  sections.push({
    id: "operational", title: "Operational feasibility", node: (
      <div className="grid gap-4 lg:grid-cols-2">
        {m.operational.map((o) => (
          <div key={o.technology} className="report-card rounded-xl border border-line p-4">
            <h3 className="text-base font-semibold text-navy-950">{TECH_NAMES[o.technology]}: {OPERATIONAL_STATUS_LABEL[o.status]}</h3>
            <dl className="mt-2 divide-y divide-line text-sm">{o.rows.map((r) => <div key={r.label} className="flex flex-wrap justify-between gap-x-3 py-1"><dt className="text-slate-700">{r.label}</dt><dd className="text-right font-medium text-navy-950">{r.value}</dd></div>)}</dl>
            {o.constraints.length > 0 && <div className="mt-2"><p className="text-xs font-semibold text-red-900">Constraints</p><Bullets items={o.constraints} f={f} /></div>}
            {o.conditions.length > 0 && <div className="mt-2"><p className="text-xs font-semibold text-amber-900">Conditions</p><Bullets items={o.conditions} f={f} /></div>}
            {o.notAssessed.length > 0 && <p className="mt-2 text-xs text-slate-600">Not assessed: {o.notAssessed.join(", ")}.</p>}
          </div>
        ))}
      </div>
    ),
  });

  sections.push({
    id: "environmental", title: "Environmental performance", node: (
      <>
        <p className="text-sm text-navy-900"><strong>Scope:</strong> {m.environmental.scope}. This is not a lifecycle assessment.</p>
        {m.environmental.unavailableNote && <Notice>{m.environmental.unavailableNote}</Notice>}
        <Table caption="Estimated operational emissions" columns={m.comparison.columns} rows={m.environmental.rows} f={f} />
        <ResponsiveTable caption="Emission factors used and their sources">
          <thead><tr className="border-b border-line bg-navy-50 text-navy-800">{["Factor for", "Value", "Unit", "Source", "Year", "Scope"].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
          <tbody>{m.environmental.factors.map((x) => <tr key={x.technology} className="border-b border-line last:border-0"><th scope="row" className="px-3 py-2 text-left text-xs font-medium">{x.technology}</th><td className={td}>{x.value}</td><td className={td}>{x.unit}</td><td className={td}>{x.source}</td><td className={td}>{x.year}</td><td className={td}>{x.scope}</td></tr>)}</tbody>
        </ResponsiveTable>
        <Bullets items={m.environmental.comparisons.map((c) => c.text)} f={f} />
      </>
    ),
  });

  sections.push({
    id: "commercial", title: "Commercial viability", pageBreak: true, node: (
      <div className="space-y-4">
        {m.commercial.map((c) => (
          <div key={c.technology} className="report-card rounded-xl border border-line p-4">
            <div className="flex flex-wrap items-center gap-3"><h3 className="text-base font-semibold text-navy-950">{TECH_NAMES[c.technology]} against diesel</h3><StatusBadge status={BADGE_STATUS[c.classification]} size="md" /></div>
            <p className="mt-2 text-sm font-medium text-navy-950">{f.text(c.primaryReason)}</p>
            <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-3 border-b border-line py-1"><dt className="text-slate-700">Economic case</dt><dd className="font-medium">{c.economicCase.replace(/_/g, " ").toLowerCase()}</dd></div>
              <div className="flex justify-between gap-3 border-b border-line py-1"><dt className="text-slate-700">Operational status</dt><dd className="font-medium">{OPERATIONAL_STATUS_LABEL[c.operationalStatus]}</dd></div>
              <div className="flex justify-between gap-3 border-b border-line py-1 sm:col-span-2"><dt className="text-slate-700">Environmental context</dt><dd className="text-right font-medium">{f.text(c.environmentalContext)}</dd></div>
              <div className="flex justify-between gap-3 border-b border-line py-1"><dt className="text-slate-700">Policy</dt><dd className="font-medium">v{c.policyVersion}</dd></div>
            </dl>
            {c.supportingEvidence.length > 0 && <div className="mt-2"><p className="text-xs font-semibold text-navy-950">Supporting evidence</p><dl className="divide-y divide-line text-xs">{c.supportingEvidence.filter((e) => e.label !== "Operational status").map((e) => <div key={e.label} className="flex flex-wrap justify-between gap-x-3 py-0.5"><dt className="text-slate-700">{e.label}</dt><dd className="font-medium">{f.text(e.value)}</dd></div>)}</dl></div>}
            {c.hardConstraints.length > 0 && <div className="mt-2"><p className="text-xs font-semibold text-red-900">Hard constraints</p><Bullets items={c.hardConstraints} f={f} /></div>}
            {c.conditions.length > 0 && <div className="mt-2"><p className="text-xs font-semibold text-amber-900">Conditions</p><Bullets items={c.conditions} f={f} /></div>}
            {c.uncertainties.length > 0 && <div className="mt-2"><p className="text-xs font-semibold text-navy-950">Uncertainties</p><Bullets items={c.uncertainties} f={f} /></div>}
            {c.criticalMissing.length > 0 && <div className="mt-2"><p className="text-xs font-semibold text-slate-900">Missing evidence</p><Bullets items={c.criticalMissing} f={f} /></div>}
          </div>
        ))}
      </div>
    ),
  });

  sections.push({
    id: "trace", title: "Why this result: decision trace", node: (
      <div className="grid gap-4 lg:grid-cols-2">
        {m.commercial.map((c) => (
          <div key={c.technology} className="report-card">
            <h3 className="text-sm font-semibold text-navy-950">{TECH_NAMES[c.technology]}</h3>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-xs text-navy-900">{c.trace.map((t, i) => <li key={i}>{f.text(t)}</li>)}</ol>
            <p className="mt-2 font-mono text-[0.65rem] text-slate-600">{c.reasonCodes.join(", ")}</p>
          </div>
        ))}
      </div>
    ),
  });

  if (m.sensitivity.state !== "omitted") {
    sections.push({
      id: "sensitivity", title: "Sensitivity analysis", pageBreak: true, node: m.sensitivity.state === "not_run" ? <Notice>{m.sensitivity.message}</Notice> : (
        <>
          <p className="text-xs text-slate-700">Each analysis changes one assumption and holds all others at the Base Case. Results hold {m.sensitivity.phrase}. They do not show that an assumption causes the result.</p>
          {m.sensitivity.drivers.map((d) => (
            <div key={d.technology} className="report-card">
              <h3 className="text-sm font-semibold text-navy-950">Largest tested NPV influences, {TECH_NAMES[d.technology]} ({m.sensitivity.phrase})</h3>
              <ol className="mt-1 space-y-1 text-sm">
                {d.top.map((t) => {
                  const max = d.top[0]!.spread || 1;
                  return <li key={t.rank}><span className="font-medium">{t.rank}. {t.label}</span> <span className="text-slate-700">NPV spread {f.money(t.spread)}</span><div aria-hidden className="mt-0.5 h-2 rounded bg-navy-50"><div className="h-2 rounded bg-forest-600" style={{ width: `${Math.max(2, (t.spread / max) * 100)}%` }} /></div></li>;
                })}
              </ol>
            </div>
          ))}
          {m.sensitivity.oneWay.length > 0 && (
            <ResponsiveTable caption="One-way sensitivity runs">
              <thead><tr className="border-b border-line bg-navy-50 text-navy-800">{["Alternative", "Variable", "Base value", "Tested range", "NPV range", "Classification across the range", "NPV = 0"].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {m.sensitivity.oneWay.map((r) => {
                  const classes = [...new Set(r.points.map((p) => CLASSIFICATION_LABEL[p.classification]))];
                  return (
                    <tr key={r.technology + r.variableId} className="border-b border-line last:border-0">
                      <td className={td}>{TECH_NAMES[r.technology]}</td><th scope="row" className="px-3 py-2 text-left text-xs font-medium">{r.variableLabel}</th>
                      <td className={td}>{f.text(formatValue(r.unit, r.baseValue))}</td>
                      <td className={td}>{f.text(formatValue(r.unit, r.transparency.testedMin))} to {f.text(formatValue(r.unit, r.transparency.testedMax))}</td>
                      <td className={td}>{f.money(r.npvMin)} to {f.money(r.npvMax)}</td>
                      <td className={td}>{classes.join(", ")}</td>
                      <td className={td}>{r.breakEven ? `≈ ${f.text(formatValue(r.unit, r.breakEven.value, true))}` : "Not within the tested range"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </ResponsiveTable>
          )}
        </>
      ),
    });
  }

  if (m.scenarios.state !== "omitted") {
    sections.push({
      id: "scenarios", title: "Scenario analysis", node: !m.scenarios.comparison ? <Notice>{m.scenarios.message}</Notice> : (
        <>
          <p className="text-xs text-slate-700">The Base Case is always shown first and is never mixed with scenario results. Scenarios are user-created sets of assumptions, not forecasts.</p>
          {(["bev", "biofuel"] as GreenTechId[]).map((t) => {
            const c = m.scenarios.comparison!;
            const cols = [c.base, ...c.scenarios];
            const rows: [string, (x: NonNullable<typeof c.base.bev>) => string][] = [
              ["Incremental NPV vs diesel", (x) => f.money(x.snapshot.npv)], ["Total cost of ownership", (x) => f.money(x.snapshot.tco)], ["Cost per km", (x) => f.perKm(x.snapshot.tcoPerKm)],
              ["Discounted payback", (x) => f.years(x.snapshot.discountedPayback)], ["Operational status", (x) => OPERATIONAL_STATUS_LABEL[x.snapshot.operationalStatus]],
              ["Environmental result", (x) => (x.snapshot.environmental.state === "unavailable" ? "Unavailable" : x.snapshot.environmental.state === "unchanged" ? "No difference" : `${x.snapshot.environmental.state === "lower" ? "Lower" : "Higher"} than diesel`)],
              ["Commercial classification", (x) => CLASSIFICATION_LABEL[x.snapshot.classification]],
            ];
            return (
              <ResponsiveTable key={t} caption={`${TECH_NAMES[t]}: Base Case and scenarios`}>
                <thead><tr className="border-b border-line bg-navy-50 text-navy-800"><th scope="col" className={th}>{TECH_NAMES[t]}</th>{cols.map((x, i) => <th key={i} scope="col" className={th}>{x.name}{x.scenario ? "" : " (Base)"}</th>)}</tr></thead>
                <tbody>{rows.map(([label, fn]) => <tr key={label} className="border-b border-line last:border-0"><th scope="row" className="px-3 py-2 text-left text-xs font-medium">{label}</th>{cols.map((x, i) => { const r = t === "bev" ? x.bev : x.biofuel; return <td key={i} className={td}>{r ? fn(r) : "Could not be calculated"}</td>; })}</tr>)}</tbody>
              </ResponsiveTable>
            );
          })}
          <div className="grid gap-3 md:grid-cols-2">
            {m.scenarios.comparison.scenarios.map((s) => (
              <div key={s.scenario!.id} className="report-card rounded-xl border border-line p-3 text-xs">
                <p className="font-semibold text-navy-950">{s.name}</p>
                {s.scenario!.description && <p className="text-slate-700">{s.scenario!.description}</p>}
                <p className="mt-1 font-semibold text-forest-800">Changed from the Base Case</p>
                <ul className="list-disc pl-4">{s.changes.map((c) => <li key={c.variableId}>{c.label}: {f.text(c.fromText)} → {f.text(c.toText)}</li>)}</ul>
              </div>
            ))}
          </div>
        </>
      ),
    });
  }

  if (m.thresholds.state !== "omitted") {
    sections.push({
      id: "thresholds", title: "What would make it viable? / Viability margin", node: m.thresholds.state === "not_run" ? <Notice>{m.thresholds.message}</Notice> : (
        <>
          <p className="text-xs text-slate-700">Thresholds are model-derived values based on the entered assumptions. Each changes one assumption, all else equal, and is not a forecast.</p>
          {m.thresholds.analyses.map((a) => {
            const all = [...a.economicThresholds, ...a.classificationThresholds];
            return (
              <div key={a.technology} className="report-card rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-center gap-3"><h3 className="text-base font-semibold text-navy-950">{a.heading}: {TECH_NAMES[a.technology]}</h3>{a.classification && <StatusBadge status={BADGE_STATUS[a.classification]} size="sm" />}</div>
                {a.mode === "blocked" ? <Bullets items={a.missingInputs} f={f} /> : (
                  <>
                    <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
                      {([["Economic barriers", a.barriers.economic], ["Operational barriers", a.barriers.operational], ["Evidence and uncertainty", a.barriers.evidence]] as const).map(([t, l]) => <div key={t}><p className="font-semibold text-navy-950">{t}</p>{l.length === 0 ? <p className="text-slate-600">None identified.</p> : <ul className="list-disc pl-4">{l.map((b, i) => <li key={i}>{f.text(b.text)}</li>)}</ul>}</div>)}
                    </div>
                    {all.length > 0 && (
                      <div className="mt-3">
                        <ResponsiveTable caption={`Threshold results, ${TECH_NAMES[a.technology]}`}>
                          <thead><tr className="border-b border-line bg-navy-50 text-navy-800">{["Variable", "Current", "Threshold (approximately)", "Required change", "Target", "Solver status", "Remaining barriers"].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
                          <tbody>
                            {all.map((t, i) => (
                              <tr key={i} className="border-b border-line align-top last:border-0">
                                <th scope="row" className="px-3 py-2 text-left text-xs font-medium">{t.variableLabel}</th>
                                <td className={td}>{t.currentDisplay ? f.text(t.currentDisplay) : "—"}</td>
                                <td className={td}>{t.thresholdDisplay ? `≈ ${f.text(t.thresholdDisplay)}` : "No value found"}</td>
                                <td className={td}>{t.requiredChange ? `${t.requiredChange.direction}${t.requiredChange.percent === null ? "" : ` (${formatNumber(t.requiredChange.percent, 1)}%)`}` : "—"}</td>
                                <td className={td}>{t.target === "economic_break_even" ? "Economic break-even" : "Classification change"}</td>
                                <td className={td}>{t.status.replace(/_/g, " ").toLowerCase()}</td>
                                <td className={td}>{t.blockers.hardConstraints.length > 0 ? `${t.blockers.hardConstraints.length} operational constraint(s) remain` : "None"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </ResponsiveTable>
                      </div>
                    )}
                    {a.remedies.length > 0 && <div className="mt-2"><p className="text-xs font-semibold text-navy-950">Operational changes</p><Bullets items={a.remedies.map((r) => r.text)} f={f} /></div>}
                  </>
                )}
              </div>
            );
          })}
          <div className="report-card"><h3 className="text-sm font-semibold text-navy-950">Barrier statements</h3><Bullets items={m.thresholds.barrierStatements.map((s) => `${TECH_NAMES[s.technology]}: ${s.text}`)} f={f} /></div>
        </>
      ),
    });
  }

  sections.push({ id: "evidence", title: "Evidence quality and data provenance", pageBreak: true, node: <EvidenceSummary evidence={m.evidence} /> });
  if (m.methodology.length > 0) {
    sections.push({ id: "methodology", title: "Methodology summary", node: <><dl className="space-y-2 text-sm">{m.methodology.map((x) => <div key={x.heading} className="report-card"><dt className="font-semibold text-navy-950">{x.heading}</dt><dd className="text-slate-800">{x.text}</dd></div>)}</dl><p className="text-xs text-slate-600">The full formulas and rules are on the in-app Methodology page.</p></> });
  }
  sections.push({ id: "limitations", title: "Limitations", node: <ul className="list-disc space-y-1 pl-5 text-sm text-navy-900">{m.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul> });
  sections.push({ id: "disclaimer", title: "Disclaimer", node: <><p className="text-sm text-navy-900">{m.disclaimer}</p></> });

  return (
    <article aria-label="Professional assessment report" className="report mx-auto max-w-5xl">
      <header className="report-cover rounded-card border border-line bg-surface p-6 sm:p-10 print:border-0 print:p-0">
        <p className="text-sm font-semibold uppercase tracking-widest text-forest-700">{id.product}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-navy-950 sm:text-4xl">{id.title}</h1>
        <p className="mt-3 text-xl text-navy-900">{id.assessmentName}</p>
        <dl className="mt-6 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          {id.businessName && <div className="flex justify-between gap-3 border-b border-line py-1"><dt className="text-slate-700">Business</dt><dd className="font-medium">{id.businessName}</dd></div>}
          {id.location && <div className="flex justify-between gap-3 border-b border-line py-1"><dt className="text-slate-700">Location</dt><dd className="font-medium">{id.location}</dd></div>}
          <div className="flex justify-between gap-3 border-b border-line py-1"><dt className="text-slate-700">Assessment last updated</dt><dd className="font-medium">{formatDateTime(id.assessedAt)}</dd></div>
          <div className="flex justify-between gap-3 border-b border-line py-1"><dt className="text-slate-700">Report generated</dt><dd className="font-medium">{formatDateTime(id.generatedAt)}</dd></div>
          <div className="flex justify-between gap-3 border-b border-line py-1"><dt className="text-slate-700">Currency</dt><dd className="font-medium">{id.currency}</dd></div>
          <div className="flex justify-between gap-3 border-b border-line py-1"><dt className="text-slate-700">Analysis horizon</dt><dd className="font-medium">{id.horizonYears} years</dd></div>
          <div className="flex justify-between gap-3 border-b border-line py-1"><dt className="text-slate-700">Report version</dt><dd className="font-medium">{id.reportVersion} (application {id.appVersion})</dd></div>
          <div className="flex justify-between gap-3 border-b border-line py-1"><dt className="text-slate-700">Calculation engine</dt><dd className="font-medium">{id.engineVersion}</dd></div>
          <div className="flex justify-between gap-3 border-b border-line py-1 sm:col-span-2"><dt className="text-slate-700">Decision policy</dt><dd className="font-medium">{id.policyId}</dd></div>
        </dl>
        {id.dataOrigin === "demo" && <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">This report uses illustrative demo values. They say nothing about real costs.</p>}
        <p className="mt-6 text-sm font-medium text-navy-700">{id.authorship}</p>
      </header>
      {sections.map((s, i) => <Section key={s.id} n={i + 1} id={s.id} title={s.title} pageBreak={s.pageBreak}>{s.node}</Section>)}
      <footer className="report-section mt-10 border-t border-line pt-3 text-xs text-slate-600"><p>{m.footer}</p><p>{id.authorship}</p></footer>
    </article>
  );
}
