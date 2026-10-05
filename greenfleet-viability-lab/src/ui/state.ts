import { useEffect, useMemo, useState } from "react";
import { decide, type Decision } from "../engine/decision";
import { evaluate, ALTS, type Alt, type Evaluation } from "../engine/evaluate";
import { CURRENCIES, defaultInputs, type Currency, type RawInputs } from "../engine/fields";
import { validate, type ValidationResult } from "../engine/validate";

export interface Scenario { name: string; currency: string; inputs: RawInputs }

const KEY = "greenfleet-viability-lab/v1";

interface Saved { currency: string; inputs: RawInputs; scenarios: Scenario[] }

function load(): Saved {
  const fallback: Saved = { currency: "NGN", inputs: defaultInputs(), scenarios: [] };
  try {
    const s = localStorage.getItem(KEY);
    if (!s) return fallback;
    const parsed = JSON.parse(s) as Saved;
    // merge with defaults so newly added fields are never undefined
    return { ...fallback, ...parsed, inputs: { ...defaultInputs(), ...parsed.inputs } };
  } catch {
    return fallback;
  }
}

export interface Analysis {
  validation: ValidationResult;
  evaluation: Evaluation | null;
  decisions: Record<Alt, Decision> | null;
}

export function analyse(inputs: RawInputs): Analysis {
  const validation = validate(inputs);
  if (!validation.ok) return { validation, evaluation: null, decisions: null };
  const params = validation.resolved.params;
  const evaluation = evaluate(params);
  const decisions = Object.fromEntries(ALTS.map((a) => [a, decide(params, a, evaluation)])) as Record<Alt, Decision>;
  return { validation, evaluation, decisions };
}

export function useAppState() {
  const [saved] = useState(load);
  const [currencyCode, setCurrencyCode] = useState(saved.currency);
  const [inputs, setInputs] = useState<RawInputs>(saved.inputs);
  const [scenarios, setScenarios] = useState<Scenario[]>(saved.scenarios);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ currency: currencyCode, inputs, scenarios } satisfies Saved));
    } catch {
      /* storage unavailable: the app still works, it just does not remember */
    }
  }, [currencyCode, inputs, scenarios]);

  const currency: Currency = CURRENCIES.find((c) => c.code === currencyCode) ?? CURRENCIES[0];
  const analysis = useMemo(() => analyse(inputs), [inputs]);

  return { currency, setCurrencyCode, inputs, setInputs, scenarios, setScenarios, analysis };
}
