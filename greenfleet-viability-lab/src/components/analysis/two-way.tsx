"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { runTwoWaySensitivity, TWO_WAY_PAIRS } from "@/calculation/sensitivity";
import { formatValue, CLASS_WORDS } from "@/calculation/analysis/format";
import { VARIABLES } from "@/calculation/analysis/variables";
import type { GreenTechId } from "@/calculation/types";
import type { NormalizedAssessmentInput } from "@/domain/normalized";
import type { ResultFormatter } from "@/components/results/format-results";
import { Disclaimer } from "./shared";

const SHORT = { VIABLE: "Viable", CONDITIONALLY_VIABLE: "Conditional", NOT_YET_VIABLE: "Not yet", INSUFFICIENT_EVIDENCE: "Insufficient" } as const;
const TONE = { VIABLE: "bg-forest-50 text-forest-950", CONDITIONALLY_VIABLE: "bg-amber-50 text-amber-950", NOT_YET_VIABLE: "bg-red-50 text-red-950", INSUFFICIENT_EVIDENCE: "bg-slate-100 text-slate-900" } as const;

export function TwoWaySection({ input, tech, f }: { input: NormalizedAssessmentInput; tech: GreenTechId; f: ResultFormatter }) {
  const id = useId();
  const pairs = TWO_WAY_PAIRS[tech].filter(([a, b]) => VARIABLES[a].applicable(input).ok && VARIABLES[b].applicable(input).ok);
  const [idx, setIdx] = useState(0);
  const [ran, setRan] = useState(false);
  const pair = pairs[Math.min(idx, pairs.length - 1)];
  const xId = pair?.[0];
  const yId = pair?.[1];
  const r = ran && xId && yId ? runTwoWaySensitivity({ input, technology: tech, xId, yId }) : null;
  if (!pair) return null;
  return (
    <section id="two-way" aria-labelledby={`${id}-t`} className="scroll-mt-28">
      <Card>
        <CardHeader title="Two assumptions together" description="A small grid of two assumptions, with everything else at the Base Case. Limited to useful pairs so the grid stays readable." />
        <CardBody className="space-y-4">
          <h3 id={`${id}-t`} className="sr-only">Two-way sensitivity</h3>
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-0 text-sm font-semibold text-navy-900">Pair
              <select className="mt-1 block w-full rounded-lg border border-navy-200 bg-surface px-3 py-2 text-sm font-normal" value={idx} onChange={(e) => { setIdx(Number(e.target.value)); setRan(false); }}>
                {pairs.map(([a, b], i) => <option key={a + b} value={i}>{VARIABLES[a].label} × {VARIABLES[b].label}</option>)}
              </select>
            </label>
            <Button onClick={() => setRan(true)}>Run grid (5 × 5, prototype range)</Button>
          </div>
          {r && r.status !== "ok" && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{r.message}</p>}
          {r && r.status === "ok" && (
            <>
              <ResponsiveTable caption={`Incremental NPV and classification: ${r.y.label} (rows) by ${r.x.label} (columns)`}>
                <thead>
                  <tr className="border-b border-line bg-navy-50 text-navy-800">
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold">{r.y.label} ↓ / {r.x.label} →</th>
                    {r.x.values.map((v) => <th key={v} scope="col" className="px-3 py-2 text-left text-xs font-semibold">{f.text(formatValue(r.x.unit, v))}{v === r.x.baseValue ? " (base)" : ""}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {r.y.values.map((yv, yi) => (
                    <tr key={yv} className="border-b border-line last:border-0">
                      <th scope="row" className="px-3 py-2 text-left text-xs font-medium">{f.text(formatValue(r.y.unit, yv))}{yv === r.y.baseValue ? " (base)" : ""}</th>
                      {r.x.values.map((xv, xi) => {
                        const c = r.cells.find((k) => k.xIndex === xi && k.yIndex === yi)!;
                        return (
                          <td key={xv} className={`px-3 py-2 text-xs ${TONE[c.classification]}`}>
                            <span className="block font-semibold tabular-nums">{f.compact(c.npv)}</span>
                            <span className="block">{SHORT[c.classification]}<span className="sr-only"> ({CLASS_WORDS[c.classification]})</span></span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </ResponsiveTable>
              <div>
                <h4 className="text-sm font-semibold text-navy-950">{r.frontierLabel}</h4>
                <p className="text-xs text-slate-600">For each {r.x.label.toLowerCase()}, the {r.y.label.toLowerCase()} at which incremental NPV is approximately zero, all else equal.</p>
                <ul className="mt-2 grid gap-1 text-xs text-navy-900 sm:grid-cols-2">
                  {r.frontier.map((p) => <li key={p.xValue}>{f.text(formatValue(r.x.unit, p.xValue, true))}: {p.yValue === null ? "no crossing within the solver bounds" : `≈ ${f.text(formatValue(r.y.unit, p.yValue, true))}`}</li>)}
                </ul>
                <p className="mt-2 text-xs text-slate-700">{r.frontierNote}</p>
              </div>
            </>
          )}
          <Disclaimer />
        </CardBody>
      </Card>
    </section>
  );
}
