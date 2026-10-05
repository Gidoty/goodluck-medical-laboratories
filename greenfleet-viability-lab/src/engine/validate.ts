import { FIELDS, FIELD_BY_ID, NA, type FieldId, type Params, type RawInputs } from "./fields";

export interface Issue {
  field?: FieldId;
  severity: "error" | "warning";
  message: string;
}

export interface Resolved {
  params: Params;
  /** Fields the user marked "not applicable" (resolved to 0 in `params`). */
  notApplicable: FieldId[];
}

export type ValidationResult =
  | { ok: true; resolved: Resolved; issues: Issue[] }
  | { ok: false; issues: Issue[] };

/**
 * Fields that only need a value when another input says they matter.
 * Returns true when the field is required given the raw inputs.
 */
const conditionallyRequired: Partial<Record<FieldId, (r: RawInputs) => boolean>> = {
  loanTermYears: (r) => typeof r.financedSharePct === "number" && r.financedSharePct > 0,
  bInfraVehicles: (r) => typeof r.bInfraCost === "number" && r.bInfraCost > 0,
  fInfraVehicles: (r) => typeof r.fInfraCost === "number" && r.fInfraCost > 0,
  bBatteryReplYear: (r) => typeof r.bBatteryReplCost === "number" && r.bBatteryReplCost > 0,
};

export function validate(raw: RawInputs): ValidationResult {
  const issues: Issue[] = [];
  const params = {} as Params;
  const notApplicable: FieldId[] = [];

  for (const f of FIELDS) {
    const v = raw[f.id];
    const condReq = conditionallyRequired[f.id];
    const required = condReq ? condReq(raw) : true;

    if (v === NA) {
      if (!f.allowNA) {
        issues.push({ field: f.id, severity: "error", message: `${f.label} cannot be marked not applicable.` });
      } else if (required && condReq) {
        issues.push({ field: f.id, severity: "error", message: `${f.label} is needed because a related input is above zero.` });
      }
      params[f.id] = 0;
      notApplicable.push(f.id);
      continue;
    }
    if (v === null || v === undefined || (typeof v === "number" && Number.isNaN(v))) {
      if (required) {
        issues.push({
          field: f.id,
          severity: "error",
          message: `${f.label} is missing. Enter a value${f.allowNA ? ", 0, or mark it not applicable" : ""}.`,
        });
      }
      params[f.id] = 0;
      continue;
    }
    if (!Number.isFinite(v)) {
      issues.push({ field: f.id, severity: "error", message: `${f.label} must be a finite number.` });
      params[f.id] = 0;
      continue;
    }
    if (f.kind === "int" && !Number.isInteger(v)) {
      issues.push({ field: f.id, severity: "error", message: `${f.label} must be a whole number.` });
    }
    if (f.minExclusive ? v <= f.min : v < f.min) {
      issues.push({
        field: f.id,
        severity: "error",
        message: `${f.label} must be ${f.minExclusive ? "greater than" : "at least"} ${f.min}.`,
      });
    }
    if (v > f.max) {
      issues.push({ field: f.id, severity: "error", message: `${f.label} must not exceed ${f.max}.` });
    }
    params[f.id] = v;
  }

  // Cross-field checks (only meaningful when the individual values are present).
  const hasErr = (id: FieldId) => issues.some((i) => i.field === id && i.severity === "error");
  const num = (id: FieldId) => (typeof raw[id] === "number" ? (raw[id] as number) : undefined);

  const horizon = num("horizonYears");
  if (horizon !== undefined && !hasErr("horizonYears")) {
    for (const id of ["dLifetime", "bLifetime", "fLifetime"] as const) {
      const life = num(id);
      if (life !== undefined && !hasErr(id) && horizon > life) {
        issues.push({ field: "horizonYears", severity: "error", message: `Analysis horizon (${horizon} yr) exceeds ${FIELD_BY_ID[id].label.toLowerCase()} in the ${id[0] === "d" ? "diesel" : id[0] === "b" ? "BEV" : "biofuel"} group (${life} yr).` });
      }
    }
  }

  const replY = num("bBatteryReplYear");
  if (replY !== undefined && horizon !== undefined && replY > horizon && (num("bBatteryReplCost") ?? 0) > 0) {
    issues.push({ field: "bBatteryReplYear", severity: "error", message: `Battery replacement year (${replY}) is after the analysis horizon (${horizon}).` });
  }

  if (num("fBlendPct") !== undefined && num("fApprovedBlendPct") !== undefined && num("fBlendPct")! > num("fApprovedBlendPct")!) {
    issues.push({ field: "fBlendPct", severity: "warning", message: "Blend exceeds the approved maximum. The operational rule will fail for biofuel." });
  }
  const loan = num("loanTermYears");
  if (loan !== undefined && horizon !== undefined && loan > horizon && (num("financedSharePct") ?? 0) > 0) {
    issues.push({ field: "loanTermYears", severity: "warning", message: "Loan term is longer than the analysis horizon. The balance still owed is treated as repaid in the final year." });
  }
  const dsc = num("discountRatePct");
  if (dsc !== undefined && dsc === 0) {
    issues.push({ field: "discountRatePct", severity: "warning", message: "A 0% discount rate ignores the time value of money." });
  }

  if (issues.some((i) => i.severity === "error")) return { ok: false, issues };
  return { ok: true, resolved: { params, notApplicable }, issues };
}
