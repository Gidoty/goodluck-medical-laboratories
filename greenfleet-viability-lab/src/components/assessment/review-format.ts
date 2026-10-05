import { toCanonical } from "@/domain/derive";
import type { Reader, FieldDef } from "@/domain/schema/types";
import { formatNumber, formatQuantity } from "@/lib/format";
import { unitLabel } from "@/lib/units";

export interface DescribedValue {
  text: string;
  /** Secondary line, e.g. the equivalent in the unit used internally. */
  note?: string;
  state: "value" | "not_applicable" | "empty";
}

/** One consistent way to show any entered value with its unit. Never invents a value. */
export function describeValue(def: FieldDef, r: Reader): DescribedValue {
  switch (def.kind) {
    case "number": {
      const f = r.number(def.id);
      if (f.status === "not_applicable") return { text: "Not applicable", state: "not_applicable" };
      if (f.status === "missing") return { text: "Not entered", state: "empty" };
      return { text: formatQuantity(f.value, r.unitOf(def.id), r.currency, 4), state: "value" };
    }
    case "qnumber": {
      const { value } = r.q(def.id);
      if (value.status === "not_applicable") return { text: "Not applicable", state: "not_applicable" };
      if (value.status === "missing") return { text: "Not entered", state: "empty" };
      const canonical = toCanonical(r, def.id);
      return {
        text: formatQuantity(value.value, r.unitOf(def.id), r.currency, 4),
        note: canonical?.converted ? `= ${formatNumber(canonical.value, 4)} ${unitLabel(canonical.unit, r.currency)}` : undefined,
        state: "value",
      };
    }
    case "text": {
      const t = r.text(def.id).trim();
      return t === "" ? { text: "Not entered", state: "empty" } : { text: t, state: "value" };
    }
    case "choice": {
      const id = r.choice(def.id);
      const label = def.options.find((o) => o.id === id)?.label;
      return label ? { text: label, state: "value" } : { text: "Not selected", state: "empty" };
    }
  }
}
