import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Classification, Decision } from "../engine/decision";
import { ALTS, type Alt, type Evaluation } from "../engine/evaluate";
import { TECHS, TECH_LABEL, type Params, type Tech } from "../engine/fields";
import type { Fmt } from "./format";
import { ALT_NAME, narrate } from "./narrative";

export const TECH_COLOR: Record<Tech, string> = { diesel: "#6b7280", bev: "#0f766e", biofuel: "#b45309" };

const BADGE: Record<Classification, string> = {
  VIABLE: "badge-viable",
  "CONDITIONALLY VIABLE": "badge-conditional",
  "NOT YET VIABLE": "badge-not",
};

const BREAKDOWN_KEYS = [
  ["acquisition", "Vehicle", "#334155"],
  ["infrastructure", "Infrastructure", "#7c3aed"],
  ["energy", "Energy", "#0f766e"],
  ["maintenance", "Maintenance and fixed", "#b45309"],
  ["batteryReplacement", "Battery replacement", "#be185d"],
  ["financingInterest", "Interest", "#dc2626"],
  ["residualCredit", "Residual value (credit)", "#94a3b8"],
] as const;

export function Dashboard({ ev, decisions, p, f }: { ev: Evaluation; decisions: Record<Alt, Decision>; p: Params; f: Fmt }) {
  const H = p.horizonYears;
  const R = ev.results;

  const tcoData = TECHS.map((t) => ({ name: TECH_LABEL[t], ...R[t].breakdown }));
  const cumData = Array.from({ length: H + 1 }, (_, y) => ({
    year: y,
    bev: Math.round(ev.incr.bev.cumulative[y]),
    biofuel: Math.round(ev.incr.biofuel.cumulative[y]),
  }));
  const simple = TECHS.map((t) => ({ name: TECH_LABEL[t], tech: t, costPerKm: R[t].costPerKm, emissions: R[t].emissionsGPerKm }));

  return (
    <div className="stack">
      <section className="card">
        <h2>Result at a glance</h2>
        <p className="lead">
          Lowest total cost of ownership over {H} years: <strong>{TECH_LABEL[ev.lowestTco]}</strong> ({f.money(R[ev.lowestTco].tco)}).
          {ev.lowestPvTco !== ev.lowestTco && <> On a present-value basis the lowest cost is <strong>{TECH_LABEL[ev.lowestPvTco]}</strong>.</>}
        </p>
        <p className="muted">
          The classification below depends on the numbers you entered, including illustrative defaults. Lower emissions never raise a
          classification; commercial and environmental results are reported separately.
        </p>
        <div className="cards3">
          {ALTS.map((a) => (
            <div className="kpi" key={a}>
              <div className="kpi-title">{ALT_NAME[a]}</div>
              <span className={"badge " + BADGE[decisions[a].classification]}>{decisions[a].classification}</span>
              <dl>
                <dt>NPV versus diesel</dt><dd className={ev.incr[a].npv < 0 ? "neg" : "pos"}>{f.money(ev.incr[a].npv)}</dd>
                <dt>Payback</dt><dd>{f.years(ev.incr[a].paybackYears)}</dd>
                <dt>Emissions versus diesel</dt><dd>{ev.incr[a].emissionsReductionPct >= 0 ? "-" : "+"}{f.pct(Math.abs(ev.incr[a].emissionsReductionPct))}</dd>
              </dl>
            </div>
          ))}
          <div className="kpi">
            <div className="kpi-title">Diesel (baseline)</div>
            <span className="badge badge-base">BASELINE</span>
            <dl>
              <dt>Total cost of ownership</dt><dd>{f.money(R.diesel.tco)}</dd>
              <dt>Cost per km</dt><dd>{f.perUnit(R.diesel.costPerKm)}</dd>
              <dt>Emissions</dt><dd>{f.num(R.diesel.totalEmissionsKg / 1000)} t CO2e</dd>
            </dl>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Comparison table</h2>
        <div className="scroll">
          <table>
            <thead>
              <tr><th>Metric</th>{TECHS.map((t) => <th key={t} className="num">{TECH_LABEL[t]}</th>)}</tr>
            </thead>
            <tbody>
              <Row label="Year-1 energy cost" vals={TECHS.map((t) => f.money(R[t].annualEnergyCostYear1))} />
              <Row label="Year-1 operating cost (energy + maintenance + fixed)" vals={TECHS.map((t) => f.money(R[t].annualOperatingCostYear1))} />
              <Row label={`Total cost of ownership (${H} yr, nominal)`} vals={TECHS.map((t) => f.money(R[t].tco))} strong best={ev.lowestTco} />
              <Row label="Total cost of ownership (present value)" vals={TECHS.map((t) => f.money(R[t].pvTco))} best={ev.lowestPvTco} />
              <Row label="Cost per km" vals={TECHS.map((t) => f.perUnit(R[t].costPerKm))} />
              <Row label="Levelised cost per km (discounted)" vals={TECHS.map((t) => f.perUnit(R[t].levelisedCostPerKm))} />
              <Row label="Cost per tonne-km" vals={TECHS.map((t) => (R[t].costPerTonneKm === null ? "n/a" : f.perUnit(R[t].costPerTonneKm!)))} />
              <Row label="Year-1 operating saving versus diesel" vals={["baseline", ...ALTS.map((a) => f.money(ev.incr[a].annualSavingsYear1))]} />
              <Row label="Cumulative net savings versus diesel" vals={["baseline", ...ALTS.map((a) => f.money(ev.incr[a].cumulativeSavings))]} />
              <Row label="NPV versus diesel" vals={["baseline", ...ALTS.map((a) => f.money(ev.incr[a].npv))]} />
              <Row label="Payback" vals={["baseline", ...ALTS.map((a) => f.years(ev.incr[a].paybackYears))]} />
              <Row label="Discounted payback" vals={["baseline", ...ALTS.map((a) => f.years(ev.incr[a].discountedPaybackYears))]} />
              <Row label="Emissions per year (t CO2e)" vals={TECHS.map((t) => f.num(R[t].annualEmissionsKg / 1000))} />
              <Row label="Emissions (g CO2e/km)" vals={TECHS.map((t) => f.num(R[t].emissionsGPerKm, 0))} />
              <Row label="Cost per tonne CO2e avoided (PV)" vals={["baseline", ...ALTS.map((a) => (ev.incr[a].abatementCostPerTonne === null ? "no reduction" : f.money(ev.incr[a].abatementCostPerTonne!)))]} />
            </tbody>
          </table>
        </div>
      </section>

      <div className="charts">
        <section className="card">
          <h3>Total cost of ownership by component</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={tcoData} stackOffset="sign">
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v: number) => f.compact(v)} width={70} />
              <Tooltip formatter={(v) => f.money(Number(v))} />
              <Legend />
              {BREAKDOWN_KEYS.map(([k, label, color]) => (
                <Bar key={k} dataKey={k} name={label} stackId="a" fill={color} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="card">
          <h3>Cumulative net savings versus diesel</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={cumData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" label={{ value: "Year", position: "insideBottom", offset: -2 }} />
              <YAxis tickFormatter={(v: number) => f.compact(v)} width={70} />
              <Tooltip formatter={(v) => f.money(Number(v))} labelFormatter={(y) => `Year ${y}`} />
              <Legend />
              <ReferenceLine y={0} stroke="#111827" />
              <Line type="monotone" dataKey="bev" name="BEV" stroke={TECH_COLOR.bev} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="biofuel" name="Biofuel" stroke={TECH_COLOR.biofuel} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </section>
        <section className="card">
          <h3>Cost per km</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={simple}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v: number) => f.compact(v)} width={60} />
              <Tooltip formatter={(v) => f.perUnit(Number(v))} />
              <Bar dataKey="costPerKm" name="Cost per km" fill="#334155" />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="card">
          <h3>Estimated emissions (g CO2e/km)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={simple}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis width={50} />
              <Tooltip formatter={(v) => `${f.num(Number(v), 0)} g/km`} />
              <Bar dataKey="emissions" name="g CO2e/km" fill="#0f766e" />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>

      {ALTS.map((a) => (
        <DecisionDetail key={a} d={decisions[a]} ev={ev} p={p} f={f} />
      ))}
    </div>
  );
}

function Row({ label, vals, strong, best }: { label: string; vals: string[]; strong?: boolean; best?: Tech }) {
  return (
    <tr className={strong ? "strong" : ""}>
      <th scope="row">{label}</th>
      {vals.map((v, i) => (
        <td key={i} className={"num" + (best && TECHS[i] === best ? " best" : "")}>{v}{best && TECHS[i] === best ? " (lowest)" : ""}</td>
      ))}
    </tr>
  );
}

function DecisionDetail({ d, ev, p, f }: { d: Decision; ev: Evaluation; p: Params; f: Fmt }) {
  const n = narrate(d, ev, p, f);
  return (
    <section className="card">
      <div className="row gap wrap between">
        <h2>{ALT_NAME[d.alt]}: why this classification</h2>
        <span className={"badge " + BADGE[d.classification]}>{d.classification}</span>
      </div>
      <table>
        <thead><tr><th>Rule</th><th>Result</th><th className="num">Actual</th><th className="num">Threshold</th></tr></thead>
        <tbody>
          {d.rules.map((r) => (
            <tr key={r.id}>
              <th scope="row">{r.title}<div className="help">{r.note}</div></th>
              <td><span className={r.passed ? "pass" : "fail"}>{r.passed ? "PASS" : "FAIL"}</span>{r.hard && <span className="help"> (hard rule)</span>}</td>
              <td className="num">{fmtRule(r.actual, r.unit, f)}</td>
              <td className="num">{r.threshold === null ? "all checks" : fmtRule(r.threshold, r.unit, f, true)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {d.operational.length > 0 && (
        <ul className="plain">
          {d.operational.map((o) => (
            <li key={o.label}><span className={o.passed ? "pass" : "fail"}>{o.passed ? "PASS" : "FAIL"}</span> {o.label}: {f.num(o.actual)} {o.unit} versus {f.num(o.required)} {o.unit}</li>
          ))}
        </ul>
      )}
      <h3>Reading of the numbers</h3>
      <ul>{n.commercial.map((s, i) => <li key={i}>{s}</li>)}</ul>
      <p>{n.environmental}</p>
      <h3>What would need to change for NPV to reach zero</h3>
      <p className="muted">Each line changes one variable and holds the rest constant.</p>
      <ul>{n.whatMustChange.map((s, i) => <li key={i}>{s}</li>)}</ul>
    </section>
  );
}

function fmtRule(v: number | null, unit: string, f: Fmt, isThreshold = false) {
  if (v === null) return isThreshold ? "" : unit === "none" ? "see checks below" : "never";
  if (unit === "money") return f.money(v);
  if (unit === "years") return `${f.num(v)} yr`;
  if (unit === "percent") return f.pct(v, 0);
  return f.num(v);
}
