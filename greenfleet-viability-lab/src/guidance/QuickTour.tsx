"use client";

import Link from "next/link";
import { useGuidance } from "./context";
import { TOUR_STEPS } from "./content";
import { useModalDialog } from "./useModalDialog";

/** A short, skippable tour of the main areas. It explains; it never highlights, clicks or edits anything. */
export function QuickTour() {
  const { state, dispatch } = useGuidance();
  const { open, step } = state.tour;
  const dialog = useModalDialog(open, () => dispatch({ type: "tour_close" }));
  const s = TOUR_STEPS[step];
  const last = step === TOUR_STEPS.length - 1;
  return (
    <dialog
      {...dialog}
      aria-labelledby="tour-title"
      className="m-auto w-[min(30rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-card border border-line bg-surface p-0 text-navy-900 shadow-raised backdrop:bg-navy-950/50 max-sm:mb-3 max-sm:mt-auto"
    >
      {open && s && (
        <div className="p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-forest-700" aria-live="polite">Quick tour: step {step + 1} of {TOUR_STEPS.length}</p>
          <h2 id="tour-title" className="mt-1 text-xl font-semibold text-navy-950">{s.title}</h2>
          <p className="mt-1 text-xs font-medium text-slate-600">{s.where}</p>
          <p className="mt-3 text-sm leading-relaxed text-navy-800">{s.body}</p>
          <p className="mt-3"><Link href={s.href} onClick={() => dispatch({ type: "tour_close" })} className="text-sm font-semibold text-forest-800 underline underline-offset-2">Open this page</Link></p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => dispatch({ type: "tour_back" })} disabled={step === 0} className="min-h-11 rounded-lg border border-navy-200 bg-surface px-4 py-2 text-sm font-semibold text-navy-800 hover:bg-navy-50 disabled:opacity-50">Back</button>
            {last ? (
              <button type="button" onClick={() => dispatch({ type: "tour_finish" })} className="min-h-11 rounded-lg bg-forest-700 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-800">Finish</button>
            ) : (
              <button type="button" onClick={() => dispatch({ type: "tour_next" })} autoFocus className="min-h-11 rounded-lg bg-forest-700 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-800">Next</button>
            )}
            <button type="button" onClick={() => dispatch({ type: "tour_skip" })} className="ml-auto min-h-11 rounded-lg px-3 py-2 text-sm font-semibold text-navy-700 hover:bg-navy-100">Skip tour</button>
          </div>
        </div>
      )}
    </dialog>
  );
}
