"use client";

import { useId, useState, type ReactNode } from "react";
import { DEMO_LABEL, demoValueFor } from "@/domain/demo";
import { getNumeric, getText } from "@/domain/assessment";
import { notApplicable, missing, parseNumericInput, type NumericField } from "@/domain/fieldValue";
import type { NumericFieldDefinition, TextFieldDefinition } from "@/domain/fields";
import type { Assessment } from "@/domain/types";
import { validateNumeric, type ValidationIssue } from "@/domain/validation";
import { cn } from "@/lib/cn";
import { CURRENCY_LIST, isCurrencyCode, type CurrencyCode } from "@/lib/currency";
import { formatQuantity } from "@/lib/format";
import { unitLabel } from "@/lib/units";
import { useAssessmentActions } from "@/state/StoreProvider";

const inputBase =
  "block w-full min-w-0 rounded-lg border bg-surface px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-300 disabled:bg-navy-50 disabled:text-navy-400";

function FieldFrame({
  id,
  label,
  required,
  help,
  issues,
  children,
  footer,
}: {
  id: string;
  label: string;
  required: boolean;
  help?: string;
  issues: ValidationIssue[];
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-navy-900">
        {label}
        {!required && <span className="ml-1.5 text-xs font-normal text-slate-600">(optional)</span>}
      </label>
      {children}
      {help && (
        <p id={`${id}-help`} className="mt-1.5 text-xs text-slate-600">
          {help}
        </p>
      )}
      <div id={`${id}-issues`} aria-live="polite">
        {issues.map((i) => (
          <p key={i.code + i.message} className={cn("mt-1.5 text-xs font-medium", i.severity === "error" ? "text-red-800" : "text-amber-900")}>
            {i.message}
          </p>
        ))}
      </div>
      {footer}
    </div>
  );
}

interface NumberFieldProps {
  definition: NumericFieldDefinition;
  assessment: Assessment;
  showIssues: boolean;
}

export function NumberField({ definition, assessment, showIssues }: NumberFieldProps) {
  const { setNumeric } = useAssessmentActions();
  const id = useId();
  const { rule, path, help } = definition;
  const stored = getNumeric(assessment, path);
  const [draft, setDraft] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [badText, setBadText] = useState(false);

  const shown = draft ?? (stored.status === "value" ? String(stored.value) : "");
  const isNA = stored.status === "not_applicable";
  const unit = unitLabel(rule.unit, assessment.currency);

  const commit = (field: NumericField) => setNumeric(path, field);

  const issues: ValidationIssue[] =
    badText
      ? [{ fieldId: definition.id, code: "not_a_number", severity: "error", message: `${rule.label} must be a number, for example 1500 or 12.5.` }]
      : touched || showIssues
        ? validateNumeric(definition.id, stored, rule, assessment.currency)
        : // plausibility warnings are useful immediately, blocking errors wait until the user has interacted
          validateNumeric(definition.id, stored, rule, assessment.currency).filter((i) => i.severity === "warning");

  const hasError = issues.some((i) => i.severity === "error");
  const isDemoValue = assessment.origin === "demo" && stored.status === "value" && demoValueFor(path) === stored.value;
  const echo = stored.status === "value" && (rule.unit.startsWith("money") || Math.abs(stored.value) >= 10000) ? formatQuantity(stored.value, rule.unit, assessment.currency, 4) : null;

  return (
    <FieldFrame
      id={id}
      label={rule.label}
      required={rule.required}
      help={help}
      issues={issues}
      footer={
        <>
          {echo && <p className="mt-1 text-xs text-navy-600">= {echo}</p>}
          {isDemoValue && <p className="mt-1 text-xs font-medium text-forest-800">{DEMO_LABEL}</p>}
        </>
      }
    >
      <div className="mt-1.5 flex">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={isNA ? "" : shown}
          disabled={isNA}
          placeholder={isNA ? "Not applicable" : "Enter a number"}
          aria-invalid={hasError}
          aria-required={rule.required}
          aria-describedby={`${id}-unit${help ? ` ${id}-help` : ""} ${id}-issues`}
          className={cn(inputBase, "rounded-r-none border-r-0", hasError ? "border-red-500" : "border-navy-200")}
          onChange={(e) => {
            const text = e.target.value;
            setDraft(text);
            const parsed = parseNumericInput(text);
            if (parsed.status === "invalid") {
              setBadText(true);
              return;
            }
            setBadText(false);
            commit(parsed);
          }}
          onBlur={() => {
            setTouched(true);
            setDraft(null);
            setBadText(false);
          }}
        />
        <span
          id={`${id}-unit`}
          className={cn(
            "flex min-w-[4.5rem] items-center justify-center whitespace-nowrap rounded-r-lg border bg-navy-50 px-3 text-xs font-semibold text-navy-700",
            hasError ? "border-red-500" : "border-navy-200",
          )}
        >
          {unit}
        </span>
      </div>
      {rule.allowNotApplicable && (
        <label className="mt-2 flex w-fit cursor-pointer items-center gap-2 text-xs text-navy-800">
          <input
            type="checkbox"
            checked={isNA}
            className="size-4 accent-forest-700"
            onChange={(e) => {
              setDraft(null);
              setBadText(false);
              commit(e.target.checked ? notApplicable() : missing());
              setTouched(true);
            }}
          />
          Not applicable
        </label>
      )}
    </FieldFrame>
  );
}

export function TextField({
  definition,
  assessment,
  showIssues,
}: {
  definition: TextFieldDefinition;
  assessment: Assessment;
  showIssues: boolean;
}) {
  const { setText } = useAssessmentActions();
  const id = useId();
  const [touched, setTouched] = useState(false);
  const current = getText(assessment, definition.path);
  const issues: ValidationIssue[] =
    definition.required && current.trim() === "" && (touched || showIssues)
      ? [{ fieldId: definition.id, code: "missing", severity: "error", message: `${definition.label} is required.` }]
      : [];
  const hasError = issues.length > 0;
  return (
    <FieldFrame id={id} label={definition.label} required={definition.required} issues={issues}>
      <input
        id={id}
        type="text"
        value={current}
        placeholder={definition.placeholder}
        aria-invalid={hasError}
        aria-required={definition.required}
        aria-describedby={`${id}-issues`}
        className={cn(inputBase, "mt-1.5", hasError ? "border-red-500" : "border-navy-200")}
        onChange={(e) => setText(definition.path, e.target.value)}
        onBlur={() => setTouched(true)}
      />
    </FieldFrame>
  );
}

export function CurrencySelect({ value, onChange, id, className, showNames }: { value: CurrencyCode; onChange: (c: CurrencyCode) => void; id: string; className?: string; showNames?: boolean }) {
  return (
    <select
      id={id}
      value={value}
      className={cn(inputBase, "border-navy-200 py-2", className)}
      onChange={(e) => {
        if (isCurrencyCode(e.target.value)) onChange(e.target.value);
      }}
    >
      {CURRENCY_LIST.map((c) => (
        <option key={c.code} value={c.code}>
          {c.code} ({c.symbol}){showNames ? ` ${c.name}` : ""}
        </option>
      ))}
    </select>
  );
}
