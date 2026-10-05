import { missing, value } from "./fieldValue";
import { FIELDS, FIELD_BY_ID } from "./schema/fields";
import type { FieldDef } from "./schema/types";
import { isChoiceValue, isNumericField, isQNumber } from "./shapes";
import { SOURCE_TYPES, type Assessment, type DataOrigin, type ProvenanceEntry, type StoredValue } from "./stored";

/** The value a field has before the user touches it. Only non-market settings (currency, distance mode) are preset. */
export function blankValue(def: FieldDef): StoredValue {
  switch (def.kind) {
    case "number":
      return missing<number>();
    case "text":
      return "";
    case "choice":
      return def.defaultValue !== undefined ? value<string>(def.defaultValue) : missing<string>();
    case "qnumber":
      return { value: missing(), qualifier: def.defaultQualifier };
  }
}

export function createBlankAssessment(id: string, nowIso: string): Assessment {
  return {
    id,
    scenarioName: "Base scenario",
    origin: "blank",
    createdAt: nowIso,
    updatedAt: nowIso,
    inputs: Object.fromEntries(FIELDS.map((f) => [f.id, blankValue(f)])),
    provenance: {},
    illustrative: [],
  };
}

/** Keeps a persisted value only if it has the right shape for the field; otherwise falls back to blank. */
export function sanitizeStored(def: FieldDef, raw: unknown): StoredValue {
  switch (def.kind) {
    case "number":
      return isNumericField(raw) ? raw : blankValue(def);
    case "text":
      return typeof raw === "string" ? raw : blankValue(def);
    case "choice":
      if (!isChoiceValue(raw)) return blankValue(def);
      if (raw.status === "value") return def.options.some((o) => o.id === raw.value) ? raw : blankValue(def);
      return raw.status === "missing" ? raw : blankValue(def);
    case "qnumber":
      return isQNumber(raw) ? { value: raw.value, qualifier: raw.qualifier } : blankValue(def);
  }
}

function sanitizeProvenance(raw: unknown): Record<string, ProvenanceEntry> {
  const out: Record<string, ProvenanceEntry> = {};
  if (raw === null || typeof raw !== "object") return out;
  for (const [id, entry] of Object.entries(raw)) {
    const def = FIELD_BY_ID[id];
    if (!def?.provenance || entry === null || typeof entry !== "object") continue;
    const e = entry as { source?: unknown; reference?: unknown; year?: unknown };
    out[id] = {
      source: SOURCE_TYPES.some((s) => s.id === e.source) ? (e.source as ProvenanceEntry["source"]) : null,
      reference: typeof e.reference === "string" ? e.reference : "",
      year: isNumericField(e.year) ? e.year : missing(),
    };
  }
  return out;
}

const ORIGINS: readonly DataOrigin[] = ["blank", "demo", "user"];

/** Rebuilds a complete, valid assessment from untrusted saved data. New schema fields get blank values. */
export function restoreAssessment(blank: Assessment, saved: unknown): Assessment {
  if (saved === null || typeof saved !== "object") return blank;
  const s = saved as Partial<Record<keyof Assessment, unknown>>;
  const savedInputs = s.inputs !== null && typeof s.inputs === "object" ? (s.inputs as Record<string, unknown>) : {};
  const illustrative = Array.isArray(s.illustrative) ? s.illustrative.filter((id): id is string => typeof id === "string" && id in FIELD_BY_ID) : [];
  return {
    id: typeof s.id === "string" ? s.id : blank.id,
    scenarioName: typeof s.scenarioName === "string" ? s.scenarioName : blank.scenarioName,
    origin: ORIGINS.includes(s.origin as DataOrigin) ? (s.origin as DataOrigin) : blank.origin,
    createdAt: typeof s.createdAt === "string" ? s.createdAt : blank.createdAt,
    updatedAt: typeof s.updatedAt === "string" ? s.updatedAt : blank.updatedAt,
    inputs: Object.fromEntries(FIELDS.map((f) => [f.id, f.id in savedInputs ? sanitizeStored(f, savedInputs[f.id]) : blank.inputs[f.id]!])),
    provenance: sanitizeProvenance(s.provenance),
    illustrative,
  };
}
