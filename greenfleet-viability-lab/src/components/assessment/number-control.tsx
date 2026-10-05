"use client";

import { useId, useState } from "react";
import { AssumptionBadge } from "@/components/ui/assumption-badge";
import { toCanonical } from "@/domain/derive";
import { missing, notApplicable } from "@/domain/fieldValue";
import { createReader, qualifierOptions, resolveUnit } from "@/domain/reader";
import type { NumberDef, QNumberDef } from "@/domain/schema/types";
import { cn } from "@/lib/cn";
import { formatNumber, formatQuantity } from "@/lib/format";
import { unitLabel } from "@/lib/units";
import { useAssessmentActions } from "@/state/StoreProvider";
import { describedBy, FieldShell, inputClass, visibleIssues, type ControlProps } from "./field-shell";
import { useNumericDraft } from "./numeric-draft";
import { ProvenancePanel } from "./provenance-panel";

const suffixClass = "flex shrink-0 items-center border bg-navy-50 text-xs font-semibold text-navy-700";

function NotApplicableToggle({ checked, onChange }: { checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="mt-2 flex w-fit cursor-pointer items-center gap-2 text-xs text-navy-800">
      <input type="checkbox" checked={checked} className="size-4 accent-forest-700" onChange={(e) => onChange(e.target.checked)} />
      Not applicable
    </label>
  );
}

export function NumberControl({ def, assessment, issues, showIssues }: ControlProps & { def: NumberDef }) {
  const actions = useAssessmentActions();
  const id = useId();
  const reader = createReader(assessment);
  const stored = reader.number(def.id);
  const unit = reader.unitOf(def.id);
  const [touched, setTouched] = useState(false);
  const draft = useNumericDraft(stored, (f) => actions.setNumber(def.id, f));
  const isNA = stored.status === "not_applicable";

  const shown = visibleIssues(issues, touched, showIssues);
  const hasError = shown.some((i) => i.severity === "error") || draft.notANumber;
  const withDraftIssue = draft.notANumber
    ? [...shown, { fieldId: def.id, code: "not_a_number" as const, severity: "error" as const, message: `${def.label} must be a number, for example 1500 or 12.5.`, stepId: def.step, sectionId: def.section }]
    : shown;

  const echo = stored.status === "value" && unit.startsWith("money") && Math.abs(stored.value) >= 10000 ? formatQuantity(stored.value, unit, reader.currency, 4) : null;
  const blend = def.id === "biofuel.blendPercent" && stored.status === "value" ? `Notation: B${formatNumber(stored.value, 2)}` : null;

  return (
    <FieldShell def={def} assessment={assessment} controlId={id} labelId={`${id}-label`} issues={withDraftIssue} describedById={id} hint={def.hint}
      footer={
        <>
          {(echo || blend) && <p className="mt-1 text-xs text-navy-600">{echo ? `= ${echo}` : blend}</p>}
          {def.provenance && <ProvenancePanel def={def} assessment={assessment} />}
        </>
      }
    >
      <div className="mt-1.5 flex">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={isNA ? "" : draft.shown}
          disabled={isNA}
          placeholder={isNA ? "Not applicable" : def.placeholder ?? "Enter a number"}
          aria-invalid={hasError}
          aria-required={def.required}
          aria-describedby={describedBy(id, !!def.hint)}
          className={cn(inputClass, "rounded-r-none border-r-0", hasError ? "border-red-600" : "border-navy-200")}
          onChange={(e) => draft.onChange(e.target.value)}
          onBlur={() => {
            setTouched(true);
            draft.onBlur();
          }}
        />
        <span className={cn(suffixClass, "min-w-[4.5rem] justify-center whitespace-nowrap rounded-r-lg px-3", hasError ? "border-red-600" : "border-navy-200")}>{unitLabel(unit, reader.currency)}</span>
      </div>
      {def.allowNotApplicable && (
        <NotApplicableToggle
          checked={isNA}
          onChange={(on) => {
            actions.setNumber(def.id, on ? notApplicable() : missing());
            setTouched(true);
          }}
        />
      )}
    </FieldShell>
  );
}

export function QNumberControl({ def, assessment, issues, showIssues }: ControlProps & { def: QNumberDef }) {
  const actions = useAssessmentActions();
  const id = useId();
  const reader = createReader(assessment);
  const { value, qualifier } = reader.q(def.id);
  const options = qualifierOptions(def, reader);
  const [touched, setTouched] = useState(false);
  const draft = useNumericDraft(value, (f) => actions.setQNumber(def.id, { value: f }));
  const isNA = value.status === "not_applicable";
  const canonical = toCanonical(reader, def.id);

  const shown = visibleIssues(issues, touched, showIssues);
  const hasError = shown.some((i) => i.severity === "error") || draft.notANumber;
  const withDraftIssue = draft.notANumber
    ? [...shown, { fieldId: def.id, code: "not_a_number" as const, severity: "error" as const, message: `${def.label} must be a number, for example 1500 or 12.5.`, stepId: def.step, sectionId: def.section }]
    : shown;

  const activeUnit = reader.unitOf(def.id);
  const amountEcho = value.status === "value" && activeUnit === "money" && Math.abs(value.value) >= 10000 ? `= ${formatQuantity(value.value, activeUnit, reader.currency, 4)}` : null;

  return (
    <FieldShell def={def} assessment={assessment} controlId={id} labelId={`${id}-label`} issues={withDraftIssue} describedById={id} hint={def.hint}
      footer={
        <>
          {amountEcho && <p className="mt-1 text-xs text-navy-600">{amountEcho}</p>}
          {canonical?.converted && (
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-navy-700">
              Equivalent: {formatNumber(canonical.value, 4)} {unitLabel(canonical.unit, reader.currency)} (used internally)
              <AssumptionBadge kind="derived" />
            </p>
          )}
        </>
      }
    >
      <div className="mt-1.5 flex">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={isNA ? "" : draft.shown}
          disabled={isNA}
          placeholder={isNA ? "Not applicable" : "Enter a number"}
          aria-invalid={hasError}
          aria-required={def.required}
          aria-describedby={describedBy(id, !!def.hint)}
          className={cn(inputClass, "rounded-r-none border-r-0", hasError ? "border-red-600" : "border-navy-200")}
          onChange={(e) => draft.onChange(e.target.value)}
          onBlur={() => {
            setTouched(true);
            draft.onBlur();
          }}
        />
        <select
          aria-label={`Unit for ${def.label}`}
          value={qualifier}
          onChange={(e) => actions.setQNumber(def.id, { qualifier: e.target.value })}
          className={cn(suffixClass, "max-w-[11rem] rounded-r-lg px-2 py-2.5", hasError ? "border-red-600" : "border-navy-200")}
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {unitLabel(resolveUnit(o.unit, reader), reader.currency)}
            </option>
          ))}
        </select>
      </div>
      {def.allowNotApplicable && (
        <NotApplicableToggle
          checked={isNA}
          onChange={(on) => {
            actions.setQNumber(def.id, { value: on ? notApplicable() : missing() });
            setTouched(true);
          }}
        />
      )}
    </FieldShell>
  );
}
