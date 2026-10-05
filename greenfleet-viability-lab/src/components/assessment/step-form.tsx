"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import type { FieldIssue } from "@/domain/checks";
import { createReader } from "@/domain/reader";
import { FIELDS } from "@/domain/schema/fields";
import { SECTIONS } from "@/domain/schema/sections";
import type { SectionDef } from "@/domain/schema/types";
import type { StepId } from "@/domain/steps";
import type { Assessment } from "@/domain/stored";
import { InheritedBevValues, OperationsPreview } from "./derived-previews";
import { FieldControl } from "./field-control";

interface Props {
  stepId: StepId;
  assessment: Assessment;
  issues: FieldIssue[];
  showIssues: boolean;
}

export function StepForm({ stepId, assessment, issues, showIssues }: Props) {
  const reader = useMemo(() => createReader(assessment), [assessment]);
  const blocks = SECTIONS.filter((s) => s.step === stepId)
    .map((section) => ({ section, fields: FIELDS.filter((f) => f.section === section.id && reader.isVisible(f.id)) }))
    .filter(({ section, fields }) => fields.length > 0 || section.emptyNote);

  return (
    <div className="space-y-8">
      {blocks.map(({ section, fields }, i) => {
        const heading = section.group && section.group !== blocks[i - 1]?.section.group ? section.group : null;
        return (
          <div key={section.id}>
            {heading && <h3 className="mb-4 border-b border-line pb-2 text-base font-semibold text-forest-800">{heading}</h3>}
            <SectionBlock section={section} assessment={assessment} issues={issues} hasFields={fields.length > 0}>
              <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
                {fields.map((f) => (
                  <FieldControl key={f.id} def={f} assessment={assessment} issues={issues.filter((i) => i.fieldId === f.id)} showIssues={showIssues} />
                ))}
              </div>
              {section.id === "operating" && <div className="mt-5"><OperationsPreview assessment={assessment} /></div>}
              {section.id === "bev-ops" && <div className="mt-5"><InheritedBevValues assessment={assessment} /></div>}
              {section.id === "bio-supply" && reader.choice("biofuel.specialInfrastructure") === "yes" && (
                <Alert tone="info" className="mt-5">
                  Special storage or infrastructure is needed, so enter its costs in{" "}
                  <Link href="/assessment/finance#section-fin-bio-infra" className="font-semibold underline underline-offset-2">
                    Step 5: Finance & Infrastructure
                  </Link>
                  .
                </Alert>
              )}
              {!fields.length && section.emptyNote && <p className="text-sm text-slate-600">{section.emptyNote}</p>}
            </SectionBlock>
          </div>
        );
      })}
    </div>
  );
}

function SectionBlock({ section, assessment, issues, hasFields, children }: { section: SectionDef; assessment: Assessment; issues: FieldIssue[]; hasFields: boolean; children: ReactNode }) {
  const anchor = `section-${section.id}`;
  const collapsible = section.kind !== "plain";
  // Open from the start if the section already holds answers or problems, so nothing is hidden from the user.
  // The form mounts only after saved work has loaded, so reading the URL here cannot cause a hydration mismatch.
  const [startOpen] = useState(() => collapsible && ((typeof window !== "undefined" && window.location.hash === `#${anchor}`) || issues.some((i) => i.sectionId === section.id) || sectionHasEntries(section.id, assessment)));

  if (!collapsible) {
    return (
      <div id={anchor} role="group" aria-labelledby={`${anchor}-title`} className="scroll-mt-28">
        <h4 id={`${anchor}-title`} className="text-sm font-semibold uppercase tracking-wide text-navy-700">
          {section.title}
        </h4>
        {section.description && <p className="mt-1 text-sm text-slate-600">{section.description}</p>}
        <div className="mt-4">{children}</div>
      </div>
    );
  }
  return (
    <details id={anchor} open={startOpen || undefined} className="group scroll-mt-28 rounded-xl border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 marker:hidden [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-sm font-semibold text-navy-950">
            {section.title}
            <span className="ml-2 text-xs font-normal text-slate-600">{section.kind === "advanced" ? "optional" : hasFields ? "optional section" : ""}</span>
          </span>
          {section.description && <span className="mt-0.5 block text-xs text-slate-600">{section.description}</span>}
        </span>
        <span aria-hidden className="text-navy-500 transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}

function sectionHasEntries(sectionId: string, a: Assessment): boolean {
  return FIELDS.some((f) => {
    if (f.section !== sectionId) return false;
    const raw = a.inputs[f.id];
    if (typeof raw === "string") return raw.trim() !== "" && f.kind === "text";
    if (raw && typeof raw === "object") {
      if ("qualifier" in raw) return raw.value.status !== "missing";
      if (f.kind === "choice" && f.defaultValue !== undefined) return raw.status === "value" && raw.value !== f.defaultValue;
      return raw.status !== "missing";
    }
    return false;
  });
}
