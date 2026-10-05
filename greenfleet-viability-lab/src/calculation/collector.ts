import type { AssumptionRecord, CalcWarning, WarningScope, WarningSeverity } from "./types";

/** Gathers warnings and assumption records while the engine runs. Created fresh for every calculation. */
export interface Collector {
  warnings: CalcWarning[];
  assumptions: AssumptionRecord[];
  warn(code: string, scope: WarningScope, message: string, severity?: WarningSeverity): void;
  assume(record: AssumptionRecord): void;
}

export function createCollector(): Collector {
  const warnings: CalcWarning[] = [];
  const assumptions: AssumptionRecord[] = [];
  const seen = new Set<string>();
  return {
    warnings,
    assumptions,
    warn(code, scope, message, severity = "warning") {
      const key = `${code}|${scope}`;
      if (seen.has(key)) return;
      seen.add(key);
      warnings.push({ code, scope, message, severity });
    },
    assume(record) {
      if (assumptions.some((a) => a.id === record.id)) return;
      assumptions.push(record);
    },
  };
}

const NUMBER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
/** Plain number formatting for assumption text. Currency symbols are added by the UI. */
export const fmtNum = (x: number): string => NUMBER.format(x);
