"use client";

import { useId, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { DEFAULT_SENSITIVITY_RANGE, PROTOTYPE_RANGE_LABEL, SENSITIVITY_LIMITS, runSensitivityAnalysis, type SensitivityRange } from "@/calculation/sensitivity";
import { numericVariablesFor, type VariableId } from "@/calculation/analysis/variables";
import { formatValue } from "@/calculation/analysis/format";
import type { GreenTechId } from "@/calculation/types";
import type { NormalizedAssessmentInput } from "@/domain/normalized";
import type { ResultFormatter } from "@/components/results/format-results";
import { PageHelpButton } from "@/guidance/HelpButtons";
import { ClassBadge, ECON_WORD, Disclaimer, opLabel } from "./shared";

const AXIS = { fontSize: 12, fill: "#3c4d6a" } as const;
const field = "block w-full min-w-0 rounded-lg border border-navy-200 bg-surface px-3 py-2 text-sm";

export function OneWaySection({ input, tech, f }: { input: NormalizedAssessmentInput; tech: GreenTechId; f: ResultFormatter }) {
  const id = useId();
  const vars = useMemo(() => numericVariablesFor(input, tech), [input, tech]);
  const [variableId, setVariableId] = useState<VariableId>(() => vars[0]!.id);
  const current = vars.some((v) => v.id === variableId) ? variableId : vars[0]!.id;
  const [custom, setCustom] = useState(false);
  const [mode, setMode] = useState<"percent" | "absolute">("percent");
  const [min, setMin] = useState("-20");
  const [max, setMax] = useState("20");
  const [steps, setSteps] = useState("5");
  const [applied, setApplied] = useState<{ variableId: VariableId; range: SensitivityRange } | null>(null);

  const run = () => setApplied({ variableId: current, range: custom ? { mode, min: Number(min), max: Number(max), steps: Number(steps) } : DEFAULT_SENSITIVITY_RANGE });
  const effective = applied && vars.some((v) => v.id === applied.variableId) ? applied : { variableId: current, range: DEFAULT_SENSITIVITY_RANGE };
  const result = useMemo(() => runSensitivityAnalysis({ input, technology: tech, variableId: effective.variableId, range: effective.range }), [input, tech, effective.variableId, effective.range]);
  const def = vars.find((v) => v.id === effective.variableId);

  return (
    <section id="one-way" aria-labelledby={`${id}-t`} className="scroll-mt-28">
      <Card>
        <CardHeader title="One-way sensitivity" description="Change one assumption. Everything else stays at the Base Case." action={<PageHelpButton id="sensitivity" label="How sensitivity works" />} />
        <CardBody className="space-y-5">
          <h3 id={`${id}-t`} className="sr-only">One-way sensitivity</h3>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div>
              <label htmlFor={`${id}-v`} className="text-sm font-semibold text-navy-900">Assumption to vary</label>
              <select id={`${id}-v`} className={field} value={current} onChange={(e) => { setVariableId(e.target.value as VariableId); setApplied(null); }}>
                {vars.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
              {def?.note && <p className="mt-1 text-xs text-slate-600">{def.note}</p>}
            </div>
            <fieldset>
              <legend className="text-sm font-semibold text-navy-900">Range</legend>
              <div className="mt-1 flex flex-wrap gap-2 text-sm">
                <label className="inline-flex min-h-11 items-center gap-2"><input type="radio" name={`${id}-r`} checked={!custom} onChange={() => { setCustom(false); setApplied(null); }} /> Prototype range</label>
                <label className="inline-flex min-h-11 items-center gap-2"><input type="radio" name={`${id}-r`} checked={custom} onChange={() => setCustom(true)} /> Custom</label>
              </div>
              {!custom && <p className="text-xs text-slate-600">{PROTOTYPE_RANGE_LABEL}</p>}
            </fieldset>
          </div>
          {custom && (
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="text-sm font-medium text-navy-900">Type<select className={field} value={mode} onChange={(e) => setMode(e.target.value as "percent" | "absolute")}><option value="percent">Percentage change</option><option value="absolute">Absolute values</option></select></label>
              <label className="text-sm font-medium text-navy-900">Minimum {mode === "percent" ? "(%)" : ""}<input className={field} inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} /></label>
              <label className="text-sm font-medium text-navy-900">Maximum {mode === "percent" ? "(%)" : ""}<input className={field} inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} /></label>
              <label className="text-sm font-medium text-navy-900">Steps ({SENSITIVITY_LIMITS.minSteps} to {SENSITIVITY_LIMITS.maxSteps})<input className={field} inputMode="numeric" value={steps} onChange={(e) => setSteps(e.target.value)} /></label>
            </div>
          )}
          <div><Button onClick={run}>Run sensitivity</Button></div>

          {result.status !== "ok" ? (
            <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{result.message}</p>
          ) : (
            <>
              <figure className="min-w-0 max-w-full" aria-label={`${result.variableLabel} against incremental NPV`}>
                <figcaption className="mb-2 text-sm font-semibold text-navy-950">{result.variableLabel} against incremental NPV versus diesel</figcaption>
                <p className="mb-2 text-xs text-slate-600">The dark line is NPV = 0. The vertical line is your Base Case. {result.breakEven ? "The marked point is the solved NPV = 0 crossing." : ""}</p>
                <div className="h-72 w-full sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={result.points.map((p) => ({ x: p.value, npv: p.npv }))} margin={{ top: 8, right: 16, bottom: 18, left: 4 }}>
                      <CartesianGrid stroke="#dde2e8" strokeDasharray="3 3" />
                      <XAxis dataKey="x" type="number" domain={["dataMin", "dataMax"]} tick={AXIS} tickFormatter={(v: number) => f.text(formatValue(result.unit, v))} label={{ value: result.variableLabel, position: "insideBottom", offset: -10, fill: "#3c4d6a", fontSize: 12 }} />
                      <YAxis tick={AXIS} tickFormatter={(v: number) => f.compact(v)} width={64} />
                      <Tooltip formatter={(v) => f.money(Number(v))} labelFormatter={(x) => f.text(formatValue(result.unit, Number(x)))} />
                      <Legend verticalAlign="top" height={28} />
                      <ReferenceLine y={0} stroke="#0f1729" strokeWidth={1.5} />
                      <ReferenceLine x={result.baseValue} stroke="#b45309" strokeDasharray="6 4" label={{ value: "Base Case", fill: "#b45309", fontSize: 11, position: "insideTopRight" }} />
                      <Line type="linear" dataKey="npv" name="Incremental NPV" stroke="#19503a" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
                      {result.breakEven && <ReferenceDot x={result.breakEven.value} y={0} r={6} fill="#be185d" stroke="#fff" label={{ value: "NPV = 0", fontSize: 11, fill: "#be185d", position: "top" }} />}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </figure>

              {result.transitions.length > 0 && (
                <div className="rounded-lg border border-line p-3 text-sm">
                  <h4 className="font-semibold text-navy-950">Classification changes in the tested range</h4>
                  <ul className="mt-2 space-y-2">
                    {result.transitions.map((t, i) => (
                      <li key={i} className="flex flex-wrap items-center gap-2"><ClassBadge c={t.from} /> <span aria-hidden>→</span><span className="sr-only">to</span> <ClassBadge c={t.to} /> <span className="text-xs text-slate-700">between {f.text(formatValue(result.unit, t.fromValue))} and {f.text(formatValue(result.unit, t.toValue))}</span></li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-slate-600">The classification is rule-based, so each change marks a rule boundary and not a continuous curve.</p>
                </div>
              )}

              <ResponsiveTable caption={`Sensitivity of ${result.variableLabel}`}>
                <thead>
                  <tr className="border-b border-line bg-navy-50 text-navy-800">
                    {["Value", "Change", "Incremental NPV", "Present-cost difference", "TCO", "TCO per km", "Simple payback", "Discounted payback", "Economic case", "Operational", "Classification"].map((h) => <th key={h} scope="col" className="px-3 py-2 text-left text-xs font-semibold">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {result.points.map((p) => (
                    <tr key={p.value} className={`border-b border-line last:border-0 ${p.isBase ? "bg-forest-50/60 font-medium" : ""}`}>
                      <th scope="row" className="px-3 py-2 text-left text-xs">{f.text(formatValue(result.unit, p.value))}{p.isBase && <span className="ml-1 text-[0.65rem] font-bold uppercase text-forest-800">Base Case</span>}</th>
                      <td className="px-3 py-2 text-xs tabular-nums">{p.percentChange === null ? "n/a" : `${p.percentChange > 0 ? "+" : ""}${p.percentChange.toFixed(1)}%`}</td>
                      <td className="px-3 py-2 text-xs tabular-nums">{f.money(p.npv)}</td>
                      <td className="px-3 py-2 text-xs tabular-nums">{f.money(p.presentCostDifference)}</td>
                      <td className="px-3 py-2 text-xs tabular-nums">{f.money(p.tco)}</td>
                      <td className="px-3 py-2 text-xs tabular-nums">{f.perKm(p.tcoPerKm)}</td>
                      <td className="px-3 py-2 text-xs">{f.years(p.simplePayback)}</td>
                      <td className="px-3 py-2 text-xs">{f.years(p.discountedPayback)}</td>
                      <td className="px-3 py-2 text-xs">{ECON_WORD[p.economicCase]}</td>
                      <td className="px-3 py-2 text-xs">{opLabel(p.operationalStatus)}</td>
                      <td className="px-3 py-2"><ClassBadge c={p.classification} /></td>
                    </tr>
                  ))}
                </tbody>
              </ResponsiveTable>

              <div className="space-y-1 text-sm text-navy-900">
                <h4 className="font-semibold text-navy-950">What this shows</h4>
                <ul className="list-disc space-y-1 pl-5">{result.interpretation.map((s) => <li key={s}>{f.text(s)}</li>)}</ul>
                <p className="text-xs text-slate-600">Policy v{result.transparency.policyVersion}. {result.transparency.heldEqual} {result.transparency.rangeLabel}</p>
              </div>
            </>
          )}
          <Disclaimer />
        </CardBody>
      </Card>
    </section>
  );
}
