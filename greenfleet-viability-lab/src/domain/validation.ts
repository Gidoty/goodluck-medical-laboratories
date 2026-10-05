import { isCurrencyCode, type CurrencyCode } from "@/lib/currency";
import { formatNumber } from "@/lib/format";
import { unitLabel, type UnitId } from "@/lib/units";
import type { NumericField } from "./fieldValue";

export type IssueCode =
  | "missing"
  | "not_applicable_not_allowed"
  | "not_a_number"
  | "below_min"
  | "above_max"
  | "not_integer"
  | "invalid_currency"
  | "implausible";

export interface ValidationIssue {
  fieldId: string;
  code: IssueCode;
  /** Errors block progress to calculation; warnings are advisory plausibility checks. */
  severity: "error" | "warning";
  message: string;
}

export interface NumericRule {
  label: string;
  unit: UnitId;
  required: boolean;
  allowNotApplicable?: boolean;
  min?: number;
  max?: number;
  /** If true the value must be strictly greater than `min` (e.g. a lifetime of 0 is impossible). */
  minExclusive?: boolean;
  integer?: boolean;
  /** Plausibility range: outside it the value is allowed but flagged for a units check. */
  plausibleMax?: number;
}

/**
 * Validates one numeric input. Every branch tests `status`, never truthiness, so 0 is a real value.
 */
export function validateNumeric(
  fieldId: string,
  field: NumericField,
  rule: NumericRule,
  currency: CurrencyCode,
): ValidationIssue[] {
  const unit = unitLabel(rule.unit, currency);
  const issue = (code: IssueCode, message: string, severity: "error" | "warning" = "error"): ValidationIssue[] => [
    { fieldId, code, severity, message },
  ];

  if (field.status === "not_applicable") {
    return rule.allowNotApplicable
      ? []
      : issue("not_applicable_not_allowed", `${rule.label} cannot be marked not applicable. Enter a value, or 0 if it truly is zero.`);
  }
  if (field.status === "missing") {
    if (!rule.required) return [];
    const zeroIsValid = (rule.min === undefined || rule.min < 0 || (rule.min === 0 && !rule.minExclusive)) && (rule.max === undefined || rule.max >= 0);
    return issue("missing", `${rule.label} is required (${unit}).${zeroIsValid ? " Enter 0 if the value is genuinely zero." : ""}`);
  }

  const v = field.value;
  if (typeof v !== "number" || !Number.isFinite(v)) return issue("not_a_number", `${rule.label} must be a number.`);
  if (rule.integer && !Number.isInteger(v)) return issue("not_integer", `${rule.label} must be a whole number (${unit}).`);
  if (rule.min !== undefined) {
    const bad = rule.minExclusive ? v <= rule.min : v < rule.min;
    if (bad) {
      const bound = formatNumber(rule.min, 4);
      return issue(
        "below_min",
        rule.minExclusive
          ? `${rule.label} must be greater than ${bound} ${unit}.`
          : rule.min === 0
            ? `${rule.label} cannot be negative.`
            : `${rule.label} must be at least ${bound} ${unit}.`,
      );
    }
  }
  if (rule.max !== undefined && v > rule.max) {
    return issue("above_max", `${rule.label} cannot exceed ${formatNumber(rule.max, 4)} ${unit}.`);
  }
  if (rule.plausibleMax !== undefined && v > rule.plausibleMax) {
    return issue(
      "implausible",
      `${rule.label} of ${formatNumber(v, 4)} ${unit} is unusually high. Check the unit before relying on the result.`,
      "warning",
    );
  }
  return [];
}

export function validateCurrency(fieldId: string, code: unknown): ValidationIssue[] {
  return isCurrencyCode(code)
    ? []
    : [{ fieldId, code: "invalid_currency", severity: "error", message: "Choose a supported currency." }];
}

/** Rule presets for the recurring kinds of input. Each returns a fresh rule so callers can extend it. */
export const rules = {
  /** Costs and prices: zero is allowed (e.g. free infrastructure), negative is not. */
  money: (label: string, unit: UnitId = "money", required = true): NumericRule => ({ label, unit, required, min: 0 }),
  distance: (label: string, unit: UnitId): NumericRule => ({ label, unit, required: true, min: 0, minExclusive: true }),
  /** Whole years that must be at least 1: a zero-year lifetime is impossible. */
  lifetimeYears: (label: string): NumericRule => ({ label, unit: "years", required: true, min: 0, minExclusive: true, integer: true, max: 50 }),
  percentage: (label: string, required = true): NumericRule => ({ label, unit: "percent", required, min: 0, max: 100 }),
  /** Share that must be above zero, e.g. battery usable share. */
  positivePercentage: (label: string): NumericRule => ({ label, unit: "percent", required: true, min: 0, minExclusive: true, max: 100 }),
  efficiency: (label: string, unit: UnitId, plausibleMax: number): NumericRule => ({
    label,
    unit,
    required: true,
    min: 0,
    minExclusive: true,
    plausibleMax,
  }),
  count: (label: string, required = true): NumericRule => ({ label, unit: "vehicles", required, min: 1, integer: true }),
} as const;
