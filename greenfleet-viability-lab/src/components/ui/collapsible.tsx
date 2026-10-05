import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

/** Native <details>: keyboard and screen-reader support come from the browser. */
export function Collapsible({ title, summary, defaultOpen, children }: { title: string; summary?: string; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details open={defaultOpen} className="group rounded-card border border-line bg-surface shadow-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-card px-5 py-4 marker:hidden sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-base font-semibold text-navy-950">{title}</span>
          {summary && <span className="mt-0.5 block text-sm text-slate-600">{summary}</span>}
        </span>
        <ChevronDown aria-hidden className="size-5 shrink-0 text-navy-500 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-line px-5 py-5 text-sm leading-relaxed text-navy-800 sm:px-6">{children}</div>
    </details>
  );
}
