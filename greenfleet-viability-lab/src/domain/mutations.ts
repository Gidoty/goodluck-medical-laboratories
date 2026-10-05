import { cleanFloat } from "@/lib/format";
import { convertUnit } from "@/lib/units";
import { blankValue } from "./blank";
import { missing, value, type NumericField } from "./fieldValue";
import { createReader, qualifierOptions, resolveUnit, CURRENCY_FIELD } from "./reader";
import { FIELD_BY_ID } from "./schema/fields";
import { isQNumber } from "./shapes";
import type { Assessment, ProvenanceEntry, StoredValue } from "./stored";
import type { CurrencyCode } from "@/lib/currency";

/** Pure state transitions. Each returns a new Assessment and never mutates its input. */

function withInputs(a: Assessment, changed: Record<string, StoredValue>, nowIso: string): Assessment {
  const illustrative = a.illustrative.filter((id) => !(id in changed));
  return {
    ...a,
    inputs: { ...a.inputs, ...changed },
    illustrative,
    origin: illustrative.length > 0 ? "demo" : "user",
    updatedAt: nowIso,
  };
}

export function setInput(a: Assessment, id: string, next: StoredValue, nowIso: string): Assessment {
  const def = FIELD_BY_ID[id];
  if (!def) throw new Error(`Unknown field id "${id}"`);
  const changed: Record<string, StoredValue> = { [id]: next };
  if (def.kind === "choice" && def.resetsOnChange && JSON.stringify(a.inputs[id]) !== JSON.stringify(next)) {
    for (const dependent of def.resetsOnChange) {
      const d = FIELD_BY_ID[dependent];
      if (d) changed[dependent] = blankValue(d);
    }
  }
  return withInputs(a, changed, nowIso);
}

export const setChoice = (a: Assessment, id: string, option: string | null, nowIso: string): Assessment =>
  setInput(a, id, option === null ? missing<string>() : value<string>(option), nowIso);

export const setCurrency = (a: Assessment, code: CurrencyCode, nowIso: string): Assessment => setChoice(a, CURRENCY_FIELD, code, nowIso);

/**
 * Changes the number and/or the unit of a qnumber field. When only the unit changes, an entered
 * number is converted where that is exact (km/litre <-> litres/100 km, kg <-> tonnes) and cleared
 * where it is not (amount <-> percentage), so the stored number never silently changes meaning.
 */
export function setQNumber(a: Assessment, id: string, patch: { value?: NumericField; qualifier?: string }, nowIso: string): Assessment {
  const def = FIELD_BY_ID[id];
  if (!def || def.kind !== "qnumber") throw new Error(`"${id}" is not a qnumber field`);
  const reader = createReader(a);
  const current = reader.q(id);
  let nextValue = patch.value ?? current.value;
  const nextQualifier = patch.qualifier ?? current.qualifier;

  if (patch.qualifier !== undefined && patch.qualifier !== current.qualifier && patch.value === undefined && current.value.status === "value") {
    const options = qualifierOptions(def, reader);
    const from = options.find((o) => o.id === current.qualifier);
    const to = options.find((o) => o.id === patch.qualifier);
    try {
      if (!from || !to) throw new Error("unknown qualifier");
      nextValue = value(cleanFloat(convertUnit(current.value.value, resolveUnit(from.unit, reader), resolveUnit(to.unit, reader))));
    } catch {
      nextValue = missing();
    }
  }
  const stored = { value: nextValue, qualifier: nextQualifier };
  return setInput(a, id, stored, nowIso);
}

export function setProvenance(a: Assessment, id: string, patch: Partial<ProvenanceEntry>, nowIso: string): Assessment {
  const def = FIELD_BY_ID[id];
  if (!def?.provenance) throw new Error(`"${id}" does not take provenance`);
  const current: ProvenanceEntry = a.provenance[id] ?? { source: null, reference: "", year: missing() };
  return { ...a, provenance: { ...a.provenance, [id]: { ...current, ...patch } }, origin: a.origin === "blank" ? "user" : a.origin, updatedAt: nowIso };
}

/** Isolated so the UI and tests share one definition of "this assessment holds user data". */
export function isUntouched(a: Assessment): boolean {
  if (a.origin === "demo") return false;
  return Object.keys(a.provenance).length === 0 && Object.entries(a.inputs).every(([id, v]) => {
    const def = FIELD_BY_ID[id];
    if (!def) return true;
    const b = blankValue(def);
    return JSON.stringify(v) === JSON.stringify(b) || (isQNumber(v) && isQNumber(b) && v.value.status === "missing");
  });
}
