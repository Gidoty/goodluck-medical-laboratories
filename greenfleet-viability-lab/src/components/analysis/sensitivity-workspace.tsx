"use client";

import { useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { ClassBadge, BaseGate, TECH_LABEL, ECON_WORD, opLabel, useBaseInput } from "./shared";
import { DriversSection } from "./drivers";
import { OneWaySection } from "./one-way";
import { TwoWaySection } from "./two-way";
import { ViabilityPanel } from "./viability-panel";
import { evaluateInput } from "@/calculation/analysis/evaluate";
import type { GreenTechId } from "@/calculation/types";
import type { NormalizedAssessmentInput } from "@/domain/normalized";
import type { ResultFormatter } from "@/components/results/format-results";

const techFromHash = (): GreenTechId => (typeof window !== "undefined" && window.location.hash.includes("biofuel") ? "biofuel" : "bev");

function BaseCase({ input, tech, f }: { input: NormalizedAssessmentInput; tech: GreenTechId; f: ResultFormatter }) {
  const e = evaluateInput(input);
  if (!e.ok) return null;
  const s = e[tech];
  return (
    <Card>
      <CardBody>
        <h2 className="text-base font-semibold text-navy-950">Base Case: your current assessment</h2>
        <p className="text-xs text-slate-600">Every analysis below starts here and never changes it.</p>
        <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <div><dt className="text-slate-600">Incremental NPV vs diesel</dt><dd className="font-semibold text-navy-950">{f.money(s.npv)}</dd></div>
          <div><dt className="text-slate-600">Total cost of ownership</dt><dd className="font-semibold text-navy-950">{f.money(s.tco)}</dd></div>
          <div><dt className="text-slate-600">Economic case</dt><dd className="font-semibold text-navy-950">{ECON_WORD[s.economicCase]}</dd></div>
          <div><dt className="text-slate-600">Operational status</dt><dd className="font-semibold text-navy-950">{opLabel(s.operationalStatus)}</dd></div>
          <div><dt className="text-slate-600">Commercial classification</dt><dd className="pt-0.5"><ClassBadge c={s.classification} /></dd></div>
        </dl>
      </CardBody>
    </Card>
  );
}

function Workspace({ input, f }: { input: NormalizedAssessmentInput; f: ResultFormatter }) {
  const [tech, setTech] = useState<GreenTechId>(() => techFromHash());
  useEffect(() => {
    // A link such as "#biofuel" arrives after this component mounted, so follow it from the handlers.
    const follow = () => setTech(techFromHash());
    window.addEventListener("hashchange", follow);
    const t = window.setTimeout(follow, 150);
    return () => {
      window.removeEventListener("hashchange", follow);
      window.clearTimeout(t);
    };
  }, []);
  return (
    <div className="space-y-6">
      <div role="radiogroup" aria-label="Alternative to analyse" className="flex flex-wrap gap-2">
        {(["bev", "biofuel"] as const).map((t) => (
          <label key={t} className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-semibold focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-forest-500 ${tech === t ? "border-forest-600 bg-forest-50 text-forest-900" : "border-line text-navy-700"}`}>
            <input type="radio" name="tech" value={t} checked={tech === t} onChange={() => setTech(t)} className="sr-only" />
            {TECH_LABEL[t]} vs diesel
          </label>
        ))}
      </div>
      <BaseCase input={input} tech={tech} f={f} />
      <ViabilityPanel input={input} tech={tech} f={f} />
      <OneWaySection input={input} tech={tech} f={f} key={`ow-${tech}`} />
      <DriversSection input={input} tech={tech} f={f} />
      <TwoWaySection input={input} tech={tech} f={f} key={`tw-${tech}`} />
    </div>
  );
}

export function SensitivityWorkspace() {
  const state = useBaseInput();
  return <BaseGate state={state}>{(s) => <Workspace input={s.input} f={s.f} />}</BaseGate>;
}
