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

export const hasValue = <T>(f: FieldValue<T>): f is { status: "value"; value: T } => f.status === "value";

/** The entered value, or undefined when missing/not applicable. Never use truthiness on the result. */
export const valueOrUndefined = <T>(f: FieldValue<T>): T | undefined => (f.status === "value" ? f.value : undefined);

export function fieldsEqual(a: NumericField, b: NumericField): boolean {
  return a.status === b.status && (a.status !== "value" || (b.status === "value" && a.value === b.value));
}

/** Parses raw text from an <input>. Empty text means missing; anything non-numeric stays invalid. */
export function parseNumericInput(raw: string): NumericField | { status: "invalid"; raw: string } {
  const text = raw.trim();
  if (text === "") return missing();
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(text)) return { status: "invalid", raw };
  const n = Number(text);
  return Number.isFinite(n) ? value(n) : { status: "invalid", raw };
}
