import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Decision } from "../engine/decision";
import { ALTS, type Alt, type Evaluation } from "../engine/evaluate";
import type { Params } from "../engine/fields";
import { SENS_BY_ID, SENS_VARS, tornado, twoWay } from "../engine/sensitivity";
import type { Fmt } from "./format";
import { ALT_NAME } from "./narrative";

export function SensitivityPanel({ p, ev, decisions, f }: { p: Params; ev: Evaluation; decisions: Record<Alt, Decision>; f: Fmt }) {
  const [alt, setAlt] = useState<Alt>("bev");
  const relVars = SENS_VARS.filter((v) => v.mode === "relative" && v.appliesTo.includes(alt));
  const [xId, setXId] = useState("dieselPrice");
  const [yId, setYId] = useState("electricityPrice");
  const xOk = relVars.some((v) => v.id === xId) ? xId : relVars[0].id;
  const yDefault = alt === "bev" ? "electricityPrice" : "biofuelPrice";
  const yOk = relVars.some((v) => v.id === yId) && yId !== xOk ? yId : relVars.find((v) => v.id === yDefault && v.id !== xOk)?.id ?? relVars.find((v) => v.id !== xOk)!.id;

  const base = ev.incr[alt].npv;
  const rows = tornado(p, alt);
  const chart = rows.map((r) => ({ name: r.label, low: r.npvLow - base, high: r.npvHigh - base }));
  const steps = [-0.4, -0.2, 0, 0.2, 0.4];
  const grid = twoWay(p, alt, xOk, yOk, steps);
  const unit = (id: string) => SENS_BY_ID[id].unit.replace("{cur}", f.currency.symbol);
  const maxAbs = Math.max(1, ...grid.npv.flat().map(Math.abs));
  const d = decisions[alt];

  return (
    <div className="stack">
      <section className="card">
        <div className="row gap wrap between">
          <h2>Sensitivity analysis</h2>
          <div className="row gap">
            {ALTS.map((a) => (
              <button key={a} className={a === alt ? "" : "secondary"} onClick={() => setAlt(a)}>{ALT_NAME[a]}</button>
            ))}
          </div>
        </div>
        <p className="muted">
          All figures are NPV of {ALT_NAME[alt]} against diesel (positive favours the alternative). Base NPV: <strong>{f.money(base)}</strong>.
          Each variable moves by ±{f.num(p.stressPct, 0)}% (rates by ±{f.num(p.stressRatePp, 0)} percentage points), one at a time.
        </p>
        <h3>One-way sensitivity (change in NPV from base)</h3>
        <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 44 + 60)}>
          <BarChart data={chart} layout="vertical" margin={{ left: 130 }} stackOffset="sign">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickFormatter={(v: number) => f.compact(v)} />
            <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => f.money(Number(v))} />
            <Legend />
            <ReferenceLine x={0} stroke="#111827" />
            <Bar dataKey="low" name="Variable decreases" fill="#64748b" stackId="s" />
            <Bar dataKey="high" name="Variable increases" fill="#0f766e" stackId="s" />
          </BarChart>
        </ResponsiveContainer>
        <div className="scroll">
          <table>
            <thead><tr><th>Variable</th><th className="num">Low value</th><th className="num">High value</th><th className="num">NPV at low</th><th className="num">NPV at high</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row">{r.label}</th>
                  <td className="num">{f.num(r.lowValue, 2)} {unit(r.id)}</td>
                  <td className="num">{f.num(r.highValue, 2)} {unit(r.id)}</td>
                  <td className={"num " + (r.npvLow < 0 ? "neg" : "pos")}>{f.money(r.npvLow)}</td>
                  <td className={"num " + (r.npvHigh < 0 ? "neg" : "pos")}>{f.money(r.npvHigh)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h3>Adverse stress tests used by the robustness rule</h3>
        <table>
          <thead><tr><th>Stress</th><th>Change</th><th className="num">NPV</th><th>NPV above zero?</th></tr></thead>
          <tbody>
            {d.stress.map((s) => (
              <tr key={s.id}>
                <th scope="row">{s.label}</th><td>{s.changeText}</td>
                <td className={"num " + (s.npv < 0 ? "neg" : "pos")}>{f.money(s.npv)}</td>
                <td><span className={s.positive ? "pass" : "fail"}>{s.positive ? "YES" : "NO"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h3>Two-way sensitivity</h3>
        <div className="row gap wrap">
          <label>Columns <select value={xOk} onChange={(e) => setXId(e.target.value)}>{relVars.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
          <label>Rows <select value={yOk} onChange={(e) => setYId(e.target.value)}>{relVars.filter((v) => v.id !== xOk).map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
        </div>
        <div className="scroll">
          <table className="heat">
            <thead>
              <tr>
                <th>{SENS_BY_ID[yOk].label} ↓ / {SENS_BY_ID[xOk].label} →</th>
                {grid.xValues.map((v, i) => <th key={i} className="num">{f.num(v, 2)} {unit(xOk)}<div className="help">{steps[i] > 0 ? "+" : ""}{steps[i] * 100}%</div></th>)}
              </tr>
            </thead>
            <tbody>
              {grid.npv.map((row, r) => (
                <tr key={r}>
                  <th scope="row">{f.num(grid.yValues[r], 2)} {unit(yOk)}<div className="help">{steps[r] > 0 ? "+" : ""}{steps[r] * 100}%</div></th>
                  {row.map((v, c) => (
                    <td key={c} className="num" style={{ background: v >= 0 ? `rgba(15,118,110,${0.1 + 0.5 * (v / maxAbs)})` : `rgba(185,28,28,${0.1 + 0.5 * (-v / maxAbs)})` }}>
                      {f.compact(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">Green cells favour the alternative (NPV above zero). Red cells favour diesel.</p>
      </section>
    </div>
  );
}
