import type { StepId } from "@/domain/steps";

/** How the flat schema is grouped on the review screen. Each group links back to the step that edits it. */
export interface ReviewGroup {
  id: string;
  title: string;
  step: StepId;
  sections: readonly string[];
}

export const REVIEW_GROUPS: readonly ReviewGroup[] = [
  { id: "business", title: "Business & Fleet", step: "business", sections: ["assessment", "fleet", "operating", "operating-advanced"] },
  { id: "diesel", title: "Diesel Baseline", step: "diesel", sections: ["diesel-core", "diesel-advanced"] },
  { id: "electric", title: "Battery Electric", step: "electric", sections: ["bev-core", "bev-ops", "bev-advanced"] },
  { id: "biofuel", title: "Biofuel", step: "biofuel", sections: ["bio-core", "bio-supply", "bio-advanced"] },
  { id: "finance", title: "Finance", step: "finance", sections: ["fin-financing", "fin-incentives"] },
  { id: "infrastructure", title: "Infrastructure", step: "finance", sections: ["fin-bev-infra", "fin-bio-infra"] },
  { id: "environment", title: "Environmental Assumptions", step: "finance", sections: ["fin-env"] },
];
