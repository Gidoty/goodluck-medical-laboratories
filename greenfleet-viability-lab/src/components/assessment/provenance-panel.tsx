"use client";

import { useId, useState } from "react";
import { missing, type NumericField } from "@/domain/fieldValue";
import type { FieldDef } from "@/domain/schema/types";
import { SOURCE_TYPES, type Assessment } from "@/domain/stored";
import { useAssessmentActions } from "@/state/StoreProvider";
import { inputClass } from "./field-shell";
import { useNumericDraft } from "./numeric-draft";

/** Optional "where did this number come from?" panel. Never required, collapsed by default. */
export function ProvenancePanel({ def, assessment }: { def: FieldDef; assessment: Assessment }) {
  const actions = useAssessmentActions();
  const id = useId();
  const entry = assessment.provenance[def.id];
  const year: NumericField = entry?.year ?? missing();
  const draft = useNumericDraft(year, (f) => actions.setProvenance(def.id, { year: f }));
  const [open] = useState(() => entry !== undefined && (entry.source !== null || entry.reference !== ""));
  const yearBad = draft.notANumber || (year.status === "value" && (!Number.isInteger(year.value) || year.value < 1900 || year.value > 2100));

  return (
    <details className="mt-2 text-xs" open={open}>
      <summary className="w-fit cursor-pointer font-medium text-navy-600 underline underline-offset-2 hover:text-navy-900">Where did this number come from? (optional)</summary>
      <div className="mt-2 grid gap-3 rounded-lg border border-line bg-navy-50/60 p-3 sm:grid-cols-3">
        <div>
          <label htmlFor={`${id}-type`} className="font-semibold text-navy-900">
            Source type
          </label>
          <select id={`${id}-type`} value={entry?.source ?? ""} className={`${inputClass} mt-1 border-navy-200 py-2`} onChange={(e) => actions.setProvenance(def.id, { source: e.target.value === "" ? null : (e.target.value as (typeof SOURCE_TYPES)[number]["id"]) })}>
            <option value="">Not stated</option>
            {SOURCE_TYPES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-ref`} className="font-semibold text-navy-900">
            Name or reference
          </label>
          <input id={`${id}-ref`} type="text" value={entry?.reference ?? ""} className={`${inputClass} mt-1 border-navy-200 py-2`} onChange={(e) => actions.setProvenance(def.id, { reference: e.target.value })} />
        </div>
        <div>
          <label htmlFor={`${id}-year`} className="font-semibold text-navy-900">
            Year
          </label>
          <input id={`${id}-year`} type="text" inputMode="numeric" value={draft.shown} aria-invalid={yearBad} aria-describedby={yearBad ? `${id}-year-err` : undefined} className={`${inputClass} mt-1 py-2 ${yearBad ? "border-red-600" : "border-navy-200"}`} onChange={(e) => draft.onChange(e.target.value)} onBlur={draft.onBlur} />
          {yearBad && (
            <p id={`${id}-year-err`} className="mt-1 font-medium text-red-800">
              Enter a four-digit year, for example 2026.
            </p>
          )}
        </div>
      </div>
    </details>
  );
}
