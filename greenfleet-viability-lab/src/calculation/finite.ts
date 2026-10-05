/**
 * Computational-safety helpers (Batch 8). They add no methodology: they only stop arithmetic that has
 * overflowed double precision from being shown to a person as Infinity or NaN.
 */

/** Path of the first number in `value` that is not finite, or null when every number is finite. */
export function firstNonFinite(value: unknown, path = "result"): string | null {
  if (typeof value === "number") return Number.isFinite(value) ? null : path;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const found = firstNonFinite(value[i], `${path}[${i}]`);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      const found = firstNonFinite(v, `${path}.${k}`);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Upper limit on vehicle replacement events inside one analysis period. A realistic life gives at most 49
 * (1 year over 50 years). The limit exists so that a vanishing useful life (for example 0.000000001 years)
 * cannot make the schedule loops run for billions of iterations and freeze the browser.
 */
export const MAX_REPLACEMENT_EVENTS = 1_000;
