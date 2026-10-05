import type { CurrencyCode } from "@/lib/currency";
import type { FieldValue, NumericField } from "./fieldValue";

/**
 * Raw, user-entered form state. Every input is one of these shapes, and the shape is decided by
 * the field's kind in the schema (domain/schema/fields.ts). Nothing here is a formatted string
 * or a unit-converted value: numbers are exactly what the user typed, in the unit they chose.
 */

/** A number plus the unit or mode the user chose for it (e.g. 5 + "km_per_litre", or 20 + "percent"). */
export interface QNumberValue {
  value: NumericField;
  qualifier: string;
}

/** A selected option id, or missing. "unknown" is an option, not the absence of a choice. */
export type ChoiceValue = FieldValue<string>;

export type StoredValue = NumericField | ChoiceValue | string | QNumberValue;

export const SOURCE_TYPES = [
  { id: "user_estimate", label: "User estimate" },
  { id: "supplier_quotation", label: "Supplier quotation" },
  { id: "company_record", label: "Company record" },
  { id: "government_source", label: "Government source" },
  { id: "published_research", label: "Published research" },
  { id: "market_observation", label: "Market observation" },
  { id: "other", label: "Other" },
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number]["id"];

/** Optional metadata describing where a volatile input came from. Never required. */
export interface ProvenanceEntry {
  source: SourceType | null;
  reference: string;
  year: NumericField;
}

export type DataOrigin = "blank" | "demo" | "user";

export interface Assessment {
  id: string;
  scenarioName: string;
  /** "demo" while any illustrative value is still loaded; "blank" until the first edit; otherwise "user". */
  origin: DataOrigin;
  createdAt: string;
  updatedAt: string;
  /** Keyed by field id (see the schema). Currency is the field "business.currency". */
  inputs: Record<string, StoredValue>;
  provenance: Record<string, ProvenanceEntry>;
  /** Field ids that still hold an unedited illustrative demo value. Editing a field removes it. */
  illustrative: string[];
}

export type { CurrencyCode };
