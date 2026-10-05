"use client";

import { AlertTriangle, ArrowDownRight, ArrowUpRight, Info, Minus } from "lucide-react";
import { AssumptionBadge, type AssumptionKind } from "@/components/ui/assumption-badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Collapsible } from "@/components/ui/collapsible";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { HelpTip } from "@/components/ui/help-tip";
import { KpiCard } from "@/components/ui/kpi-card";
import { formatNumber } from "@/lib/format";
import { TECH_NAMES, type AssessmentCalculationResult, type AssumptionRecord, type CalcWarning, type GreenTechId, type IncrementalAnalysis, type TechId, type TechnologyEconomics } from "@/calculation/types";
import { NPV_LABEL, type ResultFormatter } from "./format-results";

const TECHS: readonly TechId[] = ["diesel", "bev", "biofuel"];
const GREEN: readonly GreenTechId[] = ["bev", "biofuel"];
const analysisOf = (r: AssessmentCalculationResult, g: GreenTechId): IncrementalAnalysis => (g === "bev" ? r.bevVsDiesel : r.biofuelVsDiesel);

/* ------------------------------ headline tiles ------------------------------ */

export function HeadlineTiles({ r, f }: { r: AssessmentCalculationResult; f: ResultFormatter }) {
  const lowest = (pick: (t: TechnologyEconomics) => number) => TECHS.map((id) => r[id]).reduce((a, b) => (pick(b) < pick(a) ? b : a));
  const tco = lowest((t) => t.undiscountedTco);
  const pc = lowest((t) => t.presentCost);
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Lowest undiscounted TCO" icon={ArrowDownRight} value={f.money(tco.undiscountedTco)} hint={tco.label} />
      <KpiCard label="Lowest present cost" icon={ArrowDownRight} value={f.money(pc.presentCost)} hint={pc.label} />
      {GREEN.map((g) => {
        const a = analysisOf(r, g);
        return <KpiCard key={g} label={`NPV: ${TECH_NAMES[g]} vs diesel`} icon={a.npvDirection === "advantage" ? ArrowUpRight : a.npvDirection === "disadvantage" ? ArrowDownRight : Minus} value={f.money(a.npv)} hint={NPV_LABEL[a.npvDirection]} />;
      })}
    </div>
  );
}

/* ------------------------------ technology cards ------------------------------ */

function Metric({ label, value, note, term }: { label: string; value: string; note?: string; term?: string }) {
  return (
    <div className="relative flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
      <dt className="flex items-center gap-1 text-sm text-navy-800">{label}{term && <HelpTip term={term} />}</dt>
      <dd className="text-right text-sm font-semibold text-navy-950">
        {value}
        {note && <span className="block text-xs font-normal text-slate-600">{note}</span>}
      </dd>
    </div>
  );
}

export function TechnologyCards({ r, f }: { r: AssessmentCalculationResult; f: ResultFormatter }) {
  return (
    <div className="space-y-6">
      <section aria-labelledby="standalone-title">
        <h2 id="standalone-title" className="mb-3 text-lg font-semibold text-navy-950">Cost of each option on its own</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {TECHS.map((id) => {
            const t = r[id];
            return (
              <Card key={id} className="p-5">
                <h3 className="text-base font-semibold text-navy-950">{TECH_NAMES[id]}</h3>
                <dl className="mt-2 divide-y divide-line">
                  <Metric label="Total cost of ownership" term="tco" value={f.money(t.undiscountedTco)} note={`over ${r.metadata.horizonYears} years, not discounted`} />
                  <Metric label="Present cost of ownership" term="presentCost" value={f.money(t.presentCost)} note={`discounted at ${formatNumber(r.metadata.discountRate * 100, 2)}% a year`} />
                  <Metric label="Cost per km" value={f.perKm(t.tcoPerKm)} />
                  <Metric label="Present cost per km" value={f.perKm(t.presentCostPerKm)} />
                </dl>
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="green-title">
        <h2 id="green-title" className="mb-1 text-lg font-semibold text-navy-950">Each alternative against diesel</h2>
        <p className="mb-3 text-sm text-slate-600">Does the extra spending needed at the start pay for itself through lower running costs?</p>
        <div className="grid gap-4 lg:grid-cols-2">
          {GREEN.map((g) => {
            const a = analysisOf(r, g);
            const Icon = a.npvDirection === "advantage" ? ArrowUpRight : a.npvDirection === "disadvantage" ? ArrowDownRight : Minus;
            return (
              <Card key={g} className="p-5">
                <h3 className="text-base font-semibold text-navy-950">{TECH_NAMES[g]} vs diesel</h3>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-navy-800"><Icon aria-hidden className="size-4" />{NPV_LABEL[a.npvDirection]}</p>
                <dl className="mt-2 divide-y divide-line">
                  <Metric label="Net present value (NPV)" term="npv" value={f.money(a.npv)} />
                  <Metric label="Extra investment at the start" value={f.money(a.additionalInitialInvestment)} note={a.additionalInitialInvestment < 0 ? "negative: cheaper than diesel at the start" : undefined} />
                  <Metric label="Simple payback" term="payback" value={f.years(a.simplePayback)} />
                  <Metric label="Discounted payback" term="discountedPayback" value={f.years(a.discountedPayback)} />
                  <Metric label="Year 1 operating difference" value={f.savings(a.operatingSavings.year1, a.operatingSavings.year1Direction)} />
                </dl>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------ comparison table ------------------------------ */

const head = "px-4 py-3 text-left font-semibold";
const cell = "px-4 py-2.5 align-top tabular-nums text-navy-900";

export function ComparisonTables({ r, f }: { r: AssessmentCalculationResult; f: ResultFormatter }) {
  const standalone: Array<[string, (t: TechnologyEconomics) => string]> = [
    ["Initial capital requirement (Year 0, after incentives)", (t) => f.money(t.initialCapitalRequirement)],
    ["Year 1 energy / fuel cost", (t) => f.money(t.year1EnergyCost)],
    ["Year 1 operating cost", (t) => f.money(t.year1OperatingCost)],
    ["Undiscounted TCO", (t) => f.money(t.undiscountedTco)],
    ["Present cost of ownership", (t) => f.money(t.presentCost)],
    ["TCO per km", (t) => f.perKm(t.tcoPerKm)],
    ["Present cost per km", (t) => f.perKm(t.presentCostPerKm)],
    ["Residual value credited at the end", (t) => f.money(t.residualValue)],
  ];
  const green: Array<[string, (a: IncrementalAnalysis) => string]> = [
    ["NPV vs diesel", (a) => f.money(a.npv)],
    ["Extra investment at the start", (a) => f.money(a.additionalInitialInvestment)],
    ["Simple payback", (a) => f.years(a.simplePayback)],
    ["Discounted payback", (a) => f.years(a.discountedPayback)],
    ["Year 1 operating difference", (a) => f.savings(a.operatingSavings.year1, a.operatingSavings.year1Direction)],
    ["Average yearly operating difference", (a) => f.savings(a.operatingSavings.averageAnnual, a.operatingSavings.averageAnnual === 0 ? "none" : a.operatingSavings.averageAnnual > 0 ? "saving" : "additional_cost")],
    ["Cumulative savings over the period", (a) => (a.cumulativeSavings >= 0 ? f.money(a.cumulativeSavings) : `${f.money(-a.cumulativeSavings)} net additional cost`)],
    ["Break-even distance (fleet)", (a) => (a.breakEvenDistanceKm === null ? "Not reached within analysis horizon" : f.km(a.breakEvenDistanceKm))],
  ];
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Comparison: each option on its own" description={`All amounts in ${f.symbol}, as entered (nominal).`} />
        <CardBody>
          <ResponsiveTable caption="Standalone cost comparison of diesel, battery electric and biofuel">
            <thead><tr className="border-b border-line bg-navy-50 text-navy-800"><th scope="col" className={head}>Metric</th>{TECHS.map((t) => <th key={t} scope="col" className={head}>{TECH_NAMES[t]}</th>)}</tr></thead>
            <tbody>{standalone.map(([label, fn]) => <tr key={label} className="border-b border-line last:border-0"><th scope="row" className="px-4 py-2.5 text-left font-medium text-navy-900">{label}</th>{TECHS.map((t) => <td key={t} className={cell}>{fn(r[t])}</td>)}</tr>)}</tbody>
          </ResponsiveTable>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Comparison: alternatives against diesel" description="Positive savings mean the alternative costs less than diesel." />
        <CardBody>
          <ResponsiveTable caption="Battery electric and biofuel compared with diesel">
            <thead><tr className="border-b border-line bg-navy-50 text-navy-800"><th scope="col" className={head}>Metric</th>{GREEN.map((g) => <th key={g} scope="col" className={head}>{TECH_NAMES[g]} vs diesel</th>)}</tr></thead>
            <tbody>{green.map(([label, fn]) => <tr key={label} className="border-b border-line last:border-0"><th scope="row" className="px-4 py-2.5 text-left font-medium text-navy-900">{label}</th>{GREEN.map((g) => <td key={g} className={cell}>{fn(analysisOf(r, g))}</td>)}</tr>)}</tbody>
          </ResponsiveTable>
        </CardBody>
      </Card>
    </div>
  );
}

/* ------------------------------ year-by-year ------------------------------ */

export function CashFlowTables({ r, f }: { r: AssessmentCalculationResult; f: ResultFormatter }) {
  return (
    <Collapsible title="Year-by-year cash flows" summary="Cost of each option in each year, and the difference from diesel.">
      <div className="space-y-6">
        {GREEN.map((g) => (
          <div key={g}>
            <h3 className="mb-2 text-sm font-semibold text-navy-950">{TECH_NAMES[g]} vs diesel</h3>
            <ResponsiveTable caption={`Year-by-year cash flows, ${TECH_NAMES[g]} compared with diesel`}>
              <thead>
                <tr className="border-b border-line bg-navy-50 text-navy-800">
                  {["Year", "Diesel cost", `${TECH_NAMES[g]} cost`, "Difference (diesel minus alternative)", "Discounted difference", "Cumulative", "Cumulative, discounted"].map((h) => <th key={h} scope="col" className="px-3 py-2 text-left text-xs font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {analysisOf(r, g).rows.map((row) => (
                  <tr key={row.year} className="border-b border-line last:border-0">
                    <th scope="row" className="px-3 py-2 text-left text-xs font-medium">{row.year}</th>
                    {[row.dieselCost, row.greenCost, row.incrementalCashFlow, row.discountedIncrementalCashFlow, row.cumulativeIncrementalCashFlow, row.discountedCumulativeCashFlow].map((x, i) => <td key={i} className="px-3 py-2 text-xs tabular-nums text-navy-900">{f.money(x)}</td>)}
                  </tr>
                ))}
              </tbody>
            </ResponsiveTable>
          </div>
        ))}
        <p className="text-xs text-slate-600">Year 0 is the purchase date. Costs include the vehicle, infrastructure, running costs, replacements, incentives and (in the final year) the residual value.</p>
      </div>
    </Collapsible>
  );
}

/* ------------------------------ warnings ------------------------------ */

const SCOPE_LABEL: Record<string, string> = { general: "General", diesel: "Diesel", bev: "Battery electric", biofuel: "Biofuel", bev_vs_diesel: "Battery electric vs diesel", biofuel_vs_diesel: "Biofuel vs diesel" };

export function WarningsPanel({ warnings }: { warnings: CalcWarning[] }) {
  if (warnings.length === 0) return null;
  const important = warnings.filter((w) => w.severity === "warning");
  const notes = warnings.filter((w) => w.severity === "info");
  return (
    <Card>
      <CardHeader title="Things to know about these numbers" description="These do not change the arithmetic, but they affect how far you can rely on it." />
      <CardBody className="space-y-4">
        {important.length > 0 && (
          <ul className="space-y-2">
            {important.map((w) => (
              <li key={w.code + w.scope} className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0" />
                <span><span className="font-semibold">{SCOPE_LABEL[w.scope]}.</span> <span className="sr-only">Warning: </span>{w.message}</span>
              </li>
            ))}
          </ul>
        )}
        {notes.length > 0 && (
          <ul className="space-y-2">
            {notes.map((w) => (
              <li key={w.code + w.scope} className="flex gap-3 rounded-xl border border-line bg-navy-50/60 p-3 text-sm text-navy-900">
                <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-navy-500" />
                <span><span className="font-semibold">{SCOPE_LABEL[w.scope]}.</span> <span className="sr-only">Note: </span>{w.message}</span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

/* ------------------------------ assumptions ------------------------------ */

const GROUP_TITLE: Record<AssumptionRecord["group"], string> = { environment: "Environmental", operational: "Operational", scope: "Scope", operations: "Distance and use", diesel: "Diesel", bev: "Battery electric", biofuel: "Biofuel", finance: "Finance", infrastructure: "Infrastructure", method: "Method" };

function badgeFor(a: AssumptionRecord, illustrative: ReadonlySet<string>): AssumptionKind {
  switch (a.status) {
    case "user_input":
      return a.fieldIds?.some((id) => illustrative.has(id)) ? "illustrative" : "user";
    case "derived":
      return "derived";
    case "convention":
      return "convention";
    default:
      return "excluded";
  }
}

export function AssumptionsPanel({ r, f }: { r: AssessmentCalculationResult; f: ResultFormatter }) {
  const illustrative = new Set(r.metadata.illustrativeInputs);
  const groups = (Object.keys(GROUP_TITLE) as AssumptionRecord["group"][]).map((g) => ({ g, items: r.assumptions.filter((a) => a.group === g) })).filter((x) => x.items.length > 0);
  return (
    <Collapsible title="Assumptions used" summary={`${r.assumptionsUsed.length} used, ${r.assumptionsMissing.length} missing or left out`}>
      <div className="space-y-6">
        <p className="text-xs text-slate-600">Every number above rests on these. <strong>Missing / excluded</strong> items were not entered, or were deliberately left out of the primary calculation.</p>
        {groups.map(({ g, items }) => (
          <div key={g}>
            <h3 className="mb-2 text-sm font-semibold text-navy-950">{GROUP_TITLE[g]}</h3>
            <ResponsiveTable caption={`${GROUP_TITLE[g]} assumptions`}>
              <thead><tr className="border-b border-line bg-navy-50 text-navy-800"><th scope="col" className="px-3 py-2 text-left text-xs font-semibold">Assumption</th><th scope="col" className="px-3 py-2 text-left text-xs font-semibold">Value</th><th scope="col" className="px-3 py-2 text-left text-xs font-semibold">Basis</th></tr></thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id} className="border-b border-line align-top last:border-0">
                    <th scope="row" className="px-3 py-2 text-left text-xs font-medium text-navy-900">{a.label}</th>
                    <td className="px-3 py-2 text-xs text-navy-900">{f.text(a.value)}{a.unit ? ` ${f.text(a.unit)}` : ""}{a.note && <span className="mt-0.5 block text-slate-600">{f.text(a.note)}</span>}</td>
                    <td className="px-3 py-2"><AssumptionBadge kind={badgeFor(a, illustrative)} /></td>
                  </tr>
                ))}
              </tbody>
            </ResponsiveTable>
          </div>
        ))}
      </div>
    </Collapsible>
  );
}
