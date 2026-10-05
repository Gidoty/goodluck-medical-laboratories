import type { Assessment, AssessmentResult } from "@/domain/types";

/**
 * The calculation engine lives in this folder and nowhere else. It must stay pure: no React, no
 * browser APIs, no persistence. Input is a fully validated Assessment; output is an AssessmentResult.
 *
 * Batch 1 defines only the contract. The implementation arrives in a later batch, with unit tests.
 */
export type CalculateAssessment = (assessment: Assessment) => AssessmentResult;
