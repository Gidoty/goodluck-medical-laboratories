import type { ResultFormatter } from "@/components/results/format-results";
import { CLASSIFICATION_LABEL } from "@/calculation/viability/types";
import { formatNumber } from "@/lib/format";
import type { Cell } from "./types";

/**
 * The one place that turns a report value into text (screen, print, presentation) or into a raw
 * number (exports). A missing value is never turned into zero.
 */
export function cellText(c: Cell, f: ResultFormatter): string {
  switch (c.kind) {
    case "money": return f.money(c.value);
    case "perKm": return f.perKm(c.value);
    case "tonnes": return `${formatNumber(c.value, 2)} tCO2e`;
    case "kgPerKm": return `${formatNumber(c.value, 3)} kg CO2e/km`;
    case "percent": return `${formatNumber(c.value, 1)}%`;
    case "payback": return f.years(c.value);
    case "text": return f.text(c.value);
    case "class": return CLASSIFICATION_LABEL[c.value];
    case "baseline": return "Baseline";
    case "unavailable": return `Unavailable: ${f.text(c.reason)}`;
    case "not_run": return "Not run";
    case "na": return "Not applicable";
  }
}

export type RawCell = { value: number | string | null; status: "value" | "baseline" | "unavailable" | "not_achieved" | "immediate" | "not_run" | "not_applicable" };

/** Raw, unrounded value plus an explicit status, for CSV and JSON. */
export function cellRaw(c: Cell): RawCell {
  switch (c.kind) {
    case "money": case "perKm": case "tonnes": case "kgPerKm": case "percent": return { value: c.value, status: "value" };
    case "payback":
      return c.value.status === "achieved" ? { value: c.value.years, status: "value" } : c.value.status === "immediate" ? { value: 0, status: "immediate" } : { value: null, status: "not_achieved" };
    case "text": return { value: c.value, status: "value" };
    case "class": return { value: c.value, status: "value" };
    case "baseline": return { value: null, status: "baseline" };
    case "unavailable": return { value: c.reason, status: "unavailable" };
    case "not_run": return { value: null, status: "not_run" };
    case "na": return { value: null, status: "not_applicable" };
  }
}
