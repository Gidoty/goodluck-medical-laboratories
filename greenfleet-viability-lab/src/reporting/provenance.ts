import type { AssumptionKind } from "@/components/ui/assumption-badge";
import type { NormalizedAssessmentInput } from "@/domain/normalized";
import type { AssumptionRecord } from "@/calculation/types";

/**
 * Maps an assumption record to the provenance class the app already uses (the assumption badges).
 * One mapping, used by the Results page, the report and the evidence view, so the terms never drift.
 */
export interface ProvenanceContext {
  illustrativeInputs: readonly string[];
  provenance: NormalizedAssessmentInput["provenance"];
}

export const contextOf = (input: Pick<NormalizedAssessmentInput, "meta" | "provenance">): ProvenanceContext => ({ illustrativeInputs: input.meta.illustrativeInputs, provenance: input.provenance });

export function classifyAssumption(a: AssumptionRecord, input: ProvenanceContext): AssumptionKind {
  const illustrative = new Set(input.illustrativeInputs);
  switch (a.status) {
    case "user_input": {
      if (a.fieldIds?.some((id) => illustrative.has(id))) return "illustrative";
      const sourced = a.fieldIds?.some((id) => {
        const s = input.provenance[id]?.source;
        return s !== null && s !== undefined && s !== "user_estimate";
      });
      return sourced ? "sourced" : "user";
    }
    case "derived":
      return "derived";
    case "convention":
      return "convention";
    default:
      return "excluded";
  }
}

export const PROVENANCE_LABEL: Record<AssumptionKind, string> = {
  user: "USER INPUT",
  illustrative: "ILLUSTRATIVE ASSUMPTION",
  sourced: "SOURCED VALUE",
  derived: "DERIVED VALUE",
  convention: "MODEL CONVENTION",
  excluded: "MISSING / EXCLUDED",
};

/** Source details the user supplied for an assumption. Never invented: absent means "Not supplied". */
export function sourceOf(a: AssumptionRecord, input: Pick<ProvenanceContext, "provenance">): { source: string | null; reference: string | null; year: number | null } {
  for (const id of a.fieldIds ?? []) {
    const p = input.provenance[id];
    if (p && (p.source || p.reference || p.year)) return { source: p.source, reference: p.reference || null, year: p.year };
  }
  return { source: null, reference: null, year: null };
}
