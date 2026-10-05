import { Check } from "lucide-react";
import Link from "next/link";
import type { StepCompletion } from "@/domain/assessmentValidation";
import { ASSESSMENT_STEPS, type StepId } from "@/domain/steps";
import { cn } from "@/lib/cn";

export function StepProgress({ current, completion }: { current: StepId; completion: Record<string, StepCompletion | undefined> }) {
  return (
    <nav aria-label="Assessment steps">
      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {ASSESSMENT_STEPS.map((s) => {
          const done = completion[s.id]?.state === "complete";
          const active = s.id === current;
          return (
            <li key={s.id}>
              <Link
                href={`/assessment/${s.id}`}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex h-full flex-col gap-2 rounded-xl border p-3 text-left transition-colors",
                  active ? "border-forest-600 bg-forest-50" : "border-line bg-surface hover:bg-navy-50",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 place-items-center rounded-full text-xs font-bold",
                    done ? "bg-forest-700 text-white" : active ? "bg-navy-900 text-white" : "bg-navy-100 text-navy-700",
                  )}
                >
                  {done ? <Check aria-hidden className="size-4" /> : s.number}
                  {done && <span className="sr-only">Complete: </span>}
                </span>
                <span className="text-xs font-semibold leading-tight text-navy-900 sm:text-sm">
                  <span className="sm:hidden">{s.short}</span>
                  <span className="hidden sm:inline">{s.title}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
