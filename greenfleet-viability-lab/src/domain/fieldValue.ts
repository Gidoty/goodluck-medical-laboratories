/**
 * A user-supplied input is exactly one of three things. Keeping them as distinct states means
 * 0 is never confused with "not entered" or "does not apply".
 *
 *   value          the user entered something (including 0)
 *   missing        the user has not entered anything yet
 *   not_applicable the user states this input does not apply to their case
 */
export type FieldValue<T> =
  | { readonly status: "value"; readonly value: T }
  | { readonly status: "missing" }
  | { readonly status: "not_applicable" };

export type NumericField = FieldValue<number>;

export const missing = <T = number>(): FieldValue<T> => ({ status: "missing" });
export const notApplicable = <T = number>(): FieldValue<T> => ({ status: "not_applicable" });
export const value = <T = number>(v: T): FieldValue<T> => ({ status: "value", value: v });

/** Parses raw text from an <input>. Empty text means missing; anything non-numeric stays invalid. */
export function parseNumericInput(raw: string): NumericField | { status: "invalid"; raw: string } {
  const text = raw.trim();
  if (text === "") return missing();
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(text)) return { status: "invalid", raw };
  const n = Number(text);
  return Number.isFinite(n) ? value(n) : { status: "invalid", raw };
}
