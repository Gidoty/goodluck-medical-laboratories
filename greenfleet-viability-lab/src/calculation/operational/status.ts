import type { CalcWarning, WarningScope } from "../types";
import type { CheckStatus, OperationalCheck, OperationalStatus } from "./types";

export const opWarning = (code: string, scope: WarningScope, message: string, severity: CalcWarning["severity"] = "warning"): CalcWarning => ({ code, scope, message, severity, domain: "operational" });

export const check = (
  id: string,
  label: string,
  status: CheckStatus,
  explanation: string,
  opts: { observed?: OperationalCheck["observed"]; reference?: OperationalCheck["reference"]; conditions?: string[] } = {},
): OperationalCheck => ({ id, label, status, explanation, observed: opts.observed ?? null, reference: opts.reference ?? null, conditions: opts.conditions ?? [] });

/**
 * Turns individual checks into one operational status. The rules, in order:
 *
 *  1. Any check "constrained"                         -> CONSTRAINED
 *  2. A CORE check whose evidence is missing
 *     ("insufficient"), or a check that MUST be
 *     assessed but was left blank ("not_assessed")   -> INSUFFICIENT DATA
 *  3. Any check "conditional" or "insufficient"       -> CONDITIONAL
 *  4. Otherwise                                       -> SUITABLE
 *
 * Checks left "not_assessed" because the user did not fill in an optional input do not lower the
 * status, but they are listed so the gap is visible.
 */
export function overallStatus(checks: readonly OperationalCheck[], coreIds: readonly string[], mustBeAssessedIds: readonly string[] = []): { status: OperationalStatus; rule: string } {
  if (checks.some((c) => c.status === "constrained")) {
    const c = checks.find((x) => x.status === "constrained")!;
    return { status: "constrained", rule: `Rule 1: the "${c.label}" check is constrained.` };
  }
  const coreGap = checks.find((c) => (coreIds.includes(c.id) && c.status === "insufficient") || (mustBeAssessedIds.includes(c.id) && c.status === "not_assessed"));
  if (coreGap) return { status: "insufficient_data", rule: `Rule 2: the core "${coreGap.label}" check cannot be judged because the evidence is missing.` };
  const soft = checks.find((c) => c.status === "conditional" || c.status === "insufficient");
  if (soft) return { status: "conditional", rule: `Rule 3: the "${soft.label}" check is ${soft.status === "conditional" ? "conditional" : "uncertain"}.` };
  return { status: "suitable", rule: "Rule 4: every check that could be assessed is satisfied." };
}

export const STATUS_EXPLANATION: Record<OperationalStatus, string> = {
  suitable: "No operational constraint is identified from the data entered.",
  conditional: "Operation appears possible, but depends on the conditions listed.",
  constrained: "At least one entered fact conflicts with the duty cycle described.",
  insufficient_data: "The evidence needed to judge this technology's suitability is not available.",
};
