import { createBlankAssessment } from "@/domain/blank";
import { createDemoAssessment } from "@/domain/demo";
import { missing, notApplicable, value, type NumericField } from "@/domain/fieldValue";
import { setChoice, setInput, setQNumber } from "@/domain/mutations";
import type { Assessment } from "@/domain/stored";

export const NOW = "2026-01-01T00:00:00.000Z";
export const blank = () => createBlankAssessment("test", NOW);
export const demo = () => createDemoAssessment("demo", NOW);

export const setNum = (a: Assessment, id: string, v: number | "NA" | null) =>
  setInput(a, id, v === null ? missing<number>() : v === "NA" ? notApplicable<number>() : value<number>(v), NOW);
export const setChoiceOf = (a: Assessment, id: string, option: string | null) => setChoice(a, id, option, NOW);
export const setQ = (a: Assessment, id: string, patch: { value?: NumericField; qualifier?: string }) => setQNumber(a, id, patch, NOW);
export const setText = (a: Assessment, id: string, text: string) => setInput(a, id, text, NOW);

/** Applies several numeric edits in order. */
export const withNums = (a: Assessment, edits: Record<string, number | "NA" | null>) =>
  Object.entries(edits).reduce((acc, [id, v]) => setNum(acc, id, v), a);
