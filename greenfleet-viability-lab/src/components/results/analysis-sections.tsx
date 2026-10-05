"use client";

import { AlertTriangle, CheckCircle2, CircleHelp, Info, OctagonAlert, Wrench } from "lucide-react";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { ButtonLink } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { TECH_NAMES, type AssessmentCalculationResult, type CalcWarning, type GreenTechId, type TechId } from "@/calculation/types";
import { OPERATIONAL_STATUS_MEANING, type CheckStatus, type OperationalCheck, type OperationalStatus } from "@/calculation/operational/types";
import type { TechnologyEmissions } from "@/calculation/environmental/types";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useId } from "react";

const TECHS: readonly TechId[] = ["diesel", "bev", "biofuel"];
const NO_VALUE = "Not available";

/** Economic findings that the operational layer now reports in more detail. */
const SUPERSEDED_ECONOMIC = new Set(["BEV_RANGE_BELOW_DAILY_DISTANCE", "BIOFUEL_AVAILABILITY", "BIOFUEL_AVAILABILITY_UNKNOWN"]);

const STATUS_STYLE: Record<OperationalStatus, { cls: string; Icon: typeof CheckCircle2; word: string }> = {
  suitable: { cls: "border-forest-600 bg-forest-50 text-forest-900", Icon: CheckCircle2, word: "Suitable" },
  conditional: { cls: "border-amber-400 bg-amber-50 text-amber-950", Icon: Wrench, word: "Conditional" },
  constrained: { cls: "border-red-400 bg-red-50 text-red-900", Icon: OctagonAlert, word: "Constrained" },
  insufficient_data: { cls: "border-slate-400 bg-slate-100 text-slate-800", Icon: CircleHelp, word: "Insufficient data" },
};

/** Square-cornered, labelled "Operational:" so it cannot be mistaken for a commercial badge. */
export function OperationalStatusPill({ status }: { status: OperationalStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border-2 px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${s.cls}`}>
      <s.Icon aria-hidden className="size-3.5" />
      <span className="font-medium normal-case tracking-normal">Operational:</span> {s.word}
    </span>
  );
}

const CHECK_WORD: Record<CheckStatus, string> = { satisfied: "Satisfied", conditional: "Conditional", constrained: "Constrained", insufficient: "Insufficient data", not_assessed: "Not assessed" };

/* ------------------------- completeness ------------------------- */

const STATE_WORD: Record<string, string> = { complete: "Complete", partial: "Partial", insufficient: "Insufficient", unavailable: "Unavailable" };

export function CompletenessIndicators({ r }: { r: AssessmentCalculationResult }) {
  const c = r.dataCompleteness;
  const rows: [string, string, string][] = [
    ["Economic data", STATE_WORD[c.economic.state] ?? c.economic.state, c.economic.missing.length ? `Not entered or left out: ${c.economic.missing.join(", ")}.` : "No cost assumption that shapes the figures is missing."],
    ["Operational data", STATE_WORD[c.operational.state] ?? c.operational.state, `Battery electric: ${c.operational.bev.provided} of ${c.operational.bev.total} items answered. Biofuel: ${c.operational.biofuel.provided} of ${c.operational.biofuel.total} items answered.`],
    ["Environmental data", STATE_WORD[c.environmental.state] ?? c.environmental.state, c.environmental.unavailable.length ? `No usable emission factor for: ${c.environmental.unavailable.map((t) => TECH_NAMES[t]).join(", ")}.` : "Emission factors supplied for all three options."],
  ];
  return (
    <Card>
      <CardHeader title="How complete is the data behind each layer?" description="Reported separately. Complete data in one layer does not make up for gaps in another." />
      <CardBody>
        <dl className="grid gap-4 md:grid-cols-3">
          {rows.map(([label, state, detail]) => (
            <div key={label} className="min-w-0">
              <dt className="text-sm text-slate-600">{label}</dt>
              <dd className="text-base font-semibold text-navy-950">{state}</dd>
              <dd className="mt-1 text-xs text-slate-600">{detail}</dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  );
}

/* ------------------------- operational ------------------------- */

function CheckList({ checks }: { checks: OperationalCheck[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {checks.map((c) => (
        <li key={c.id} className="rounded-lg border border-line p-3 text-sm">
          <p className="font-semibold text-navy-950">{c.label}: <span className="font-medium">{CHECK_WORD[c.status]}</span></p>
          <p className="mt-0.5 text-xs text-slate-700">{c.explanation}</p>
        </li>
      ))}
    </ul>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5">
      <dt className="text-sm text-navy-800">{label}</dt>
      <dd className="text-right text-sm font-semibold text-navy-950">{value}</dd>
    </div>
  );
}

const CHARGING_WORD: Record<string, string> = { dedicated_private: "Dedicated private charging", shared_private: "Shared private charging", public_only: "Public charging only", existing_access: "Existing charging access", unknown: "Unknown" };

function RangeVisual({ r }: { r: AssessmentCalculationResult }) {
  const m = r.operational.bev.rangeMetrics;
  if (!m) return null;
  const scale = Math.max(m.dailyDistanceKm, m.usableRangeKm, m.routeDistanceKm ?? 0) || 1;
  const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;
  const bars: [string, number, string][] = [
    ["Required daily distance", m.dailyDistanceKm, m.dailyExceedsRange ? "bg-red-600" : "bg-navy-600"],
    ["Stated usable range", m.usableRangeKm, "bg-forest-600"],
  ];
  if (m.routeDistanceKm !== null) bars.push(["Average route distance", m.routeDistanceKm, m.routeExceedsRange ? "bg-red-600" : "bg-slate-500"]);
  return (
    <figure className="mt-3" aria-label="Daily distance compared with usable range">
      <div className="space-y-2">
        {bars.map(([label, v, color]) => (
          <div key={label}>
            <div className="flex justify-between text-xs text-navy-800"><span>{label}</span><span className="tabular-nums">{formatNumber(v, 0)} km</span></div>
            <div className="h-3 w-full rounded bg-navy-50"><div className={`h-3 rounded ${color}`} style={{ width: pct(v) }} /></div>
          </div>
        ))}
      </div>
      <figcaption className="mt-2 text-xs text-slate-600">
        {m.rangeMarginKm >= 0 ? `The stated range covers the daily distance with ${formatNumber(m.rangeMarginKm, 0)} km to spare.` : `The daily distance is ${formatNumber(-m.rangeMarginKm, 0)} km more than the stated range.`} No safety buffer is assumed.
      </figcaption>
    </figure>
  );
}

export function OperationalSection({ r, arrangement }: { r: AssessmentCalculationResult; arrangement: string | null }) {
  const bev = r.operational.bev;
  const bio = r.operational.biofuel;
  const m = bev.rangeMetrics;
  return (
    <section aria-labelledby="op-title" className="space-y-4">
      <div>
        <h2 id="op-title" className="text-lg font-semibold text-navy-950">Operational feasibility</h2>
        <p className="text-sm text-slate-600">Could each option do the transport task you described? Rule-based checks on your own inputs. No cost or emissions figure is used here.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h3 className="text-base font-semibold text-navy-950">Diesel</h3>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border-2 border-slate-400 bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-800"><Info aria-hidden className="size-3.5" />Baseline configuration</p>
          <p className="mt-2 text-xs text-slate-600">Diesel is taken as the existing way of doing the work. No constraint is collected for it.</p>
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold text-navy-950">Battery electric</h3>
          <div className="mt-2"><OperationalStatusPill status={bev.status} /></div>
          <p className="mt-2 text-xs text-slate-700">{OPERATIONAL_STATUS_MEANING[bev.status]} {bev.statusExplanation}</p>
          <dl className="mt-2 divide-y divide-line">
            <Row label="Daily distance" value={m ? `${formatNumber(m.dailyDistanceKm, 0)} km` : NO_VALUE} />
            <Row label="Stated usable range" value={m ? `${formatNumber(m.usableRangeKm, 0)} km` : NO_VALUE} />
            <Row label="Range margin" value={m ? `${formatNumber(m.rangeMarginKm, 0)} km (${formatNumber(m.rangeMarginPercent, 0)}%)` : NO_VALUE} />
            <Row label="Charging arrangement" value={arrangement ? (CHARGING_WORD[arrangement] ?? arrangement) : "Not stated"} />
            <Row label="Charging time entered (per vehicle, per year)" value={bev.chargingTime.perVehicleAnnualHours === null ? "Not entered" : `${formatNumber(bev.chargingTime.perVehicleAnnualHours, 0)} h`} />
            <Row label="Payload compatibility" value={CHECK_WORD[bev.checks.payload.status]} />
          </dl>
          <RangeVisual r={r} />
          <CheckList checks={[bev.checks.range, bev.checks.route, bev.checks.charging, bev.checks.payload]} />
          {bev.conditions.length > 0 && <ul className="mt-3 list-disc pl-5 text-xs text-navy-800">{bev.conditions.map((c) => <li key={c}>{c}</li>)}</ul>}
          {bev.notAssessed.length > 0 && <p className="mt-2 text-xs text-slate-600">Not assessed: {bev.notAssessed.join(", ")}.</p>}
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold text-navy-950">Biofuel</h3>
          <div className="mt-2"><OperationalStatusPill status={bio.status} /></div>
          <p className="mt-2 text-xs text-slate-700">{OPERATIONAL_STATUS_MEANING[bio.status]} {bio.statusExplanation}</p>
          <dl className="mt-2 divide-y divide-line">
            <Row label="Fuel availability" value={CHECK_WORD[bio.checks.supply.status]} />
            <Row label="Additional refuelling distance" value={bio.refuelling.additionalDistanceKmPerVehiclePerDay === null ? "Not entered" : `${formatNumber(bio.refuelling.additionalDistanceKmPerVehiclePerDay, 1)} km per vehicle per day`} />
            <Row label="Fuel-related downtime" value={bio.downtime.annualHours === null ? "Not entered" : `${formatNumber(bio.downtime.annualHours, 0)} h per vehicle per year`} />
            <Row label="Infrastructure readiness" value={CHECK_WORD[bio.checks.infrastructure.status]} />
          </dl>
          <CheckList checks={[bio.checks.supply, bio.checks.infrastructure]} />
          {bio.conditions.length > 0 && <ul className="mt-3 list-disc pl-5 text-xs text-navy-800">{bio.conditions.map((c) => <li key={c}>{c}</li>)}</ul>}
          {bio.notAssessed.length > 0 && <p className="mt-2 text-xs text-slate-600">Not assessed: {bio.notAssessed.join(", ")}.</p>}
        </Card>
      </div>
      <div>
        <ButtonLink href="/assessment/electric#section-bev-ops" variant="secondary" size="sm">Review Operational Inputs (battery electric)</ButtonLink>{" "}
        <ButtonLink href="/assessment/biofuel#section-bio-supply" variant="secondary" size="sm">Review Operational Inputs (biofuel)</ButtonLink>
      </div>
    </section>
  );
}

/* ------------------------- environmental ------------------------- */

const tonnes = (x: number | null) => (x === null ? NO_VALUE : `${formatNumber(x, 2)} tCO2e`);
const perKm = (x: number | null) => (x === null ? NO_VALUE : `${formatNumber(x, 3)} kg CO2e/km`);

function change(r: AssessmentCalculationResult, g: GreenTechId): [string, string] {
  const c = g === "bev" ? r.environmental.bevVsDiesel : r.environmental.biofuelVsDiesel;
  if (c.status !== "calculated") return [NO_VALUE, NO_VALUE];
  const abs = c.absoluteDifferenceAnnualTonnes;
  const absText = abs === null ? NO_VALUE : `${formatNumber(Math.abs(abs), 2)} tCO2e a year ${abs >= 0 ? "less" : "more"}`;
  const pct = c.percentageChange === null ? NO_VALUE : `${c.label ?? "Change"}: ${formatNumber(Math.abs(c.percentageChange), 1)}%`;
  return [absText, pct];
}

function factorText(t: TechnologyEmissions): string {
  const f = t.factor;
  if (!f) return "No factor supplied";
  return `${formatNumber(f.enteredValue, 4)} ${f.enteredUnit}; ${f.source ?? "no source given"}${f.sourceYear ? `, ${f.sourceYear}` : ""}; ${f.scopeLabel}`;
}

function EmissionsChart({ r }: { r: AssessmentCalculationResult }) {
  const id = useId();
  const shown = TECHS.map((t) => ({ id: t, name: TECH_NAMES[t], value: r.environmental[t].annualEmissionsTonnes })).filter((d): d is { id: TechId; name: string; value: number } => d.value !== null);
  const omitted = TECHS.filter((t) => r.environmental[t].annualEmissionsTonnes === null);
  if (shown.length === 0) return null;
  return (
    <figure aria-labelledby={`${id}-t`} className="min-w-0 max-w-full rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <h3 id={`${id}-t`} className="text-base font-semibold text-navy-950">Estimated annual operational emissions</h3>
      <p className="mt-1 text-xs text-slate-600">Tonnes CO2e a year for the whole fleet, from the factors you supplied. Lower is better. Scope: operational energy and fuel use only.</p>
      {omitted.length > 0 && <p className="mt-1 text-xs font-medium text-amber-900">Not shown, because no emission factor was supplied: {omitted.map((t) => TECH_NAMES[t]).join(", ")}.</p>}
      <div className="mt-3 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={shown} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="#dde2e8" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#3c4d6a" }} />
            <YAxis tick={{ fontSize: 12, fill: "#3c4d6a" }} width={56} />
            <Tooltip formatter={(v) => `${formatNumber(Number(v), 2)} tCO2e`} />
            <Bar dataKey="value" name="tCO2e a year" fill="#2e7d5b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-3 text-xs">
        <summary className="w-fit cursor-pointer font-medium text-navy-600 underline underline-offset-2 hover:text-navy-900">View this chart as a table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[18rem] text-xs">
            <caption className="sr-only">Estimated annual operational emissions by technology</caption>
            <thead><tr><th className="px-3 py-1.5 text-left font-semibold text-navy-800">Option</th><th className="px-3 py-1.5 text-left font-semibold text-navy-800">tCO2e a year</th></tr></thead>
            <tbody>{TECHS.map((t) => <tr key={t} className="border-t border-line"><td className="px-3 py-1.5">{TECH_NAMES[t]}</td><td className="px-3 py-1.5 tabular-nums">{tonnes(r.environmental[t].annualEmissionsTonnes)}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

export function EnvironmentalSection({ r }: { r: AssessmentCalculationResult }) {
  const env = r.environmental;
  const head = "px-4 py-2.5 text-left text-xs font-semibold";
  const cell = "px-4 py-2.5 align-top text-sm tabular-nums text-navy-900";
  const rows: [string, (t: TechId) => string][] = [
    ["Annual emissions", (t) => tonnes(env[t].annualEmissionsTonnes)],
    ["Emissions per km", (t) => perKm(env[t].emissionsPerKmKg)],
    [`Emissions over ${r.metadata.horizonYears} years`, (t) => tonnes(env[t].horizonEmissionsTonnes)],
    ["Change against diesel (absolute)", (t) => (t === "diesel" ? "Reference" : change(r, t)[0])],
    ["Change against diesel (percent)", (t) => (t === "diesel" ? "Reference" : change(r, t)[1])],
    ["Emission factor, source, year and scope", (t) => factorText(env[t])],
  ];
  return (
    <section aria-labelledby="env-title" className="space-y-4">
      <div>
        <h2 id="env-title" className="text-lg font-semibold text-navy-950">Environmental performance</h2>
        <p className="text-sm text-slate-600">Estimated operational energy/fuel-related GHG emissions, from the factors you supplied. This is not a life-cycle assessment: vehicle and battery manufacturing, disposal and infrastructure emissions are not included.</p>
      </div>
      <ResponsiveTable caption="Estimated operational emissions of diesel, battery electric and biofuel">
        <thead><tr className="border-b border-line bg-navy-50 text-navy-800"><th scope="col" className={head}>Metric</th>{TECHS.map((t) => <th key={t} scope="col" className={head}>{TECH_NAMES[t]}</th>)}</tr></thead>
        <tbody>{rows.map(([label, fn]) => <tr key={label} className="border-b border-line last:border-0"><th scope="row" className="px-4 py-2.5 text-left text-sm font-medium text-navy-900">{label}</th>{TECHS.map((t) => <td key={t} className={cell}>{fn(t)}</td>)}</tr>)}</tbody>
      </ResponsiveTable>
      {env.dataCompleteness.unavailable.length > 0 && (
        <p className="text-sm text-navy-800">Where a figure reads &quot;{NO_VALUE}&quot;, no usable emission factor was entered. It does not mean zero emissions. <ButtonLink href="/assessment/finance#section-fin-env" variant="secondary" size="sm">Add Emission Factors</ButtonLink></p>
      )}
      <EmissionsChart r={r} />
    </section>
  );
}

/* ------------------------- grouped warnings ------------------------- */

export function economicWarnings(all: CalcWarning[]): CalcWarning[] {
  return all.filter((w) => !SUPERSEDED_ECONOMIC.has(w.code));
}

export function DomainWarnings({ r }: { r: AssessmentCalculationResult }) {
  const groups: [string, CalcWarning[]][] = [
    ["Operational", r.operational.warnings],
    ["Environmental", r.environmental.warnings],
  ];
  const any = groups.some(([, w]) => w.length > 0);
  if (!any) return null;
  return (
    <Card>
      <CardHeader title="Things to know about the operational and environmental results" description="These affect how far you can rely on those two layers." />
      <CardBody className="space-y-4">
        {groups.filter(([, w]) => w.length > 0).map(([title, list]) => (
          <div key={title}>
            <h3 className="mb-2 text-sm font-semibold text-navy-950">{title}</h3>
            <ul className="space-y-2">
              {list.map((w) => (
                <li key={w.code + w.scope + w.message} className={`flex gap-3 rounded-xl border p-3 text-sm ${w.severity === "warning" ? "border-amber-300 bg-amber-50 text-amber-950" : "border-line bg-navy-50/60 text-navy-900"}`}>
                  {w.severity === "warning" ? <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0" /> : <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-navy-500" />}
                  <span><span className="sr-only">{w.severity === "warning" ? "Warning: " : "Note: "}</span>{w.message}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="text-xs text-slate-600">See the <Link href="/methodology" className="font-semibold underline underline-offset-2">methodology</Link> for the rules behind these.</p>
      </CardBody>
    </Card>
  );
}
