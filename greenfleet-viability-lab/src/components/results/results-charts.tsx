"use client";

import { useId, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { COST_CATEGORIES, type AssessmentCalculationResult, type TechId } from "@/calculation/types";
import type { ResultFormatter } from "./format-results";

const TECHS: readonly TechId[] = ["diesel", "bev", "biofuel"];
const SHORT: Record<TechId, string> = { diesel: "Diesel", bev: "Battery electric", biofuel: "Biofuel" };

const AXIS = { fontSize: 12, fill: "#3c4d6a" } as const;
const GRID = "#dde2e8";

/** Colour-blind-safe set; every category is also named in the legend and the data table. */
const CATEGORY_COLOR: Record<string, string> = {
  vehicleAcquisition: "#19503a",
  vehicleReplacement: "#4c9a76",
  infrastructureCapex: "#7c3aed",
  batteryReplacement: "#be185d",
  energy: "#b45309",
  maintenance: "#3c4d6a",
  insurance: "#0e7490",
  licensing: "#6d7f9f",
  otherFixed: "#a16207",
  otherVariable: "#9a3412",
  infrastructureOpex: "#a78bfa",
  incentiveOffsets: "#65a30d",
  residualOffset: "#94a3b8",
};

function ChartFigure({ title, caption, children, table }: { title: string; caption: string; children: React.ReactNode; table: React.ReactNode }) {
  const id = useId();
  return (
    <figure aria-labelledby={`${id}-t`} aria-describedby={`${id}-c`} className="min-w-0 max-w-full rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <h3 id={`${id}-t`} className="text-base font-semibold text-navy-950">{title}</h3>
      <p id={`${id}-c`} className="mt-1 text-xs text-slate-600">{caption}</p>
      <div className="mt-3 h-72 w-full sm:h-80">{children}</div>
      <details className="mt-3 text-xs">
        <summary className="w-fit cursor-pointer font-medium text-navy-600 underline underline-offset-2 hover:text-navy-900">View this chart as a table</summary>
        <div className="mt-2 overflow-x-auto">{table}</div>
      </details>
    </figure>
  );
}

const th = "px-3 py-1.5 text-left font-semibold text-navy-800";
const td = "px-3 py-1.5 tabular-nums text-navy-900";

export function CashFlowChart({ result, f }: { result: AssessmentCalculationResult; f: ResultFormatter }) {
  const [basis, setBasis] = useState<"undiscounted" | "discounted">("undiscounted");
  const key = basis === "undiscounted" ? "cumulativeIncrementalCashFlow" : "discountedCumulativeCashFlow";
  const data = result.bevVsDiesel.rows.map((row, i) => ({ year: row.year, bev: row[key], biofuel: result.biofuelVsDiesel.rows[i]![key] }));
  const unitNote = `Values in ${f.symbol}, as entered (nominal). Above zero means the alternative has cost less than diesel so far; below zero means it has cost more.`;
  return (
    <ChartFigure
      title="Cumulative cash flow versus diesel"
      caption={unitNote}
      table={
        <table className="w-full min-w-[22rem] text-xs">
          <caption className="sr-only">Cumulative incremental cash flow ({basis}) by year</caption>
          <thead><tr><th className={th}>Year</th><th className={th}>Battery electric</th><th className={th}>Biofuel</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.year} className="border-t border-line"><td className={td}>{d.year}</td><td className={td}>{f.money(d.bev)}</td><td className={td}>{f.money(d.biofuel)}</td></tr>)}</tbody>
        </table>
      }
    >
      <div className="mb-2 flex gap-2" role="radiogroup" aria-label="Cash-flow basis">
        {(["undiscounted", "discounted"] as const).map((b) => (
          <label key={b} className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-forest-500 ${basis === b ? "border-forest-600 bg-forest-50 text-forest-900" : "border-line text-navy-700"}`}>
            <input type="radio" name="basis" value={b} checked={basis === b} onChange={() => setBasis(b)} className="sr-only" />
            {b === "undiscounted" ? "Undiscounted" : "Discounted"}
          </label>
        ))}
      </div>
      <ResponsiveContainer width="100%" height="88%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 18, left: 4 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
          <XAxis dataKey="year" tick={AXIS} label={{ value: "Year", position: "insideBottom", offset: -10, fill: "#3c4d6a", fontSize: 12 }} />
          <YAxis tick={AXIS} tickFormatter={(v: number) => f.compact(v)} width={64} />
          <Tooltip formatter={(v) => f.money(Number(v))} labelFormatter={(y) => `Year ${y}`} />
          <Legend verticalAlign="top" height={28} />
          <ReferenceLine y={0} stroke="#0f1729" strokeWidth={1.5} />
          <Line type="monotone" dataKey="bev" name="Battery electric vs diesel" stroke="#19503a" strokeWidth={2.5} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="biofuel" name="Biofuel vs diesel" stroke="#b45309" strokeWidth={2.5} strokeDasharray="7 4" dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}

export function TcoChart({ result, f }: { result: AssessmentCalculationResult; f: ResultFormatter }) {
  const data = TECHS.map((t) => ({ name: SHORT[t], undiscounted: result[t].undiscountedTco, present: result[t].presentCost }));
  return (
    <ChartFigure
      title="Total cost of ownership"
      caption={`Whole-period cost of each option in ${f.symbol}. "Present cost" discounts future costs at ${(result.metadata.discountRate * 100).toFixed(1).replace(/\.0$/, "")}% a year. Lower is cheaper.`}
      table={
        <table className="w-full min-w-[22rem] text-xs">
          <caption className="sr-only">Total cost of ownership by technology</caption>
          <thead><tr><th className={th}>Option</th><th className={th}>Undiscounted TCO</th><th className={th}>Present cost</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.name} className="border-t border-line"><td className={td}>{d.name}</td><td className={td}>{f.money(d.undiscounted)}</td><td className={td}>{f.money(d.present)}</td></tr>)}</tbody>
        </table>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={AXIS} />
          <YAxis tick={AXIS} tickFormatter={(v: number) => f.compact(v)} width={64} />
          <Tooltip formatter={(v) => f.money(Number(v))} />
          <Legend verticalAlign="top" height={28} />
          <ReferenceLine y={0} stroke="#0f1729" />
          <Bar dataKey="undiscounted" name="Undiscounted TCO" fill="#3c4d6a" radius={[3, 3, 0, 0]} />
          <Bar dataKey="present" name="Present cost" fill="#2e7d5b" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}

export function CostComponentsChart({ result, f }: { result: AssessmentCalculationResult; f: ResultFormatter }) {
  // Only categories that actually carry money in at least one option appear, so nothing is shown as a fake non-zero.
  const used = COST_CATEGORIES.filter((c) => TECHS.some((t) => Math.abs(result[t].breakdown.undiscounted[c.id]) > 1e-9));
  const data = TECHS.map((t) => ({ name: SHORT[t], ...Object.fromEntries(used.map((c) => [c.id, result[t].breakdown.undiscounted[c.id]])) }));
  return (
    <ChartFigure
      title="What the cost is made of"
      caption={`Undiscounted cost by component in ${f.symbol}. Incentives and residual value are shown below zero because they reduce the total.`}
      table={
        <table className="w-full min-w-[26rem] text-xs">
          <caption className="sr-only">Undiscounted cost components by technology</caption>
          <thead><tr><th className={th}>Component</th>{TECHS.map((t) => <th key={t} className={th}>{SHORT[t]}</th>)}</tr></thead>
          <tbody>{used.map((c) => <tr key={c.id} className="border-t border-line"><td className={td}>{c.label}</td>{TECHS.map((t) => <td key={t} className={td}>{f.money(result[t].breakdown.undiscounted[c.id])}</td>)}</tr>)}</tbody>
        </table>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} stackOffset="sign" margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={AXIS} />
          <YAxis tick={AXIS} tickFormatter={(v: number) => f.compact(v)} width={64} />
          <Tooltip formatter={(v) => f.money(Number(v))} />
          <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine y={0} stroke="#0f1729" />
          {used.map((c) => <Bar key={c.id} dataKey={c.id} name={c.label} stackId="cost" fill={CATEGORY_COLOR[c.id]} />)}
        </BarChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}

