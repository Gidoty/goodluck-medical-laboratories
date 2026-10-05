import type { ReactNode } from "react";
import { PageHelpButton } from "@/guidance/HelpButtons";
import type { GuidanceId } from "@/guidance/types";

export function PageHeader({ eyebrow, title, description, action, help }: { eyebrow?: string; title: string; description?: ReactNode; action?: ReactNode; help?: GuidanceId }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-3xl">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-forest-700">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-navy-950 sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 text-base text-slate-600">{description}</p>}
        {help && <PageHelpButton id={help} className="-ml-2.5 mt-1" />}
      </div>
      {action}
    </header>
  );
}
