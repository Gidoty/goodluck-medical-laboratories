import { FIELDS, GROUP_LABEL, NA, unitLabel, type Currency, type FieldId, type Group, type Raw, type RawInputs } from "../engine/fields";
import type { Issue } from "../engine/validate";

interface Props {
  inputs: RawInputs;
  setInputs: (f: (prev: RawInputs) => RawInputs) => void;
  currency: Currency;
  issues: Issue[];
  onReset: () => void;
  presets: { name: string; note: string; overrides: Partial<RawInputs> }[];
  onPreset: (overrides: Partial<RawInputs>) => void;
}

const GROUPS = Object.keys(GROUP_LABEL) as Group[];

export function InputsPanel({ inputs, setInputs, currency, issues, onReset, presets, onPreset }: Props) {
  const set = (id: FieldId, v: Raw) => setInputs((prev) => ({ ...prev, [id]: v }));
  return (
    <div>
      <div className="notice">
        Every default below is an <strong>illustrative placeholder</strong>, not market data. Replace each with your own quotes, tariffs and
        records. Changing the currency relabels the units but does not convert any value.
      </div>
      <div className="row gap wrap" style={{ margin: "12px 0" }}>
        <button onClick={onReset}>Reset to illustrative defaults</button>
        {presets.map((p) => (
          <button key={p.name} className="secondary" title={p.note} onClick={() => onPreset(p.overrides)}>
            Example: {p.name}
          </button>
        ))}
      </div>
      {GROUPS.map((g) => (
        <fieldset key={g}>
          <legend>{GROUP_LABEL[g]}</legend>
          <div className="grid">
            {FIELDS.filter((f) => f.group === g).map((f) => {
              const v = inputs[f.id];
              const isNA = v === NA;
              const errs = issues.filter((i) => i.field === f.id);
              const isDefault = v === f.default;
              return (
                <div key={f.id} className={"field" + (errs.some((e) => e.severity === "error") ? " has-error" : "")}>
                  <label htmlFor={f.id}>{f.label}</label>
                  <div className="row">
                    <input
                      id={f.id}
                      type="number"
                      inputMode="decimal"
                      step="any"
                      disabled={isNA}
                      value={typeof v === "number" ? v : ""}
                      placeholder={isNA ? "N/A" : "required"}
                      aria-invalid={errs.some((e) => e.severity === "error")}
                      onChange={(e) => set(f.id, e.target.value === "" ? null : Number(e.target.value))}
                    />
                    <span className="unit">{unitLabel(f, currency)}</span>
                  </div>
                  <div className="row gap small">
                    {f.allowNA && (
                      <label className="check">
                        <input type="checkbox" checked={isNA} onChange={(e) => set(f.id, e.target.checked ? NA : null)} /> not applicable
                      </label>
                    )}
                    <span className={"tag " + (isDefault ? "tag-default" : "tag-user")}>{isDefault ? "illustrative default" : "your value"}</span>
                  </div>
                  {f.help && <div className="help">{f.help}</div>}
                  {errs.map((e, i) => (
                    <div key={i} className={e.severity === "error" ? "err" : "warn"}>{e.message}</div>
                  ))}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
