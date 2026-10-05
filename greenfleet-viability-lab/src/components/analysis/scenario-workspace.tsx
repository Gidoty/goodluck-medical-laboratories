"use client";

import { Copy, Pencil, Trash2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { PageHelpButton } from "@/guidance/HelpButtons";
import { VARIABLE_IDS, VARIABLES, type VariableId } from "@/calculation/analysis/variables";
import { MAX_SCENARIOS, compareScenarios, validateScenario, type Overrides, type Scenario, type ScenarioResult, type ScenarioTechResult } from "@/calculation/scenario";
import { formatValue } from "@/calculation/analysis/format";
import type { GreenTechId } from "@/calculation/types";
import type { NormalizedAssessmentInput } from "@/domain/normalized";
import type { ResultFormatter } from "@/components/results/format-results";
import { useScenarios } from "@/state/useScenarios";
import { BaseGate, ClassBadge, Disclaimer, ECON_WORD, TECH_LABEL, opLabel, useBaseInput } from "./shared";

const field = "block w-full min-w-0 rounded-lg border border-navy-200 bg-surface px-3 py-2 text-sm";
const ORIGIN_WORD = { user: "USER-CREATED", illustrative: "ILLUSTRATIVE", threshold: "FROM A THRESHOLD" } as const;

interface Row { variableId: VariableId | ""; value: string }

function Builder({ input, editing, onDone }: { input: NormalizedAssessmentInput; editing: Scenario | null; onDone: () => void }) {
  const id = useId();
  const { store, state } = useScenarios();
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [rows, setRows] = useState<Row[]>(editing ? Object.entries(editing.overrides).map(([variableId, v]) => ({ variableId: variableId as VariableId, value: String(v) })) : [{ variableId: "", value: "" }]);
  const [error, setError] = useState<string | null>(null);
  const options = useMemo(() => VARIABLE_IDS.map((v) => VARIABLES[v]).filter((v) => v.applicable(input).ok), [input]);
  const used = (v: VariableId, i: number) => rows.some((r, k) => k !== i && r.variableId === v);

  const save = () => {
    const overrides: Overrides = {};
    for (const r of rows) {
      if (!r.variableId) continue;
      const def = VARIABLES[r.variableId];
      if (def.kind === "numeric") {
        const n = Number(r.value);
        if (r.value.trim() === "" || !Number.isFinite(n)) { setError(`${def.label}: enter a number.`); return; }
        overrides[r.variableId] = n;
      } else overrides[r.variableId] = r.value;
    }
    const check = validateScenario(input, { name, overrides });
    if (!check.ok) { setError(check.message); return; }
    const res = editing
      ? (() => { const a = store.rename(editing.id, name); return a.ok ? store.update(editing.id, { description, overrides }) : a; })()
      : store.add({ name, description, overrides });
    if (!res.ok) { setError(res.message); return; }
    setError(null);
    onDone();
  };

  const full = !editing && state.scenarios.length >= MAX_SCENARIOS;
  return (
    <Card id="builder" className="scroll-mt-28">
      <CardHeader title={editing ? "Edit scenario" : "Create scenario"} description="A scenario is your Base Case plus the changes you choose here. You do not re-enter the assessment." />
      <CardBody className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold text-navy-900" htmlFor={`${id}-n`}>Name<input id={`${id}-n`} className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="For example: Higher utilisation" /></label>
          <label className="text-sm font-semibold text-navy-900" htmlFor={`${id}-d`}>Description (optional)<input id={`${id}-d`} className={field} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-navy-900">Assumptions to change</legend>
          {rows.map((r, i) => {
            const def = r.variableId ? VARIABLES[r.variableId] : null;
            const base = def ? def.get(input) : null;
            return (
              <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] sm:items-end">
                <label className="text-xs font-medium text-navy-800">Assumption
                  <select className={field} value={r.variableId} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { variableId: e.target.value as VariableId, value: "" } : x)))}>
                    <option value="">Choose…</option>
                    {options.map((o) => <option key={o.id} value={o.id} disabled={used(o.id, i)}>{o.label}</option>)}
                  </select>
                </label>
                <label className="text-xs font-medium text-navy-800">New value {def && base !== null ? <span className="font-normal text-slate-600">(Base Case: {typeof base === "number" ? formatValue(def.unit, base).replace("{cur}", "") : base})</span> : null}
                  {def?.kind === "categorical" ? (
                    <select className={field} value={r.value} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)))}><option value="">Choose…</option>{def.options!.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
                  ) : (
                    <input className={field} inputMode="decimal" value={r.value} disabled={!def} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)))} />
                  )}
                </label>
                <Button size="sm" variant="ghost" onClick={() => setRows(rows.length > 1 ? rows.filter((_, k) => k !== i) : [{ variableId: "", value: "" }])} aria-label={`Remove change ${i + 1}`}>Remove</Button>
              </div>
            );
          })}
          <Button size="sm" variant="secondary" onClick={() => setRows([...rows, { variableId: "", value: "" }])}>Add another change</Button>
        </fieldset>
        {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
        {full && <p role="status" className="text-sm text-amber-900">You can keep up to {MAX_SCENARIOS} scenarios so the comparison stays readable. Delete one to add another.</p>}
        <div className="flex flex-wrap gap-2"><Button onClick={save} disabled={full}>{editing ? "Save changes" : "Save and run scenario"}</Button>{editing && <Button variant="secondary" onClick={onDone}>Cancel</Button>}</div>
      </CardBody>
    </Card>
  );
}

function techRow(tech: GreenTechId, r: ScenarioResult): ScenarioTechResult | null {
  return tech === "bev" ? r.bev : r.biofuel;
}

function Comparison({ comparison, tech, f }: { comparison: Extract<ReturnType<typeof compareScenarios>, { base: unknown }>; tech: GreenTechId; f: ResultFormatter }) {
  const cols = [comparison.base, ...comparison.scenarios];
  const delta = (v: number, fmt: (n: number) => string) => (v === 0 ? "" : ` (${v > 0 ? "+" : ""}${fmt(v)})`);
  const rows: [string, (t: ScenarioTechResult) => React.ReactNode][] = [
    ["Incremental NPV vs diesel", (t) => <>{f.money(t.snapshot.npv)}<span className="block text-slate-600">{delta(t.deltaNpv, f.money).trim()}</span></>],
    ["Total cost of ownership", (t) => <>{f.money(t.snapshot.tco)}<span className="block text-slate-600">{delta(t.deltaTco, f.money).trim()}</span></>],
    ["Present cost", (t) => f.money(t.snapshot.presentCost)],
    ["Cost per km", (t) => f.perKm(t.snapshot.tcoPerKm)],
    ["Simple payback", (t) => f.years(t.snapshot.simplePayback)],
    ["Discounted payback", (t) => f.years(t.snapshot.discountedPayback)],
    ["Economic case", (t) => ECON_WORD[t.snapshot.economicCase]],
    ["Operational status", (t) => <>{opLabel(t.snapshot.operationalStatus)}{t.operationalChanged ? <span className="block font-semibold text-amber-900">changed from Base Case</span> : null}</>],
    ["Environmental change vs diesel", (t) => (t.snapshot.environmental.state === "unavailable" ? "Unavailable" : t.snapshot.environmental.state === "unchanged" ? "No difference" : `${t.snapshot.environmental.state === "lower" ? "Lower" : "Higher"}${t.snapshot.environmental.percentChange === null ? "" : ` by ${Math.abs(t.snapshot.environmental.percentChange).toFixed(1)}%`}`)],
    ["Commercial classification", (t) => <>{<ClassBadge c={t.snapshot.classification} />}{t.classificationChanged ? <span className="mt-1 block font-semibold text-amber-900">changed from Base Case</span> : null}</>],
  ];
  return (
    <ResponsiveTable caption={`${TECH_LABEL[tech]} against diesel: Base Case and scenarios`}>
      <thead><tr className="border-b border-line bg-navy-50 text-navy-800"><th scope="col" className="px-3 py-2 text-left text-xs font-semibold">Metric</th>{cols.map((c, i) => <th key={i} scope="col" className="px-3 py-2 text-left text-xs font-semibold">{c.name}</th>)}</tr></thead>
      <tbody>
        {rows.map(([label, fn]) => (
          <tr key={label} className="border-b border-line align-top last:border-0">
            <th scope="row" className="px-3 py-2 text-left text-xs font-medium text-navy-900">{label}</th>
            {cols.map((c, i) => { const t = techRow(tech, c); return <td key={i} className="px-3 py-2 text-xs tabular-nums text-navy-900">{t ? fn(t) : <span className="text-red-900">Could not be calculated</span>}</td>; })}
          </tr>
        ))}
      </tbody>
    </ResponsiveTable>
  );
}

function Workspace({ input, f }: { input: NormalizedAssessmentInput; f: ResultFormatter }) {
  const { state, store } = useScenarios();
  const [editing, setEditing] = useState<Scenario | null>(null);
  const [tech, setTech] = useState<GreenTechId>("bev");
  const [notice, setNotice] = useState<string | null>(null);
  const comparison = useMemo(() => compareScenarios(input, state.scenarios), [input, state.scenarios]);
  const act = (r: { ok: boolean; message?: string }) => setNotice(r.ok ? null : r.message ?? null);

  return (
    <div className="space-y-6">
      <Builder key={editing?.id ?? "new"} input={input} editing={editing} onDone={() => setEditing(null)} />
      {notice && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">{notice}</p>}

      <Card>
        <CardHeader title="Your scenarios" description={`Saved in this browser. Up to ${MAX_SCENARIOS}, so the comparison stays readable.`} action={<PageHelpButton id="scenarios" label="How scenarios work" />} />
        <CardBody>
          {!state.hydrated ? <p role="status" className="text-sm text-slate-600">Loading saved scenarios…</p> : state.scenarios.length === 0 ? (
            <p className="text-sm text-slate-700">No scenarios yet. Create one above, or use Create Scenario at This Threshold on the Sensitivity page. The Base Case is always shown for comparison.</p>
          ) : (
            <ul className="space-y-3">
              {state.scenarios.map((s) => {
                const res = !("status" in comparison) ? comparison.scenarios.find((x) => x.scenario?.id === s.id) : undefined;
                return (
                  <li key={s.id} className="rounded-xl border border-line p-4" data-testid="scenario-item">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0"><p className="font-semibold text-navy-950">{s.name}</p><p className="mt-0.5 inline-block rounded border border-line bg-navy-50 px-1.5 py-px text-[0.65rem] font-bold tracking-wide text-navy-800">{ORIGIN_WORD[s.origin]}</p>{s.description && <p className="mt-1 text-xs text-slate-600">{s.description}</p>}</div>
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="secondary" onClick={() => { setEditing(s); document.getElementById("builder")?.scrollIntoView({ block: "start" }); }}><Pencil aria-hidden className="size-4" /> Edit</Button>
                        <Button size="sm" variant="secondary" onClick={() => act(store.duplicate(s.id))}><Copy aria-hidden className="size-4" /> Duplicate</Button>
                        <Button size="sm" variant="danger" onClick={() => { if (window.confirm(`Delete the scenario "${s.name}"?`)) act(store.remove(s.id)); }}><Trash2 aria-hidden className="size-4" /> Delete</Button>
                      </div>
                    </div>
                    {res && (
                      <div className="mt-3 text-sm"><p className="text-xs font-semibold uppercase tracking-wide text-forest-800">Changed from Base Case</p>
                        <ul className="mt-1 space-y-0.5">{res.changes.map((c) => <li key={c.variableId}>{c.label}: <span className="text-slate-700">{f.text(c.fromText)}</span> → <span className="font-semibold">{f.text(c.toText)}</span></li>)}</ul>
                        {res.status !== "ok" && <ul className="mt-2 list-disc pl-5 text-red-900">{res.errors.map((e) => <li key={e}>{f.text(e)}</li>)}</ul>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      {!("status" in comparison) && (
        <Card>
          <CardHeader title="Comparison with the Base Case" description="Each column is a full calculation by the same engine. Differences from the Base Case are marked." />
          <CardBody className="space-y-4">
            <div role="radiogroup" aria-label="Alternative to compare" className="flex flex-wrap gap-2">
              {(["bev", "biofuel"] as const).map((t) => (
                <label key={t} className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-semibold focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-forest-500 ${tech === t ? "border-forest-600 bg-forest-50 text-forest-900" : "border-line text-navy-700"}`}>
                  <input type="radio" name="cmp-tech" value={t} checked={tech === t} onChange={() => setTech(t)} className="sr-only" />{TECH_LABEL[t]} vs diesel
                </label>
              ))}
            </div>
            <Comparison comparison={comparison} tech={tech} f={f} />
            {comparison.truncated > 0 && <p className="text-xs text-amber-900">{comparison.truncated} scenario(s) beyond the limit of {comparison.maxScenarios} are not shown.</p>}
            <p className="text-xs text-slate-700">{comparison.note}</p>
            <p className="text-xs text-slate-600">Policy v{comparison.policyVersion}. Scenarios you create are marked USER-CREATED. None is a market forecast.</p>
          </CardBody>
        </Card>
      )}
      <Disclaimer />
    </div>
  );
}

export function ScenarioWorkspace() {
  const state = useBaseInput();
  return <BaseGate state={state}>{(s) => <Workspace input={s.input} f={s.f} />}</BaseGate>;
}
