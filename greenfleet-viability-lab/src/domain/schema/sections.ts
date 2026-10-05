import type { SectionDef } from "./types";

/**
 * Display order of the form. "advanced" sections are collapsed disclosures of optional inputs;
 * "optional" sections are collapsed because the whole section can be skipped.
 */
export const SECTIONS: readonly SectionDef[] = [
  { id: "assessment", step: "business", title: "Assessment information", kind: "plain" },
  { id: "fleet", step: "business", title: "Fleet profile", kind: "plain" },
  { id: "operating", step: "business", title: "Operating profile", kind: "plain" },
  { id: "operating-advanced", step: "business", title: "Advanced assumptions", description: "Optional. Change how distance is entered, or add route detail.", kind: "advanced" },

  { id: "diesel-core", step: "diesel", title: "Essential inputs", kind: "plain" },
  { id: "diesel-advanced", step: "diesel", title: "Advanced assumptions", description: "Optional. Leave blank if you are unsure. Blanks are never filled with assumed values.", kind: "advanced" },

  { id: "bev-core", step: "electric", title: "Essential inputs", kind: "plain" },
  { id: "bev-ops", step: "electric", title: "Operational compatibility", description: "Optional details that help judge whether battery-electric vehicles suit your operation.", kind: "plain" },
  { id: "bev-advanced", step: "electric", title: "Advanced assumptions", description: "Optional. Leave blank if you are unsure. Blanks are never filled with assumed values.", kind: "advanced" },

  { id: "bio-core", step: "biofuel", title: "Pathway and essential inputs", kind: "plain" },
  { id: "bio-supply", step: "biofuel", title: "Supply and operation", description: "Optional details about how reliably the fuel can be obtained.", kind: "plain" },
  { id: "bio-advanced", step: "biofuel", title: "Advanced assumptions", description: "Optional. Leave blank if you are unsure. Blanks are never filled with assumed values.", kind: "advanced" },

  { id: "fin-financing", step: "finance", title: "Funding and required return", kind: "plain", group: "A. Financing" },
  { id: "fin-incentives", step: "finance", title: "Incentives", description: "Optional. Nothing is assumed: an incentive only exists if you enter one.", kind: "optional", group: "A. Financing" },
  { id: "fin-bev-infra", step: "finance", title: "Charging infrastructure (battery electric)", kind: "plain", group: "B. Infrastructure" },
  { id: "fin-bio-infra", step: "finance", title: "Biofuel infrastructure", kind: "plain", group: "B. Infrastructure", emptyNote: "Not needed so far. These fields appear if you answer “Yes” to special storage or infrastructure in Step 4." },
  { id: "fin-env", step: "finance", title: "Environmental assumptions", description: "Optional for the commercial analysis. Needed for the environmental comparison. No emission factor is pre-filled.", kind: "optional", group: "C. Environment" },
];

export const SECTION_BY_ID: Readonly<Record<string, SectionDef>> = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));
