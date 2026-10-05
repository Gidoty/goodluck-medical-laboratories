import type { NormalizedAssessmentInput } from "@/domain/normalized";
import type { CalculationOutcome } from "./types";

/**
 * The calculation engine lives in this folder and nowhere else. It is pure: no React, no browser
 * APIs, no persistence, no randomness. Input is the validated NormalizedAssessmentInput produced
 * by the input system; output is an outcome that is either a complete result or a list of reasons
 * why no result can be produced. It never returns partial or guessed numbers.
 */
export type CalculateAssessment = (input: NormalizedAssessmentInput) => CalculationOutcome;
