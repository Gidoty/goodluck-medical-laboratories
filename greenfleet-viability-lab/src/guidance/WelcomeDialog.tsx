"use client";

import Link from "next/link";
import { useGuidance } from "./context";
import { WELCOME } from "./content";
import { useModalDialog } from "./useModalDialog";

export function WelcomeDialog({ open }: { open: boolean }) {
  const { dispatch } = useGuidance();
  const dialog = useModalDialog(open, () => dispatch({ type: "welcome_dismiss" }));
  return (
    <dialog
      {...dialog}
      aria-labelledby="welcome-title"
      className="m-auto w-[min(34rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-card border border-line bg-surface p-0 text-navy-900 shadow-raised backdrop:bg-navy-950/50"
    >
      {open && (
        <div className="p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-forest-700">First visit</p>
          <h2 id="welcome-title" className="mt-1 text-2xl font-semibold text-navy-950">{WELCOME.title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-navy-800">{WELCOME.text}</p>
          <ol className="mt-4 space-y-2" aria-label="The four steps">
            {WELCOME.journey.map((j, i) => (
              <li key={j.title} className="flex items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-forest-100 text-xs font-bold text-forest-900">{i + 1}</span>
                <span className="text-sm"><span className="font-semibold text-navy-950">{j.title}</span><span className="block text-slate-600">{j.text}</span></span>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/assessment/business" onClick={() => dispatch({ type: "welcome_start" })} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-forest-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-800">Start Assessment</Link>
            <button type="button" onClick={() => dispatch({ type: "tour_start" })} className="min-h-11 rounded-lg border border-navy-200 bg-surface px-4 py-2.5 text-sm font-semibold text-navy-800 hover:bg-navy-50">Take a Quick Tour</button>
            <button type="button" onClick={() => dispatch({ type: "welcome_skip" })} className="min-h-11 rounded-lg px-4 py-2.5 text-sm font-semibold text-navy-700 hover:bg-navy-100">Skip for now</button>
          </div>
          <p className="mt-4 text-xs text-slate-600">You can open Help at any time from the top of every page. Nothing here changes your data.</p>
        </div>
      )}
    </dialog>
  );
}
