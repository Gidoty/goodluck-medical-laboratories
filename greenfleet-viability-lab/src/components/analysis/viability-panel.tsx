"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Collapsible } from "@/components/ui/collapsible";
import { PageHelpButton } from "@/guidance/HelpButtons";
import { analyzeViability, type OperationalRemedy, type ThresholdResult } from "@/calculation/threshold";
import { formatValue } from "@/calculation/analysis/format";
import { scenarioDraftFromThreshold } from "@/calculation/scenario";
import { formatNumber } from "@/lib/format";
import { useAnalysisStore } from "@/state/useAnalysis";
import { useScenarios } from "@/state/useScenarios";
import type { NormalizedAssessmentInput } from "@/domain/normalized";
import type { GreenTechId } from "@/calculation/types";
import type { ResultFormatter } from "@/components/results/format-results";
import { ClassBadge, Disclaimer, TECH_LABEL } from "./shared";

const STATUS_WORD: Record<string, string> = {
  FOUND: "Found", ALREADY_SATISFIED: "Already satisfied", NOT_BRACKETED: "Not found in range", NON_MONOTONIC: "No reliable threshold", MAX_ITERATIONS: "Solver limit reached",
  VERIFICATION_FAILED: "Not verified", INSUFFICIENT_DATA: "Insufficient data", NOT_APPLICABLE: "Not applicable", BLOCKED_BY_OPERATIONAL_CONSTRAINT: "Blocked by an operational constraint", BLOCKED_BY_OPEN_CONDITIONS: "Blocked by open conditions",
};
const TARGET_WORD = { economic_break_even: "Economic break-even (incremental NPV approximately zero)", classification_transition: "Commercial classification change (Policy v1.0)" } as const;

function ThresholdCard({ t, f, tech }: { t: ThresholdResult; f: ResultFormatter; tech: GreenTechId }) {
  const { store } = useScenarios();
  const [msg, setMsg] = useState<string | null>(null);
  const rc = t.requiredChange;
  const Arrow = rc?.direction === "decrease" ? ArrowDown : rc?.direction === "increase" ? ArrowUp : Minus;
  const draft = scenarioDraftFromThreshold(t, TECH_LABEL[tech]);
  return (
    <Card className="p-5" data-testid={`threshold-${t.variableId}-${t.target}`}>
      <h4 className="text-sm font-semibold uppercase tracking-wide text-navy-900">{t.variableLabel}</h4>
      <p className="mt-0.5 text-xs text-slate-600">Target: {TARGET_WORD[t.target]}</p>
      <dl className="mt-3 divide-y divide-line text-sm">
        <div className="flex flex-wrap justify-between gap-x-3 py-1.5"><dt className="text-navy-800">Current</dt><dd className="font-semibold text-navy-950">{t.currentDisplay ? f.text(t.currentDisplay) : "Not entered"}</dd></div>
        <div className="flex flex-wrap justify-between gap-x-3 py-1.5"><dt className="text-navy-800">{t.thresholdKind === "headroom" ? "Margin reached at about" : "Threshold"}</dt><dd className="font-semibold text-navy-950">{t.thresholdDisplay ? `≈ ${f.text(t.thresholdDisplay)}` : "No value found"}</dd></div>
        {rc && (
          <div className="flex flex-wrap items-center justify-between gap-x-3 py-1.5"><dt className="text-navy-800">Change</dt>
            <dd className="inline-flex items-center gap-1 font-semibold text-navy-950"><Arrow aria-hidden className="size-4" />{rc.direction === "none" ? "None" : `${rc.direction === "decrease" ? "Decrease" : "Increase"} of ${f.text(formatValue(t.unit, Math.abs(rc.absolute), true))}${rc.percent === null ? "" : ` (${formatNumber(rc.percent, 1)}%)`}`}</dd></div>
        )}
        <div className="flex flex-wrap justify-between gap-x-3 py-1.5"><dt className="text-navy-800">Solver status</dt><dd className="font-medium text-navy-900">{STATUS_WORD[t.status] ?? t.status}</dd></div>
      </dl>
      <p className="mt-3 text-sm text-navy-900">{f.text(t.statement)}</p>
      {t.caveats.map((c) => <p key={c} className="mt-1 text-xs text-amber-900">{f.text(c)}</p>)}
      {t.transition && (
        <div className="mt-3 rounded-lg bg-navy-50/70 p-3 text-xs text-navy-900">
          <p className="font-semibold">At this value the classification would be recalculated as:</p>
          <p className="mt-1 flex flex-wrap items-center gap-2"><ClassBadge c={t.transition.from} /> <span aria-hidden>→</span><span className="sr-only">to</span> <ClassBadge c={t.transition.to} /></p>
          <p className="mt-1">{t.transition.explanation}</p>
        </div>
      )}
      {!t.transition && t.after && <p className="mt-3 text-xs text-slate-700">At this value the engine gives <ClassBadge c={t.after.classification} /></p>}
      {(t.before || t.after) && (
        <details className="mt-3 text-xs">
          <summary className="w-fit cursor-pointer font-medium text-navy-700 underline underline-offset-2">Decision trace before and after</summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {[["Before (current value)", t.before], ["After (at the threshold)", t.after]].map(([title, o]) => (
              <div key={title as string}><p className="font-semibold text-navy-950">{title as string}</p>
                {o ? <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-slate-700">{(o as NonNullable<ThresholdResult["before"]>).decisionTrace.map((s, i) => <li key={i}>{f.text(s)}</li>)}</ol> : <p className="text-slate-600">Not available.</p>}
              </div>
            ))}
          </div>
        </details>
      )}
      {t.solver && <p className="mt-2 text-[0.7rem] text-slate-600">Solver: {t.solver.method.replace(/_/g, " ")}, {t.solver.iterations} iterations, {t.solver.evaluations} engine runs, bounds {t.solver.bounds.lo.toLocaleString("en-US", { maximumFractionDigits: 2 })} to {t.solver.bounds.hi.toLocaleString("en-US", { maximumFractionDigits: 2 })} (solver bounds, not market limits). Policy v{t.policyVersion}.</p>}
      {draft && (
        <div className="mt-3">
          <Button size="sm" variant="secondary" onClick={() => { const r = store.add(draft); setMsg(r.ok ? "Scenario created. Open Saved Scenarios to compare it with the Base Case." : r.message); }}>Create Scenario at This Threshold</Button>
          {msg && <p role="status" className="mt-1 text-xs text-navy-900">{msg} {msg.startsWith("Scenario created") && <Link href="/scenarios" className="font-semibold underline underline-offset-2">Open scenarios</Link>}</p>}
        </div>
      )}
    </Card>
  );
}

function Remedies({ list }: { list: OperationalRemedy[] }) {
  if (list.length === 0) return <p className="text-sm text-slate-600">No operational change is needed.</p>;
  return (
    <ul className="space-y-2">
      {list.map((r, i) => (
        <li key={i} className="rounded-lg border border-line p-3 text-sm text-navy-900">
          {r.text}
          {r.kind === "numeric_threshold" && <span className="mt-1 block text-xs text-slate-600">{r.verified ? "Checked by re-running the engine." : "Not confirmed by the engine."}</span>}
        </li>
      ))}
    </ul>
  );
}

export function ViabilityPanel({ input, tech, f }: { input: NormalizedAssessmentInput; tech: GreenTechId; f: ResultFormatter }) {
  const a = useMemo(() => analyzeViability(input, tech), [input, tech]);
  const { store: analysisStore } = useAnalysisStore();
  useEffect(() => { analysisStore.recordViability(input, tech, a); }, [analysisStore, input, tech, a]);
  const col = "min-w-0 rounded-xl border border-line p-3";
  return (
    <section id="viability" aria-labelledby="viability-title" className="scroll-mt-28 space-y-4">
      <Card>
        <CardHeader
          title={a.heading}
          description={`${TECH_LABEL[tech]} against diesel. Each value moves one assumption and holds all others equal.`}
          action={<PageHelpButton id="thresholds" label="How thresholds work" />}
        />
        <CardBody className="space-y-5">
          <div className="flex flex-wrap items-center gap-3"><span id="viability-title" className="text-sm font-semibold text-navy-900">Current classification</span>{a.classification && <ClassBadge c={a.classification} size="md" />}</div>

          {a.mode === "blocked" || a.mode === "unavailable" ? (
            <div className="rounded-lg border border-slate-300 bg-slate-100 p-4 text-sm text-slate-900">
              <p className="font-semibold">Complete these inputs before threshold analysis can be performed.</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">{a.missingInputs.map((m) => <li key={m}>{f.text(m)}</li>)}</ul>
              <p className="mt-3"><Link href={tech === "bev" ? "/assessment/electric" : "/assessment/biofuel"} className="font-semibold underline underline-offset-2">Complete Missing Inputs</Link></p>
            </div>
          ) : (
            <>
              {a.multipleBarrierNote && <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{a.multipleBarrierNote}</p>}
              <div className="grid gap-3 lg:grid-cols-3">
                {([["Economic", a.barriers.economic], ["Operational", a.barriers.operational], ["Evidence and uncertainty", a.barriers.evidence]] as const).map(([title, list]) => (
                  <div key={title} className={col}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-forest-800">{title}</h3>
                    {list.length === 0 ? <p className="mt-1 text-sm text-slate-600">None identified.</p> : <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-navy-900">{list.map((b, i) => <li key={b.code + i}>{f.text(b.text)}</li>)}</ul>}
                  </div>
                ))}
              </div>
              {a.notes.map((n) => <p key={n} className="text-sm text-navy-800">{n}</p>)}
            </>
          )}
        </CardBody>
      </Card>

      {a.economicThresholds.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-navy-950">{a.mode === "viability_margin" ? "Economic margin: how far each assumption can move before incremental NPV reaches zero" : "Economic changes"}</h3>
          <div className="grid gap-4 lg:grid-cols-2">{a.economicThresholds.map((t) => <ThresholdCard key={t.variableId} t={t} f={f} tech={tech} />)}</div>
        </div>
      )}
      {a.classificationThresholds.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-navy-950">{a.mode === "viability_margin" ? "Classification margin: the nearest change of label" : "Moving toward Viable"}</h3>
          <div className="grid gap-4 lg:grid-cols-2">{a.classificationThresholds.map((t) => <ThresholdCard key={t.variableId} t={t} f={f} tech={tech} />)}</div>
        </div>
      )}
      {(a.mode === "make_viable" || a.mode === "make_fully_viable" || a.mode === "viability_margin") && a.remedies.length > 0 && (
        <Collapsible title="Operational changes" summary="What would have to be true operationally. Categories such as fuel availability are never turned into numbers." defaultOpen>
          <Remedies list={a.remedies} />
        </Collapsible>
      )}
      <Disclaimer />
      <p className="text-xs text-slate-600">{a.disclaimer}</p>
    </section>
  );
}
