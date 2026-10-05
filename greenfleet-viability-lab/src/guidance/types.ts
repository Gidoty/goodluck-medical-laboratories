/**
 * Reviewed static guidance. Nothing here is generated at run time, so help is the same offline,
 * the same on every visit, and can be checked line by line.
 */
export type GuidanceId =
  | "home"
  | "assessment.business"
  | "assessment.diesel"
  | "assessment.bev"
  | "assessment.biofuel"
  | "assessment.finance"
  | "assessment.review"
  | "results.overview"
  | "results.economic"
  | "results.operational"
  | "results.environmental"
  | "results.commercial"
  | "results.why"
  | "methodology"
  | "sensitivity"
  | "scenarios"
  | "about";

export interface GuidanceDefinition {
  term: string;
  text: string;
}

export interface GuidanceContent {
  id: GuidanceId;
  title: string;
  shortDescription: string;
  whatYouAreDoing?: string;
  whatYouNeed?: string[];
  whyItMatters?: string;
  whatGreenFleetDoes?: string;
  whatHappensNext?: string;
  /** Plain-language definitions of terms used on the page. */
  definitions?: GuidanceDefinition[];
  tips?: string[];
  warnings?: string[];
  /** Keys into the field-help glossary (src/content/glossary.ts). */
  relatedTerms?: string[];
  links?: { label: string; href: string }[];
}

export interface HelpTopic {
  id: string;
  title: string;
  /** Guidance entries that make up the topic, in reading order. */
  entries: GuidanceId[];
}

export interface TourStep {
  id: string;
  title: string;
  body: string;
  /** Where the step is, so the user can find it in the sidebar. */
  where: string;
  href: string;
}

export type OnboardingStatus = "completed" | "skipped" | "dismissed";
