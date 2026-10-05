"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import { PageHelpButton } from "@/guidance/HelpButtons";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Collapsible } from "@/components/ui/collapsible";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { HelpTip } from "@/components/ui/help-tip";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ViabilityStatus } from "@/domain/types";
import { OPERATIONAL_STATUS_LABEL } from "@/calculation/operational/types";
import { TECH_NAMES, type AssessmentCalculationResult, type GreenTechId } from "@/calculation/types";
import type { CommercialClassification, CommercialViabilityResult, EconomicCase } from "@/calculation/viability/types";
import { ctaLabelFor } from "@/calculation/threshold";
import { OperationalStatusPill } from "./analysis-sections";
import type { ResultFormatter } from "./format-results";

const GREEN: readonly GreenTechId[] = ["bev", "biofuel"];

export const BADGE_STATUS: Record<CommercialClassification, ViabilityStatus> = {
  VIABLE: "viable",
  CONDITIONALLY_VIABLE: "conditionally_viable",
  NOT_YET_VIABLE: "not_yet_viable",
  INSUFFICIENT_EVIDENCE: "insufficient_evidence",
};

const ECON_WORD: Record<EconomicCase, string> = { FAVOURABLE: "Favourable", NEAR_BREAK_EVEN: "Near break-even", UNFAVOURABLE: "Unfavourable", INSUFFICIENT_DATA: "Insufficient data" };
const ENV_SHORT = { lower: "Lower estimated emissions", higher: "Higher estimated emissions", unchanged: "No difference (equal within numerical precision)", unavailable: "Comparison unavailable" } as const;
const STATE_WORD = { complete: "Complete", partial: "Partial", insufficient: "Insufficient" } as const;

const analysisOf = (r: AssessmentCalculationResult, g: GreenTechId) => (g === "bev" ? r.bevVsDiesel : r.biofuelVsDiesel);

/* --------------------------- headline cards --------------------------- */

function Guidance({ c, f }: { c: CommercialViabilityResult; f: ResultFormatter }) {
  if (c.classification === "VIABLE") {
    return (
      <div className="mt-4 rounded-lg border border-forest-200 bg-forest-50/60 p-3 text-sm text-forest-950">
        <p>Under the entered assumptions, this alternative establishes a favourable commercial case relative to diesel with no identified material operational constraint.</p>
        <p className="mt-1 text-xs font-medium">Decision-support result, not investment advice.</p>
        <div className="mt-3"><ButtonLink href={`/sensitivity#${c.technology}`} variant="secondary" size="sm">{ctaLabelFor(c.classification)}</ButtonLink></div>
      </div>
    );
  }
  if (c.classification === "CONDITIONALLY_VIABLE") {
    const items = c.recommendedNextSteps.filter((s) => s.code !== "GENERAL" && s.code !== "EMISSIONS_UNAVAILABLE" && s.code !== "CRITICAL_DATA_MISSING");
    return (
      <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50/70 p-3 text-sm text-amber-950">
        <h4 className="font-semibold">Conditions to Resolve</h4>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          {c.economicCase === "NEAR_BREAK_EVEN" && <li>The economic case is close to break-even, so a small change in the assumptions could change the result.</li>}
          {items.map((s) => (
            <li key={s.code}>
              {s.text}
              {s.target && <> <Link href={s.target} className="font-semibold underline underline-offset-2">Open inputs</Link></>}
            </li>
          ))}
        </ul>
        <div className="mt-3"><ButtonLink href={`/sensitivity#${c.technology}`} variant="secondary" size="sm">{ctaLabelFor(c.classification)}</ButtonLink></div>
      </div>
    );
  }
  if (c.classification === "NOT_YET_VIABLE") {
    return (
      <div className="mt-4 rounded-lg border border-red-300 bg-red-50/70 p-3 text-sm text-red-950">
        <h4 className="font-semibold">Primary barriers under current assumptions</h4>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          {c.economicCase === "UNFAVOURABLE" && <li>Incremental NPV is materially negative ({f.text(c.supportingEvidence[0]?.value ?? "")}).</li>}
          {c.hardConstraints.map((h) => <li key={h.checkId + h.code}>{f.text(h.text)}</li>)}
        </ul>
        <p className="mt-2 text-xs">These results may change if key assumptions change.</p>
        <div className="mt-3"><ButtonLink href={`/sensitivity#${c.technology}`} variant="secondary" size="sm">{ctaLabelFor(c.classification)}</ButtonLink></div>
      </div>
    );
  }
  const target = c.recommendedNextSteps.find((s) => s.code === "CRITICAL_DATA_MISSING")?.target ?? null;
  return (
    <div className="mt-4 rounded-lg border border-slate-300 bg-slate-100 p-3 text-sm text-slate-900">
      <h4 className="font-semibold">What is missing</h4>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {c.criticalMissing.length > 0 ? c.criticalMissing.map((m) => <li key={m.checkId}>{f.text(m.text)}</li>) : <li>{f.text(c.primaryReason)}</li>}
      </ul>
      <p className="mt-2 text-xs">GreenFleet does not force incomplete data into a viability label.</p>
      {target && <div className="mt-3"><ButtonLink href={target} variant="secondary" size="sm">Complete Missing Inputs</ButtonLink></div>}
    </div>
  );
}

export function CommercialHeadline({ r, f }: { r: AssessmentCalculationResult; f: ResultFormatter }) {
  return (
    <section aria-labelledby="commercial-title" className="space-y-3">
      <div>
        <div className="flex flex-wrap items-center gap-x-3"><h2 id="commercial-title" className="text-xl font-semibold text-navy-950">Commercial viability against diesel</h2><PageHelpButton id="results.commercial" label="What the four labels mean" /></div>
        <p className="text-sm text-slate-600">Is each green alternative commercially viable, relative to the diesel baseline, under the assumptions you entered? Decided by explicit rules on cost and operation. Environmental performance is shown beside it and does not change it.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h3 className="text-base font-semibold text-navy-950">Diesel</h3>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border-2 border-slate-400 bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-800"><Info aria-hidden className="size-3.5" />Baseline</p>
          <p className="mt-2 text-xs text-slate-600">The reference case that both alternatives are compared with. It is not given a viability label.</p>
        </Card>
        {GREEN.map((g) => {
          const c = r.commercial[g];
          const a = analysisOf(r, g);
          return (
            <Card key={g} className="p-5" data-testid={`commercial-${g}`}>
              <h3 className="text-base font-semibold text-navy-950">{TECH_NAMES[g]}</h3>
              <div className="mt-2"><StatusBadge status={BADGE_STATUS[c.classification]} size="lg" /></div>
              <p className="mt-3 text-sm font-medium text-navy-900">{f.text(c.primaryReason)}</p>
              <dl className="mt-3 divide-y divide-line text-sm">
                <div className="relative flex flex-wrap justify-between gap-x-3 py-1.5"><dt className="flex items-center gap-1 text-navy-800">NPV vs diesel<HelpTip term="npv" /></dt><dd className="font-semibold text-navy-950">{f.money(a.npv)}</dd></div>
                <div className="relative flex flex-wrap justify-between gap-x-3 py-1.5"><dt className="flex items-center gap-1 text-navy-800">Discounted payback<HelpTip term="discountedPayback" /></dt><dd className="text-right font-semibold text-navy-950">{f.years(a.discountedPayback)}</dd></div>
                <div className="flex flex-wrap items-center justify-between gap-x-3 py-1.5"><dt className="text-navy-800">Operational</dt><dd><OperationalStatusPill status={c.operationalStatus} /></dd></div>
                <div className="py-1.5"><dt className="text-navy-800">Environmental</dt><dd className="text-xs text-navy-900">{c.environmentalContext.text}</dd></div>
              </dl>
              <Guidance c={c} f={f} />
            </Card>
          );
        })}
      </div>
    </section>
  );
}

/* --------------------------- matrix --------------------------- */

export function CommercialMatrix({ r }: { r: AssessmentCalculationResult }) {
  const head = "px-4 py-2.5 text-left text-xs font-semibold";
  const cell = "px-4 py-2.5 align-top text-sm text-navy-900";
  const rows: [string, (c: CommercialViabilityResult) => React.ReactNode][] = [
    ["Economic", (c) => ECON_WORD[c.economicCase]],
    ["Operational", (c) => OPERATIONAL_STATUS_LABEL[c.operationalStatus]],
    ["Environmental", (c) => ENV_SHORT[c.environmentalContext.state]],
    ["Evidence completeness", (c) => (
      <>
        Economic: {STATE_WORD[c.evidenceCompleteness.economic]}<br />
        Operational: {STATE_WORD[c.evidenceCompleteness.operational]}<br />
        Environmental: {c.evidenceCompleteness.environmental === "available" ? "Available" : "Unavailable"} <span className="text-xs text-slate-600">(not required for the classification)</span>
      </>
    )],
    ["Commercial classification", (c) => <StatusBadge status={BADGE_STATUS[c.classification]} size="sm" />],
  ];
  return (
    <section aria-labelledby="matrix-title" className="space-y-3">
      <h2 id="matrix-title" className="text-lg font-semibold text-navy-950">Decision dimensions side by side</h2>
      <p className="text-sm text-slate-600">Each row is judged on its own. No dimension is turned into a number, and no score or weighting is used.</p>
      <ResponsiveTable caption="Economic, operational, environmental and evidence dimensions with the commercial classification, for battery electric and biofuel">
        <thead><tr className="border-b border-line bg-navy-50 text-navy-800"><th scope="col" className={head}>Dimension</th>{GREEN.map((g) => <th key={g} scope="col" className={head}>{TECH_NAMES[g]}</th>)}</tr></thead>
        <tbody>{rows.map(([label, fn]) => <tr key={label} className="border-b border-line last:border-0"><th scope="row" className="px-4 py-2.5 text-left text-sm font-medium text-navy-900">{label}</th>{GREEN.map((g) => <td key={g} className={cell}>{fn(r.commercial[g])}</td>)}</tr>)}</tbody>
      </ResponsiveTable>
    </section>
  );
}

/* --------------------------- why this result --------------------------- */

function WhyPanel({ r, g, f }: { r: AssessmentCalculationResult; g: GreenTechId; f: ResultFormatter }) {
  const c = r.commercial[g];
  const op = r.operational[g];
  const list = (items: string[], empty: string) => (items.length === 0 ? <p className="text-slate-600">{empty}</p> : <ul className="list-disc space-y-1 pl-5">{items.map((x, i) => <li key={i}>{f.text(x)}</li>)}</ul>);
  return (
    <Collapsible title={`Why this result? ${TECH_NAMES[g]}`} summary={`${c.classification.replace(/_/g, " ")}. Every step of the decision, and the policy that produced it.`}>
      <div className="space-y-4">
        <div><h4 className="font-semibold text-navy-950">Economic evidence</h4>
          <p className="mb-1 text-slate-700">{f.text(c.economic.explanation)} Economic case: <strong>{ECON_WORD[c.economicCase]}</strong>.</p>
          <dl className="divide-y divide-line">{c.supportingEvidence.filter((e) => e.label !== "Operational status").map((e) => <div key={e.label} className="flex flex-wrap justify-between gap-x-3 py-1"><dt>{e.label}</dt><dd className="text-right font-medium text-navy-950">{f.text(e.value)}</dd></div>)}</dl>
        </div>
        <div><h4 className="font-semibold text-navy-950">Operational evidence</h4>
          <p className="mb-1 text-slate-700">Operational status: <strong>{OPERATIONAL_STATUS_LABEL[op.status]}</strong>. {op.statusExplanation}</p>
          {list(Object.values(op.checks).map((k) => `${k.label}: ${k.explanation}`), "No operational checks.")}
        </div>
        <div><h4 className="font-semibold text-navy-950">Material conditions</h4>{list(c.conditions.map((x) => x.text), "None identified.")}</div>
        <div><h4 className="font-semibold text-navy-950">Uncertainties</h4>{list(c.uncertainties.map((x) => x.text), "No material uncertainty identified.")}</div>
        <div><h4 className="font-semibold text-navy-950">Hard constraints</h4>{list(c.hardConstraints.map((x) => x.text), "None identified.")}</div>
        <div><h4 className="font-semibold text-navy-950">Environmental context</h4><p>{c.environmentalContext.text}</p><p className="text-xs text-slate-600">Shown for context. It was not used to decide the classification.</p></div>
        <div><h4 className="font-semibold text-navy-950">Reason codes</h4><p className="font-mono text-xs">{c.reasonCodes.join(", ")}</p></div>
        <div><h4 className="font-semibold text-navy-950">Decision trace</h4>
          <ol className="list-decimal space-y-1 pl-5">{c.decisionTrace.map((s) => <li key={s.step}><span className="text-xs uppercase tracking-wide text-slate-600">{s.gate}</span> {f.text(s.text)}</li>)}</ol>
        </div>
        <p className="text-xs text-slate-600">Policy: {c.policyId}. <Link href="/methodology" className="font-semibold underline underline-offset-2">Read the policy</Link>. Decision-support result, not investment advice.</p>
      </div>
    </Collapsible>
  );
}

export function WhyPanels({ r, f }: { r: AssessmentCalculationResult; f: ResultFormatter }) {
  return (
    <section aria-labelledby="why-title" className="space-y-3">
      <h2 id="why-title" className="sr-only">Why these results</h2>
      <PageHelpButton id="results.why" label="How to read the decision trace" />
      {GREEN.map((g) => <WhyPanel key={g} r={r} g={g} f={f} />)}
    </section>
  );
}

export function CommercialPolicyNote({ r }: { r: AssessmentCalculationResult }) {
  return (
    <Card>
      <CardHeader title="How the classification is decided" description={r.commercial.bev.policyId} />
      <CardBody className="space-y-2 text-sm text-navy-800">
        <p>Fixed rules in order: is the evidence sufficient, is it operationally feasible, is the economic case favourable, near break-even or unfavourable, and are conditions or uncertainties left. There is no weighted score. Environmental performance is reported but does not change the label.</p>
        <p>The near-break-even tolerance is a prototype decision tolerance of ±{(r.commercial.bev.economic.nearBreakEvenTolerancePct)}%. The decision rules are prototype modelling policies for transparent comparative analysis, not universal investment laws. <Link href="/methodology" className="font-semibold underline underline-offset-2">Methodology</Link>.</p>
      </CardBody>
    </Card>
  );
}
