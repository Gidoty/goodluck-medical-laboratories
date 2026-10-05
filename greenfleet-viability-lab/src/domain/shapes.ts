import type { NumericField } from "./fieldValue";
import type { ChoiceValue, QNumberValue } from "./stored";

/** Runtime shape guards. Persisted data is untrusted, so every stored value is checked before use. */
export function isNumericField(x: unknown): x is NumericField {
  if (x === null || typeof x !== "object") return false;
  const o = x as { status?: unknown; value?: unknown };
  if (o.status === "missing" || o.status === "not_applicable") return true;
  return o.status === "value" && typeof o.value === "number" && Number.isFinite(o.value);
}

export function isChoiceValue(x: unknown): x is ChoiceValue {
  if (x === null || typeof x !== "object") return false;
  const o = x as { status?: unknown; value?: unknown };
  if (o.status === "missing" || o.status === "not_applicable") return true;
  return o.status === "value" && typeof o.value === "string";
}

export function isQNumber(x: unknown): x is QNumberValue {
  if (x === null || typeof x !== "object") return false;
  const o = x as { value?: unknown; qualifier?: unknown };
  return isNumericField(o.value) && typeof o.qualifier === "string";
}
