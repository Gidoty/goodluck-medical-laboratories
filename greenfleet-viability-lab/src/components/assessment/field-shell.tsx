"use client";

import { AlertCircle, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { AssumptionBadge } from "@/components/ui/assumption-badge";
import { HelpTip } from "@/components/ui/help-tip";
import { GLOSSARY } from "@/content/glossary";
import { DEMO_LABEL } from "@/domain/demo";
import type { FieldIssue } from "@/domain/checks";
import type { FieldDef } from "@/domain/schema/types";
import type { Assessment } from "@/domain/stored";
import { cn } from "@/lib/cn";

export interface ControlProps {
  def: FieldDef;
  assessment: Assessment;
  issues: FieldIssue[];
  /** Show blocking errors even if the user has not touched the field yet (after pressing Next, or on review). */
  showIssues: boolean;
}

export const inputClass =
  "block w-full min-w-0 rounded-lg border bg-surface px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-300 disabled:bg-navy-50 disabled:text-navy-400";

export function visibleIssues(issues: FieldIssue[], touched: boolean, showIssues: boolean): FieldIssue[] {
  return issues.filter((i) => i.severity === "warning" || touched || showIssues);
}

interface ShellProps {
  def: FieldDef;
  assessment: Assessment;
  /** id of the single form control this label belongs to; omit for grouped controls (radio sets). */
  controlId?: string;
  labelId: string;
  issues: FieldIssue[];
  describedById: string;
  hint?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function FieldShell({ def, assessment, controlId, labelId, issues, describedById, hint, children, footer }: ShellProps) {
  const illustrative = assessment.illustrative.includes(def.id) && (def.kind === "number" || def.kind === "qnumber");
  const source = assessment.provenance[def.id]?.source;
  const sourced = source !== null && source !== undefined && source !== "user_estimate";
  const labelClass = "text-sm font-semibold text-navy-900";
  return (
    <div id={`field-${def.id}`} className="min-w-0">
      <div className="relative flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {controlId ? (
          <label id={labelId} htmlFor={controlId} className={labelClass}>
            {def.label}
          </label>
        ) : (
          <span id={labelId} className={labelClass}>
            {def.label}
          </span>
        )}
        {!def.required && <span className="text-xs font-normal text-slate-600">(optional)</span>}
        {def.glossary && <HelpTip term={def.glossary} />}
        {(illustrative || sourced) && (
          <span className="ml-auto flex gap-1">
            {illustrative && <AssumptionBadge kind="illustrative" />}
            {sourced && <AssumptionBadge kind="sourced" />}
          </span>
        )}
      </div>
      {children}
      {hint && (
        <p id={`${describedById}-hint`} className="mt-1.5 text-xs text-slate-600">
          {hint}
        </p>
      )}
      <div id={`${describedById}-issues`} aria-live="polite">
        {issues.map((i) => (
          <p key={i.code + i.message} className={cn("mt-1.5 flex items-start gap-1.5 text-xs font-medium", i.severity === "error" ? "text-red-800" : "text-amber-900")}>
            {i.severity === "error" ? <AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" /> : <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />}
            <span>
              <span className="sr-only">{i.severity === "error" ? "Error: " : "Warning: "}</span>
              {i.message}
            </span>
          </p>
        ))}
        {def.required && issues.some((i) => i.code === "missing") && (
          <details className="mt-1 text-xs text-slate-700">
            <summary className="w-fit cursor-pointer font-medium text-navy-700 underline underline-offset-2">Why is this required?</summary>
            <p className="mt-1">
              {GLOSSARY[def.glossary ?? ""]?.text ? `${GLOSSARY[def.glossary ?? ""]?.text} ` : ""}
              GreenFleet needs this value to calculate the comparison, and it never fills a blank with an assumed figure.
            </p>
          </details>
        )}
      </div>
      {illustrative && <p className="mt-1 text-xs font-medium text-amber-900">{DEMO_LABEL}</p>}
      {footer}
    </div>
  );
}

export const describedBy = (id: string, hasHint: boolean) => `${hasHint ? `${id}-hint ` : ""}${id}-issues`;
