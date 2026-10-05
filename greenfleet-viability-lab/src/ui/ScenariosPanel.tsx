import { useState } from "react";
import { ALTS } from "../engine/evaluate";
import { CURRENCIES, type RawInputs } from "../engine/fields";
import { ALT_NAME } from "./narrative";
import { makeFmt } from "./format";
import { analyse, type Scenario } from "./state";

interface Props {
  scenarios: Scenario[];
  setScenarios: (f: (p: Scenario[]) => Scenario[]) => void;
  inputs: RawInputs;
  currencyCode: string;
  onLoad: (s: Scenario) => void;
}

export function ScenariosPanel({ scenarios, setScenarios, inputs, currencyCode, onLoad }: Props) {
  const [name, setName] = useState("");
  const current: Scenario = { name: "Current inputs", currency: currencyCode, inputs };
  const all = [current, ...scenarios];

  return (
    <div className="stack">
      <section className="card">
        <h2>Scenarios</h2>
        <p className="muted">Save the current inputs under a name, change them, and compare the results side by side. Scenarios are stored only in this browser.</p>
        <form
          className="row gap"
          onSubmit={(e) => {
            e.preventDefault();
            const n = name.trim();
            if (!n) return;
            setScenarios((prev) => [...prev.filter((s) => s.name !== n), { name: n, currency: currencyCode, inputs: { ...inputs } }]);
            setName("");
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Scenario name, e.g. Diesel +30%" aria-label="Scenario name" />
          <button type="submit">Save current inputs</button>
        </form>
      </section>
      <section className="card">
        <h3>Comparison</h3>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Scenario</th><th>Lowest TCO</th>
                {ALTS.map((a) => <th key={a}>{ALT_NAME[a]}</th>)}
                <th />
              </tr>
            </thead>
            <tbody>
              {all.map((s, i) => {
                const a = analyse(s.inputs);
                const f = makeFmt(CURRENCIES.find((c) => c.code === s.currency) ?? CURRENCIES[0]);
                if (!a.evaluation || !a.decisions) return <tr key={s.name + i}><th scope="row">{s.name}</th><td colSpan={3} className="fail">Inputs are invalid</td><td /></tr>;
                return (
                  <tr key={s.name + i}>
                    <th scope="row">{s.name}</th>
                    <td>{a.evaluation.lowestTco}</td>
                    {ALTS.map((alt) => (
                      <td key={alt}>
                        <strong>{a.decisions![alt].classification}</strong>
                        <div className="help">NPV {f.money(a.evaluation!.incr[alt].npv)}; payback {f.years(a.evaluation!.incr[alt].paybackYears)}</div>
                      </td>
                    ))}
                    <td className="row gap">
                      {i > 0 && <button className="secondary" onClick={() => onLoad(s)}>Load</button>}
                      {i > 0 && <button className="secondary" onClick={() => setScenarios((prev) => prev.filter((x) => x !== s))}>Delete</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
