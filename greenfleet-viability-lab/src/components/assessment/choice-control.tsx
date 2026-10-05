"use client";

import { useId, useState } from "react";
import { createReader } from "@/domain/reader";
import type { ChoiceDef, TextDef } from "@/domain/schema/types";
import { cn } from "@/lib/cn";
import { useAssessmentActions } from "@/state/StoreProvider";
import { describedBy, FieldShell, inputClass, visibleIssues, type ControlProps } from "./field-shell";

export function ChoiceControl({ def, assessment, issues, showIssues }: ControlProps & { def: ChoiceDef }) {
  const actions = useAssessmentActions();
  const id = useId();
  const current = createReader(assessment).choice(def.id);
  const [touched, setTouched] = useState(false);
  const shown = visibleIssues(issues, touched, showIssues);
  const hasError = shown.some((i) => i.severity === "error");
  const set = (option: string | null) => {
    actions.setChoice(def.id, option);
    setTouched(true);
  };

  if (def.presentation === "switch") {
    const on = current === def.switchOn;
    const off = def.options.find((o) => o.id !== def.switchOn)?.id ?? null;
    return (
      <div id={`field-${def.id}`} className="min-w-0 sm:col-span-2">
        <label className="flex w-fit cursor-pointer items-center gap-3 text-sm font-semibold text-navy-900">
          <input type="checkbox" checked={on} className="size-5 accent-forest-700" aria-describedby={describedBy(id, !!def.hint)} onChange={(e) => set(e.target.checked ? (def.switchOn ?? null) : off)} />
          {def.label}
        </label>
        {def.hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-600">
            {def.hint}
          </p>
        )}
        <div id={`${id}-issues`} aria-live="polite" />
      </div>
    );
  }

  if (def.presentation === "radio") {
    return (
      <FieldShell def={def} assessment={assessment} labelId={`${id}-label`} issues={shown} describedById={id} hint={def.hint}>
        <div role="radiogroup" aria-labelledby={`${id}-label`} aria-describedby={describedBy(id, !!def.hint)} aria-required={def.required} className="mt-2 space-y-2">
          {def.options.map((o) => (
            <label key={o.id} className="flex cursor-pointer items-start gap-2.5 text-sm text-navy-900">
              <input type="radio" name={id} value={o.id} checked={current === o.id} className="mt-0.5 size-4 accent-forest-700" onChange={() => set(o.id)} />
              {o.label}
            </label>
          ))}
          {!def.required && current !== undefined && (
            <button type="button" className="text-xs font-medium text-navy-600 underline underline-offset-2 hover:text-navy-900" onClick={() => set(null)}>
              Clear selection
            </button>
          )}
        </div>
      </FieldShell>
    );
  }

  return (
    <FieldShell def={def} assessment={assessment} controlId={id} labelId={`${id}-label`} issues={shown} describedById={id} hint={def.hint}>
      <select
        id={id}
        value={current ?? ""}
        aria-invalid={hasError}
        aria-required={def.required}
        aria-describedby={describedBy(id, !!def.hint)}
        className={cn(inputClass, "mt-1.5", hasError ? "border-red-600" : "border-navy-200")}
        onChange={(e) => set(e.target.value === "" ? null : e.target.value)}
        onBlur={() => setTouched(true)}
      >
        {def.defaultValue === undefined && <option value="">Select…</option>}
        {def.options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function TextControl({ def, assessment, issues, showIssues }: ControlProps & { def: TextDef }) {
  const actions = useAssessmentActions();
  const id = useId();
  const current = createReader(assessment).text(def.id);
  const [touched, setTouched] = useState(false);
  const shown = visibleIssues(issues, touched, showIssues);
  const hasError = shown.some((i) => i.severity === "error");
  const common = {
    id,
    value: current,
    placeholder: def.placeholder,
    "aria-invalid": hasError,
    "aria-required": def.required,
    "aria-describedby": describedBy(id, !!def.hint),
    className: cn(inputClass, "mt-1.5", hasError ? "border-red-600" : "border-navy-200"),
    onBlur: () => setTouched(true),
  };
  return (
    <FieldShell def={def} assessment={assessment} controlId={id} labelId={`${id}-label`} issues={shown} describedById={id} hint={def.hint}>
      {def.multiline ? (
        <textarea rows={2} {...common} onChange={(e) => actions.setText(def.id, e.target.value)} />
      ) : (
        <input type="text" {...common} onChange={(e) => actions.setText(def.id, e.target.value)} />
      )}
    </FieldShell>
  );
}
