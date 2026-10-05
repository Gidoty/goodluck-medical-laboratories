import type { CurrencyCode } from "@/lib/currency";
import type { UnitId } from "@/lib/units";
import type { NumericField } from "../fieldValue";
import type { StepId } from "../steps";
import type { NumericRule } from "../validation";

/** Everything a rule, visibility test or unit lookup is allowed to read. Unknown ids throw. */
export interface Reader {
  readonly currency: CurrencyCode;
  /** Hidden fields behave as missing for every other field, so stale values can never leak. */
  isVisible(id: string): boolean;
  number(id: string): NumericField;
  text(id: string): string;
  /** Selected option id, or undefined when missing (or hidden). */
  choice(id: string): string | undefined;
  /** Number plus the active qualifier (falls back to the field's default if the stored one is not offered). */
  q(id: string): { value: NumericField; qualifier: string };
  /** Unit that applies to a number or qnumber field right now. */
  unitOf(id: string): UnitId;
}

export type RuleSpec = Omit<NumericRule, "label" | "unit" | "required">;

export interface BaseDef {
  id: string;
  step: StepId;
  section: string;
  label: string;
  /** Key into the glossary (src/content/glossary.ts) for the help tooltip. */
  glossary?: string;
  /** One short line shown under the input. */
  hint?: string;
  placeholder?: string;
  required: boolean;
  visibleWhen?: (r: Reader) => boolean;
  /** Offer the optional "where did this number come from?" panel. */
  provenance?: boolean;
}

export interface NumberDef extends BaseDef {
  kind: "number";
  unit: UnitId | ((r: Reader) => UnitId);
  rule: RuleSpec;
  allowNotApplicable?: boolean;
}

export interface TextDef extends BaseDef {
  kind: "text";
  multiline?: boolean;
}

export interface ChoiceOption {
  id: string;
  label: string;
}

export interface ChoiceDef extends BaseDef {
  kind: "choice";
  options: readonly ChoiceOption[];
  presentation: "select" | "radio" | "switch";
  /** Pre-selected option in a blank assessment. Only used for non-market settings such as currency. */
  defaultValue?: string;
  /** For "switch": the option that means "on". The other option is "off". */
  switchOn?: string;
  /** Fields whose values are cleared when this choice changes (their unit or meaning depends on it). */
  resetsOnChange?: readonly string[];
}

export interface QOption {
  id: string;
  unit: UnitId | ((r: Reader) => UnitId);
  rule: RuleSpec;
}

export interface QNumberDef extends BaseDef {
  kind: "qnumber";
  qualifiers: readonly QOption[] | ((r: Reader) => readonly QOption[]);
  defaultQualifier: string;
  allowNotApplicable?: boolean;
}

export type FieldDef = NumberDef | TextDef | ChoiceDef | QNumberDef;

export type SectionKind = "plain" | "advanced" | "optional";

export interface SectionDef {
  id: string;
  step: StepId;
  title: string;
  description?: string;
  kind: SectionKind;
  /** Shown instead of the fields when none of them is currently relevant. Without it the section is hidden. */
  emptyNote?: string;
  /** Heading shown once above consecutive sections that share a group (used on the finance step). */
  group?: string;
}
