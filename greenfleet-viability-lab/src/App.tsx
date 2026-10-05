import { useState } from "react";
import { CURRENCIES, defaultInputs, type RawInputs } from "./engine/fields";
import { Dashboard } from "./ui/Dashboard";
import { makeFmt } from "./ui/format";
import { InputsPanel } from "./ui/InputsPanel";
import { MethodologyPanel } from "./ui/MethodologyPanel";
import { ScenariosPanel } from "./ui/ScenariosPanel";
import { SensitivityPanel } from "./ui/SensitivityPanel";
import { useAppState } from "./ui/state";

type Tab = "inputs" | "results" | "sensitivity" | "scenarios" | "method";
const TABS: [Tab, string][] = [["inputs", "Inputs"], ["results", "Results"], ["sensitivity", "Sensitivity"], ["scenarios", "Scenarios"], ["method", "Methodology and assumptions"]];

const PRESETS: { name: string; note: string; overrides: Partial<RawInputs> }[] = [
  { name: "diesel clearly cheaper", note: "Cheap diesel, expensive electricity. Shows the app reporting that diesel wins.", overrides: { dieselPrice: 500, electricityPrice: 350, dPrice: 38_000_000 } },
  { name: "favourable electric case", note: "High diesel price, low tariff, long daily distance.", overrides: { dieselPrice: 1800, electricityPrice: 60, dailyDistanceKm: 150, bPrice: 55_000_000, bBatteryKwh: 120 } },
];

export function App() {
  const s = useAppState();
  const [tab, setTab] = useState<Tab>("inputs");
  const f = makeFmt(s.currency);
  const { validation, evaluation, decisions } = s.analysis;
  const errors = validation.issues.filter((i) => i.severity === "error");

  return (
    <div className="app">
      <header>
        <div>
          <h1>GreenFleet Viability Lab</h1>
          <p className="sub">Diesel, battery-electric and biofuel compared on cost, cash flow and risk. Academic proof of concept (CELTRAS, University of Port Harcourt).</p>
        </div>
        <label className="cur">Currency
          <select value={s.currency.code} onChange={(e) => s.setCurrencyCode(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
          </select>
        </label>
      </header>
      <nav role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "tab active" : "tab"} onClick={() => setTab(id)}>
            {label}{id === "inputs" && errors.length > 0 && <span className="count">{errors.length}</span>}
          </button>
        ))}
      </nav>
      <main>
        {tab === "inputs" && (
          <InputsPanel
            inputs={s.inputs}
            setInputs={s.setInputs}
            currency={s.currency}
            issues={validation.issues}
            onReset={() => s.setInputs(defaultInputs())}
            presets={PRESETS}
            onPreset={(o) => s.setInputs({ ...defaultInputs(), ...o })}
          />
        )}
        {tab === "method" && <MethodologyPanel currency={s.currency} inputs={s.inputs} />}
        {tab === "scenarios" && (
          <ScenariosPanel
            scenarios={s.scenarios}
            setScenarios={s.setScenarios}
            inputs={s.inputs}
            currencyCode={s.currency.code}
            onLoad={(sc) => { s.setInputs(sc.inputs); s.setCurrencyCode(sc.currency); setTab("inputs"); }}
          />
        )}
        {(tab === "results" || tab === "sensitivity") && (!evaluation || !decisions) && (
          <div className="card">
            <h2>Results are not available</h2>
            <p>Fix these input problems first:</p>
            <ul>{errors.map((e, i) => <li key={i} className="err">{e.message}</li>)}</ul>
            <button onClick={() => setTab("inputs")}>Go to inputs</button>
          </div>
        )}
        {tab === "results" && evaluation && decisions && validation.ok && <Dashboard ev={evaluation} decisions={decisions} p={validation.resolved.params} f={f} />}
        {tab === "sensitivity" && evaluation && decisions && validation.ok && <SensitivityPanel p={validation.resolved.params} ev={evaluation} decisions={decisions} f={f} />}
      </main>
      <footer>
        Illustrative academic prototype. Not financial, engineering or investment advice. Defaults are placeholders, not current market data.
      </footer>
    </div>
  );
}
