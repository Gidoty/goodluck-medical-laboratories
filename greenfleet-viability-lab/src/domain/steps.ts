export const ASSESSMENT_STEPS = [
  { id: "business", number: 1, title: "Business & Fleet", short: "Business", description: "Describe your business, your vehicles and how they are used." },
  { id: "diesel", number: 2, title: "Diesel Baseline", short: "Diesel", description: "The diesel vehicle represents the conventional benchmark against which green alternatives will be compared." },
  { id: "electric", number: 3, title: "Battery Electric", short: "Electric", description: "Battery Electric Alternative: configure the vehicle, its energy cost and how well it suits your operation." },
  { id: "biofuel", number: 4, title: "Biofuel", short: "Biofuel", description: "Biofuel / Alternative Fuel Pathway: choose the pathway first. Not every engine can use every fuel." },
  { id: "finance", number: 5, title: "Finance & Infrastructure", short: "Finance", description: "Financing, incentives, infrastructure and environmental assumptions." },
  { id: "review", number: 6, title: "Review & Calculate", short: "Review", description: "Check every input and what is still missing before running the assessment." },
] as const;

export type StepId = (typeof ASSESSMENT_STEPS)[number]["id"];
export type AssessmentStep = (typeof ASSESSMENT_STEPS)[number];
export const FIRST_STEP: StepId = "business";

export const stepById = (id: string): AssessmentStep | undefined => ASSESSMENT_STEPS.find((s) => s.id === id);

export function neighbours(id: StepId): { prev?: AssessmentStep; next?: AssessmentStep } {
  const i = ASSESSMENT_STEPS.findIndex((s) => s.id === id);
  return { prev: ASSESSMENT_STEPS[i - 1], next: ASSESSMENT_STEPS[i + 1] };
}

/** The ten stages of the eventual user journey, and what exists today. */
export const JOURNEY = [
  { n: 1, title: "Define business and fleet context", state: "ready" },
  { n: 2, title: "Configure diesel baseline", state: "ready" },
  { n: 3, title: "Configure battery-electric alternative", state: "ready" },
  { n: 4, title: "Configure biofuel alternative", state: "ready" },
  { n: 5, title: "Configure financing and infrastructure", state: "ready" },
  { n: 6, title: "Run techno-economic assessment", state: "ready" },
  { n: 7, title: "View comparative results", state: "ready" },
  { n: 8, title: "Run scenario and sensitivity analysis", state: "planned" },
  { n: 9, title: "Receive commercial viability classification", state: "ready" },
  { n: 10, title: "Explore \"What Would Make It Viable?\" thresholds", state: "planned" },
] as const;
