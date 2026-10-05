"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { runDriverAnalysis } from "@/calculation/sensitivity";
import { formatValue, CLASS_WORDS } from "@/calculation/analysis/format";
import type { GreenTechId } from "@/calculation/types";
import type { NormalizedAssessmentInput } from "@/domain/normalized";
import type { ResultFormatter } from "@/components/results/format-results";
import { PageHelpButton } from "@/guidance/HelpButtons";

const AXIS = { fontSize: 12, fill: "#3c4d6a" } as const;

export function DriversSection({ input, tech, f }: { input: NormalizedAssessmentInput; tech: GreenTechId; f: ResultFormatter }) {
  const d = useMemo(() => runDriverAnalysis({ input, technology: tech }), [input, tech]);
  return (
    <section id="drivers" aria-labelledby="drivers-t" className="scroll-mt-28">
      <Card>
        <CardHeader title="Which assumptions move the result most?" description="Each assumption is tested at the low and high end of the prototype range (-20% and +20%), one at a time." action={<PageHelpButton id="sensitivity" label="How to read this" />} />
        <CardBody className="space-y-5">
          <h3 id="drivers-t" className="sr-only">Driver ranking</h3>
          {d.status !== "ok" ? <p className="text-sm text-amber-950">{d.message}</p> : (
            <>
              <p className="text-sm font-medium text-navy-900">{f.text(d.statement)}</p>
              <figure className="min-w-0 max-w-full" aria-label="Tornado chart of NPV change by assumption">
                <figcaption className="mb-2 text-sm font-semibold text-navy-950">Change in incremental NPV from the Base Case</figcaption>
                <p className="mb-2 text-xs text-slate-600">Sensitivity influence under the tested ranges. Longest bar first. It depends on the range chosen.</p>
                <div style={{ height: Math.max(220, d.rows.length * 46 + 70) }} className="w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={d.rows.map((r) => ({ name: r.label, low: r.npvLow - r.npvBase, high: r.npvHigh - r.npvBase }))} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                      <CartesianGrid stroke="#dde2e8" strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={AXIS} tickFormatter={(v: number) => f.compact(v)} />
                      <YAxis type="category" dataKey="name" tick={AXIS} width={150} />
                      <Tooltip formatter={(v) => f.money(Number(v))} />
                      <Legend verticalAlign="top" height={28} />
                      <ReferenceLine x={0} stroke="#0f1729" />
                      <Bar dataKey="low" name="Low case (-20%)" fill="#3c4d6a" isAnimationActive={false} />
                      <Bar dataKey="high" name="High case (+20%)" fill="#b45309" isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </figure>
              <ResponsiveTable caption="Driver table: NPV at the low and high tested value of each assumption">
                <thead><tr className="border-b border-line bg-navy-50 text-navy-800">{["Variable", "Base value", "Low tested", "High tested", "NPV at low", "NPV at high", "NPV spread", "Classification (low / base / high)"].map((h) => <th key={h} scope="col" className="px-3 py-2 text-left text-xs font-semibold">{h}</th>)}</tr></thead>
                <tbody>
                  {d.rows.map((r) => (
                    <tr key={r.variableId} className="border-b border-line align-top last:border-0">
                      <th scope="row" className="px-3 py-2 text-left text-xs font-medium">{r.label}{r.clamped && <span className="block font-normal text-slate-600">Pulled back to a model limit.</span>}</th>
                      <td className="px-3 py-2 text-xs tabular-nums">{f.text(formatValue(r.unit, r.baseValue))}</td>
                      <td className="px-3 py-2 text-xs tabular-nums">{f.text(formatValue(r.unit, r.lowValue))}</td>
                      <td className="px-3 py-2 text-xs tabular-nums">{f.text(formatValue(r.unit, r.highValue))}</td>
                      <td className="px-3 py-2 text-xs tabular-nums">{f.money(r.npvLow)}</td>
                      <td className="px-3 py-2 text-xs tabular-nums">{f.money(r.npvHigh)}</td>
                      <td className="px-3 py-2 text-xs font-semibold tabular-nums">{f.money(r.spread)}</td>
                      <td className="px-3 py-2 text-xs">{CLASS_WORDS[r.classificationLow]} / {CLASS_WORDS[r.classificationBase]} / {CLASS_WORDS[r.classificationHigh]}</td>
                    </tr>
                  ))}
                </tbody>
              </ResponsiveTable>
              {d.skipped.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-600">{d.skipped.map((s) => <li key={s.variableId}>{s.label}: {s.reason}</li>)}</ul>}
              <p className="text-xs text-slate-600">{d.note}</p>
            </>
          )}
        </CardBody>
      </Card>
    </section>
  );
}
