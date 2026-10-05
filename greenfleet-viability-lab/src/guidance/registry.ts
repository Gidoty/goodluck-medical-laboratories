import { GUIDANCE, HELP_TOPICS } from "./content";
import type { GuidanceContent, GuidanceId, HelpTopic } from "./types";

/** Maps a pathname to the guidance entry for that page. */
export function guidanceIdForPath(pathname: string | null | undefined): GuidanceId {
  const p = (pathname ?? "/").replace(/\/+$/, "") || "/";
  if (p === "/" || p === "/overview") return "home";
  if (p.startsWith("/assessment")) {
    const step = p.split("/")[2];
    switch (step) {
      case "diesel": return "assessment.diesel";
      case "electric": return "assessment.bev";
      case "biofuel": return "assessment.biofuel";
      case "finance": return "assessment.finance";
      case "review": return "assessment.review";
      default: return "assessment.business";
    }
  }
  if (p.startsWith("/results")) return "results.overview";
  if (p.startsWith("/report")) return "report";
  if (p.startsWith("/present")) return "presentation";
  if (p.startsWith("/methodology")) return "methodology";
  if (p.startsWith("/sensitivity")) return "sensitivity";
  if (p.startsWith("/scenarios")) return "scenarios";
  if (p.startsWith("/about")) return "about";
  return "home";
}

export const getGuidance = (id: GuidanceId): GuidanceContent => GUIDANCE[id];

export const helpTopics = (): readonly HelpTopic[] => HELP_TOPICS;

/** Entries shown below the main one on a page that has sub-sections (the results dashboard). */
export const relatedEntries = (id: GuidanceId): GuidanceId[] =>
  id === "results.overview" ? ["results.economic", "results.operational", "results.environmental", "results.commercial", "results.why"] : [];

export const STEP_GUIDANCE: Record<"business" | "diesel" | "electric" | "biofuel" | "finance" | "review", GuidanceId> = {
  business: "assessment.business",
  diesel: "assessment.diesel",
  electric: "assessment.bev",
  biofuel: "assessment.biofuel",
  finance: "assessment.finance",
  review: "assessment.review",
};
