import { DEFAULT_CURRENCY, isCurrencyCode, type CurrencyCode } from "@/lib/currency";
import type { UnitId } from "@/lib/units";
import { missing, type NumericField } from "./fieldValue";
import { FIELD_BY_ID } from "./schema/fields";
import type { ChoiceDef, FieldDef, QNumberDef, QOption, Reader } from "./schema/types";
import { isChoiceValue, isNumericField, isQNumber } from "./shapes";
import type { Assessment } from "./stored";

export const CURRENCY_FIELD = "business.currency";

export function getCurrency(a: Assessment): CurrencyCode {
  const raw = a.inputs[CURRENCY_FIELD];
  return isChoiceValue(raw) && raw.status === "value" && isCurrencyCode(raw.value) ? raw.value : DEFAULT_CURRENCY;
}

function defOf(id: string): FieldDef {
  const def = FIELD_BY_ID[id];
  if (!def) throw new Error(`Unknown field id "${id}"`);
  return def;
}

export function qualifierOptions(def: QNumberDef, r: Reader): readonly QOption[] {
  return typeof def.qualifiers === "function" ? def.qualifiers(r) : def.qualifiers;
}

export const resolveUnit = (unit: UnitId | ((r: Reader) => UnitId), r: Reader): UnitId => (typeof unit === "function" ? unit(r) : unit);

/** Read-only, visibility-aware view of an assessment. Hidden fields read as missing. */
export function createReader(a: Assessment): Reader {
  const visibility = new Map<string, boolean>();
  const visiting = new Set<string>();

  const reader: Reader = {
    currency: getCurrency(a),

    isVisible(id) {
      const cached = visibility.get(id);
      if (cached !== undefined) return cached;
      const def = defOf(id);
      if (visiting.has(id)) throw new Error(`Circular visibility rule at "${id}"`);
      visiting.add(id);
      const visible = def.visibleWhen ? def.visibleWhen(reader) : true;
      visiting.delete(id);
      visibility.set(id, visible);
      return visible;
    },

    number(id) {
      const def = defOf(id);
      if (def.kind !== "number") throw new Error(`"${id}" is not a number field`);
      if (!reader.isVisible(id)) return missing();
      const raw = a.inputs[id];
      return isNumericField(raw) ? raw : missing();
    },

    text(id) {
      const def = defOf(id);
      if (def.kind !== "text") throw new Error(`"${id}" is not a text field`);
      if (!reader.isVisible(id)) return "";
      const raw = a.inputs[id];
      return typeof raw === "string" ? raw : "";
    },

    choice(id) {
      const def = defOf(id) as ChoiceDef;
      if (def.kind !== "choice") throw new Error(`"${id}" is not a choice field`);
      if (!reader.isVisible(id)) return undefined;
      const raw = a.inputs[id];
      return isChoiceValue(raw) && raw.status === "value" ? raw.value : undefined;
    },

    q(id) {
      const def = defOf(id);
      if (def.kind !== "qnumber") throw new Error(`"${id}" is not a qnumber field`);
      const options = qualifierOptions(def, reader);
      const raw = a.inputs[id];
      const stored = isQNumber(raw) ? raw : { value: missing<number>(), qualifier: def.defaultQualifier };
      const qualifier = options.some((o) => o.id === stored.qualifier) ? stored.qualifier : def.defaultQualifier;
      const value: NumericField = reader.isVisible(id) ? stored.value : missing();
      return { value, qualifier };
    },

    unitOf(id) {
      const def = defOf(id);
      if (def.kind === "number") return resolveUnit(def.unit, reader);
      if (def.kind === "qnumber") {
        const { qualifier } = reader.q(id);
        const option = qualifierOptions(def, reader).find((o) => o.id === qualifier);
        if (!option) throw new Error(`No qualifier "${qualifier}" on "${id}"`);
        return resolveUnit(option.unit, reader);
      }
      throw new Error(`"${id}" has no unit`);
    },
  };
  return reader;
}

export function visibleFields(a: Assessment, reader: Reader = createReader(a)): FieldDef[] {
  return Object.values(FIELD_BY_ID).filter((f) => reader.isVisible(f.id));
}
