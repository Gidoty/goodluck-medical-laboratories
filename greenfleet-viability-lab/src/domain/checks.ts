import { formatNumber } from "@/lib/format";
import { convertUnit } from "@/lib/units";
import { createReader, qualifierOptions, resolveUnit } from "./reader";
import { FIELD_BY_ID, FIELDS } from "./schema/fields";
import type { FieldDef, Reader } from "./schema/types";
import type { StepId } from "./steps";
import type { Assessment } from "./stored";
import { deriveOperations } from "./derive";
import { validateNumeric, type IssueCode, type ValidationIssue } from "./validation";

export interface FieldIssue extends ValidationIssue {
  stepId: StepId;
  sectionId: string;
}

const at = (id: string, severity: "error" | "warning", code: IssueCode, message: string): FieldIssue => {
  const def = FIELD_BY_ID[id];
  if (!def) throw new Error(`Unknown field id "${id}"`);
  return { fieldId: id, severity, code, message, stepId: def.step, sectionId: def.section };
};

function validateField(def: FieldDef, r: Reader): FieldIssue[] {
  if (!r.isVisible(def.id)) return [];
  const tag = (issues: ValidationIssue[]): FieldIssue[] => issues.map((i) => ({ ...i, stepId: def.step, sectionId: def.section }));
  switch (def.kind) {
    case "number":
      return tag(validateNumeric(def.id, r.number(def.id), { ...def.rule, label: def.label, unit: r.unitOf(def.id), required: def.required, allowNotApplicable: def.allowNotApplicable }, r.currency));
    case "text":
      return def.required && r.text(def.id).trim() === "" ? [at(def.id, "error", "missing", `${def.label} is required.`)] : [];
    case "choice":
      return def.required && r.choice(def.id) === undefined ? [at(def.id, "error", "missing", `Select an option for “${def.label}”.`)] : [];
    case "qnumber": {
      const { value, qualifier } = r.q(def.id);
      const option = qualifierOptions(def, r).find((o) => o.id === qualifier);
      if (!option) return [];
      return tag(validateNumeric(def.id, value, { ...option.rule, label: def.label, unit: resolveUnit(option.unit, r), required: def.required, allowNotApplicable: def.allowNotApplicable }, r.currency));
    }
  }
}

function validateProvenance(a: Assessment): FieldIssue[] {
  const out: FieldIssue[] = [];
  for (const [id, p] of Object.entries(a.provenance)) {
    const def = FIELD_BY_ID[id];
    if (!def || p.year.status !== "value") continue;
    const y = p.year.value;
    if (!Number.isInteger(y) || y < 1900 || y > 2100) {
      out.push({ fieldId: `${id}#source-year`, severity: "error", code: "below_min", message: `Source year for “${def.label}” must be a whole calendar year between 1900 and 2100.`, stepId: def.step, sectionId: def.section });
    }
  }
  return out;
}

const KG = (r: Reader, id: string): number | undefined => {
  const { value, qualifier } = r.q(id);
  if (value.status !== "value") return undefined;
  try {
    return convertUnit(value.value, qualifier === "tonnes" ? "tonnes" : "kg", "kg");
  } catch {
    return undefined;
  }
};
const val = (r: Reader, id: string): number | undefined => {
  const f = r.number(id);
  return f.status === "value" ? f.value : undefined;
};

const VEHICLES = [
  { key: "diesel", name: "diesel vehicle", life: "diesel.usefulLife", price: "diesel.acquisitionPrice", residual: "diesel.residual" },
  { key: "bev", name: "battery-electric vehicle", life: "bev.usefulLife", price: "bev.acquisitionPrice", residual: "bev.residual" },
  { key: "biofuel", name: "biofuel vehicle", life: "biofuel.usefulLife", price: "biofuel.acquisitionPrice", residual: "biofuel.residual" },
] as const;

/** Rules that compare several inputs. They only run on fields that are visible and filled in. */
function crossFieldChecks(a: Assessment, r: Reader): FieldIssue[] {
  const out: FieldIssue[] = [];

  // Debt and equity must add up to 100%.
  const debt = val(r, "finance.debtPercent");
  const equity = val(r, "finance.equityPercent");
  if (debt !== undefined && equity !== undefined && Math.abs(debt + equity - 100) > 1e-9) {
    out.push(at("finance.equityPercent", "error", "above_max", `Debt (${formatNumber(debt, 4)}%) and equity (${formatNumber(equity, 4)}%) must add up to 100%. They add up to ${formatNumber(debt + equity, 4)}%.`));
  }

  // Average payload cannot exceed capacity.
  const capacity = KG(r, "fleet.payloadCapacity");
  const average = KG(r, "fleet.averagePayload");
  if (capacity !== undefined && average !== undefined && average > capacity) {
    out.push(at("fleet.averagePayload", "error", "above_max", `Average payload (${formatNumber(average, 2)} kg) cannot exceed payload capacity (${formatNumber(capacity, 2)} kg).`));
  }
  const reduction = r.q("bev.payloadReduction");
  if (capacity !== undefined && reduction.qualifier === "kg" && reduction.value.status === "value" && reduction.value.value >= capacity) {
    out.push(at("bev.payloadReduction", "error", "above_max", "Payload reduction must be smaller than the payload capacity."));
  }

  // Analysis period against vehicle life and battery replacement timing.
  const horizon = val(r, "ops.analysisHorizon");
  for (const v of VEHICLES) {
    const life = val(r, v.life);
    if (horizon !== undefined && life !== undefined && horizon > life) {
      out.push(at(v.life, "warning", "implausible", `The analysis period (${formatNumber(horizon)} years) is longer than this ${v.name}'s useful life (${formatNumber(life)} years).`));
    }
    const resid = r.q(v.residual);
    const price = val(r, v.price);
    if (resid.qualifier === "amount" && resid.value.status === "value" && price !== undefined && resid.value.value > price) {
      out.push(at(v.residual, "warning", "implausible", "Residual value is higher than the acquisition price. Check the amount."));
    }
  }
  const replYear = val(r, "bev.batteryReplacementYear");
  if (replYear !== undefined) {
    const life = val(r, "bev.usefulLife");
    if (life !== undefined && replYear > life) out.push(at("bev.batteryReplacementYear", "error", "above_max", `Battery replacement year (${replYear}) is after the vehicle's useful life (${formatNumber(life)} years).`));
    else if (horizon !== undefined && replYear > horizon) out.push(at("bev.batteryReplacementYear", "warning", "implausible", `Battery replacement year (${replYear}) falls after the analysis period (${formatNumber(horizon)} years), so it may not affect the result.`));
  }
  const tenor = val(r, "finance.loanTenor");
  if (tenor !== undefined && horizon !== undefined && tenor > horizon) {
    out.push(at("finance.loanTenor", "warning", "implausible", "The loan runs longer than the analysis period."));
  }

  // Annual-distance mode: the implied daily distance must be physically sensible.
  const ops = deriveOperations(a);
  if (ops.mode === "annual" && ops.dailyDistanceKm !== null && ops.dailyDistanceKm > 1500) {
    out.push(at("ops.annualDistance", "warning", "implausible", `That annual distance implies ${formatNumber(ops.dailyDistanceKm, 0)} km on each operating day. Check the figure and the operating days.`));
  }
  return out;
}

export function checkAssessment(a: Assessment): FieldIssue[] {
  const r = createReader(a);
  return [...FIELDS.flatMap((f) => validateField(f, r)), ...validateProvenance(a), ...crossFieldChecks(a, r)];
}

export const issuesForStep = (issues: readonly FieldIssue[], step: StepId) => issues.filter((i) => i.stepId === step);
