"use client";

import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useReducer, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { BADGE_STATUS } from "@/components/results/commercial-sections";
import type { ResultFormatter } from "@/components/results/format-results";
import { TECH_NAMES, type AssessmentCalculationResult, type GreenTechId } from "@/calculation/types";
import { OPERATIONAL_STATUS_LABEL } from "@/calculation/operational/types";
import { cellText } from "@/reporting/cells";
import { buildReportModel } from "@/reporting/model";
import { buildPresentationScreens, keyToAction, presentationReducer, type ScreenId } from "@/reporting/presentation";
import type { ReportModel } from "@/reporting/types";
import { useReportData } from "@/reporting/useReportData";
import { EmptyReport } from "@/components/report/report-view";

const GREEN: readonly GreenTechId[] = ["bev", "biofuel"];
const big = "text-2xl sm:text-3xl";

function Bars({ items, f }: { items: { label: string; value: number }[]; f: ResultFormatter }) {
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);
  return (
    <ul className="space-y-4">
      {items.map((i) => (
        <li key={i.label}>
          <div className="flex items-baseline justify-between gap-3 text-lg sm:text-xl"><span className="font-semibold text-navy-950">{i.label}</span><span className="tabular-nums text-navy-900">{f.money(i.value)}</span></div>
          <div aria-hidden className="mt-1 h-5 rounded bg-navy-50"><div className="h-5 rounded bg-forest-600" style={{ width: `${Math.max(2, (Math.abs(i.value) / max) * 100)}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

export function PresentationScreen({ id, m, result, f }: { id: ScreenId; m: ReportModel; result: AssessmentCalculationResult; f: ResultFormatter }) {
  const row = (label: string) => m.comparison.rows.find((r) => r.label === label)!;
  switch (id) {
    case "snapshot":
      return (
        <div className="space-y-6">
          <p className="text-xl text-navy-900 sm:text-2xl">{m.identity.assessmentName}{m.identity.businessName ? `, ${m.identity.businessName}` : ""}</p>
          <p className="text-lg text-slate-700">This is the Base Case: your current assessment, in {m.identity.currency}, over {m.identity.horizonYears} years.</p>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{m.profile.slice(0, 9).map((p) => <div key={p.label} className="rounded-xl border border-line bg-surface p-4"><dt className="text-sm text-slate-700">{p.label}</dt><dd className="text-xl font-semibold text-navy-950">{p.value}</dd></div>)}</dl>
          {m.identity.dataOrigin === "demo" && <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950">Illustrative demo values. They say nothing about real costs.</p>}
        </div>
      );
    case "comparison": {
      const labels = ["Total cost of ownership (undiscounted)", "Cost per km", "Incremental NPV vs diesel", "Discounted payback", "Operational status", "Commercial classification"];
      return (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[34rem] border-collapse text-left text-base sm:text-lg">
            <caption className="sr-only">Key measures for diesel, battery electric and biofuel</caption>
            <thead><tr className="border-b border-line bg-navy-50"><th scope="col" className="px-4 py-3">Measure</th>{m.comparison.columns.map((c) => <th key={c} scope="col" className="px-4 py-3">{c}</th>)}</tr></thead>
            <tbody>{labels.map((l) => { const r = row(l); return <tr key={l} className="border-b border-line last:border-0"><th scope="row" className="px-4 py-3 font-medium">{l}</th>{r.cells.map((c, i) => <td key={i} className="px-4 py-3 tabular-nums">{c.kind === "class" ? <StatusBadge status={BADGE_STATUS[c.value]} size="md" /> : cellText(c, f)}</td>)}</tr>; })}</tbody>
          </table>
        </div>
      );
    }
    case "economic":
      return (
        <div className="grid gap-10 lg:grid-cols-2">
          <div><h3 className="mb-3 text-lg font-semibold text-navy-950">Total cost of ownership over {m.identity.horizonYears} years</h3><Bars f={f} items={(["diesel", "bev", "biofuel"] as const).map((t) => ({ label: t === "diesel" ? "Diesel (baseline)" : TECH_NAMES[t], value: result[t].undiscountedTco }))} /></div>
          <div><h3 className="mb-3 text-lg font-semibold text-navy-950">Incremental NPV against diesel</h3><Bars f={f} items={GREEN.map((t) => ({ label: TECH_NAMES[t], value: (t === "bev" ? result.bevVsDiesel : result.biofuelVsDiesel).npv }))} /><p className="mt-4 text-base text-slate-700">Positive means an economic advantage over diesel under the entered assumptions. Negative means a disadvantage.</p></div>
        </div>
      );
    case "operational":
      return (
        <div className="grid gap-6 lg:grid-cols-2">
          {m.operational.map((o) => (
            <div key={o.technology} className="rounded-xl border border-line bg-surface p-5">
              <h3 className="text-xl font-semibold text-navy-950">{TECH_NAMES[o.technology]}</h3>
              <p className={`mt-1 ${big} font-semibold text-navy-950`}>{OPERATIONAL_STATUS_LABEL[o.status]}</p>
              <dl className="mt-3 space-y-1 text-lg">{o.rows.slice(0, 4).map((r) => <div key={r.label} className="flex flex-wrap justify-between gap-x-3"><dt className="text-slate-700">{r.label}</dt><dd className="font-medium">{r.value}</dd></div>)}</dl>
              {[...o.constraints.map((c) => ["Constraint", c]), ...o.conditions.map((c) => ["Condition", c])].slice(0, 3).map(([k, c], i) => <p key={i} className="mt-2 text-base text-navy-900"><strong>{k}:</strong> {f.text(c!)}</p>)}
            </div>
          ))}
        </div>
      );
    case "environmental":
      return (
        <div className="space-y-5">
          <p className="text-lg text-slate-700">Scope: {m.environmental.scope}. Not a lifecycle assessment.</p>
          {m.environmental.unavailableNote && <p className="rounded-xl border border-slate-300 bg-slate-100 p-5 text-xl text-slate-900">{m.environmental.unavailableNote}</p>}
          <ul className="space-y-3 text-xl text-navy-950">{m.environmental.comparisons.map((c) => <li key={c.technology}><strong>{TECH_NAMES[c.technology]}:</strong> {f.text(c.text)}</li>)}</ul>
          {m.environmental.available && <div className="overflow-x-auto rounded-xl border border-line bg-surface"><table className="w-full min-w-[30rem] text-left text-lg"><caption className="sr-only">Estimated annual operational emissions</caption><thead><tr className="border-b border-line bg-navy-50">{["", ...m.comparison.columns].map((c, i) => <th key={i} scope="col" className="px-4 py-3">{c}</th>)}</tr></thead><tbody><tr><th scope="row" className="px-4 py-3">Annual emissions</th>{m.environmental.rows[0]!.cells.map((c, i) => <td key={i} className="px-4 py-3">{cellText(c, f)}</td>)}</tr></tbody></table></div>}
        </div>
      );
    case "commercial":
      return (
        <div className="grid gap-6 lg:grid-cols-2">
          {m.commercial.map((c) => (
            <div key={c.technology} className="rounded-xl border border-line bg-surface p-6">
              <h3 className="text-xl font-semibold text-navy-950">{TECH_NAMES[c.technology]} against diesel</h3>
              <div className="mt-3 scale-110 origin-left"><StatusBadge status={BADGE_STATUS[c.classification]} size="lg" /></div>
              <p className="mt-5 text-xl leading-snug text-navy-950">{f.text(c.primaryReason)}</p>
              <p className="mt-3 text-base text-slate-700">Operational: {OPERATIONAL_STATUS_LABEL[c.operationalStatus]}. {f.text(c.environmentalContext)}</p>
            </div>
          ))}
          <p className="text-sm text-slate-600 lg:col-span-2">Diesel is the baseline and is not classified. {m.identity.policyId}. Decision-support result, not investment advice.</p>
        </div>
      );
    case "why":
      return (
        <div className="grid gap-6 lg:grid-cols-2">
          {m.commercial.map((c) => (
            <div key={c.technology} className="rounded-xl border border-line bg-surface p-5">
              <h3 className="text-xl font-semibold text-navy-950">{TECH_NAMES[c.technology]}</h3>
              <ol className="mt-3 list-decimal space-y-1.5 pl-6 text-base text-navy-900 sm:text-lg">{c.trace.slice(0, 9).map((t, i) => <li key={i}>{f.text(t)}</li>)}</ol>
            </div>
          ))}
        </div>
      );
    case "viability":
      return (
        <div className="space-y-6">
          {m.thresholds.analyses.map((a) => (
            <div key={a.technology} className="rounded-xl border border-line bg-surface p-5">
              <h3 className="text-xl font-semibold text-navy-950">{TECH_NAMES[a.technology]}: {a.heading}</h3>
              <ul className="mt-3 list-disc space-y-2 pl-6 text-lg text-navy-900">
                {m.thresholds.barrierStatements.filter((s) => s.technology === a.technology).slice(0, 3).map((s, i) => <li key={i}>{f.text(s.text)}</li>)}
                {a.mode === "blocked" && a.missingInputs.map((x, i) => <li key={i}>{f.text(x)}</li>)}
              </ul>
            </div>
          ))}
          <p className="text-sm text-slate-600">Thresholds are model-derived values based on the entered assumptions, all else equal. They are not forecasts.</p>
        </div>
      );
    case "drivers":
      return (
        <div className="grid gap-6 lg:grid-cols-2">
          {m.sensitivity.drivers.map((d) => (
            <div key={d.technology} className="rounded-xl border border-line bg-surface p-5">
              <h3 className="text-xl font-semibold text-navy-950">{TECH_NAMES[d.technology]}</h3>
              <Bars f={f} items={d.top.map((t) => ({ label: `${t.rank}. ${t.label}`, value: t.spread }))} />
              <p className="mt-3 text-sm text-slate-700">NPV spread across the prototype range, {m.sensitivity.phrase}.</p>
            </div>
          ))}
        </div>
      );
    case "takeaways":
      return (
        <div className="space-y-5">
          <ul className="list-disc space-y-3 pl-6 text-xl leading-snug text-navy-950 sm:text-2xl">{m.takeaways.map((t, i) => <li key={i}>{f.text(t)}</li>)}</ul>
          <p className="text-sm text-slate-600">{m.disclaimer}</p>
        </div>
      );
  }
}

export function PresentationDeck({ model, result, f, onExit }: { model: ReportModel; result: AssessmentCalculationResult; f: ResultFormatter; onExit: () => void }) {
  const screens = useMemo(() => buildPresentationScreens(model), [model]);
  const [state, dispatch] = useReducer((s: { index: number; exited: boolean }, a: Parameters<typeof presentationReducer>[1]) => presentationReducer(s, a, screens.length), { index: 0, exited: false });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      const a = keyToAction(e.key);
      if (!a) return;
      e.preventDefault();
      if (a.type === "exit") onExit();
      else dispatch(a);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);
  const cur = screens[state.index]!;
  return (
    <div className="flex min-h-dvh flex-col bg-paper text-navy-900">
      <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 sm:px-8">
        <p className="min-w-0 truncate text-sm font-semibold text-forest-800">GreenFleet Viability Lab · {model.identity.assessmentName}</p>
        <button type="button" onClick={onExit} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-navy-200 bg-surface px-3 py-2 text-sm font-semibold text-navy-800 hover:bg-navy-50"><X aria-hidden className="size-4" /> Exit Presentation</button>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-forest-700" aria-live="polite">Screen {state.index + 1} of {screens.length}</p>
        <h1 className="mt-1 mb-6 text-3xl font-semibold tracking-tight text-navy-950 sm:text-4xl">{cur.title}</h1>
        <PresentationScreen id={cur.id} m={model} result={result} f={f} />
      </main>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-4 py-3 sm:px-8">
        <button type="button" onClick={() => dispatch({ type: "previous" })} disabled={state.index === 0} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-navy-200 bg-surface px-4 py-2 font-semibold text-navy-800 hover:bg-navy-50 disabled:opacity-50"><ArrowLeft aria-hidden className="size-4" /> Previous</button>
        <div role="progressbar" aria-label="Presentation progress" aria-valuemin={1} aria-valuemax={screens.length} aria-valuenow={state.index + 1} className="hidden h-2 w-48 overflow-hidden rounded-full bg-navy-100 sm:block"><div className="h-full rounded-full bg-forest-600" style={{ width: `${((state.index + 1) / screens.length) * 100}%` }} /></div>
        <button type="button" onClick={() => dispatch({ type: "next" })} disabled={state.index === screens.length - 1} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-forest-700 px-4 py-2 font-semibold text-white hover:bg-forest-800 disabled:opacity-50">Next <ArrowRight aria-hidden className="size-4" /></button>
      </footer>
    </div>
  );
}

export function PresentationView() {
  const data = useReportData();
  const router = useRouter();
  const [now] = useState(() => new Date().toISOString());
  const model = useMemo(() => (data.status === "ok" ? buildReportModel({ input: data.input, result: data.result, analysis: data.analysis, scenarios: data.scenarios, now }) : null), [data, now]);
  if (data.status !== "ok" || !model) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyReport status={data.status === "ok" ? "loading" : data.status} />
        <p className="mt-4"><ButtonLink href="/results" variant="secondary">Back to Results</ButtonLink></p>
      </div>
    );
  }
  return <PresentationDeck model={model} result={data.result} f={data.f} onExit={() => router.push("/results")} />;
}
