"use client";

import { ArrowLeft, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { DISCLAIMER } from "./content";
import { useGuidance } from "./context";
import { GuidanceBody } from "./GuidanceBody";
import { getGuidance, helpTopics, relatedEntries } from "./registry";
import { useModalDialog } from "./useModalDialog";
import type { GuidanceId } from "./types";

/**
 * Side panel on wide screens, bottom sheet on phones. It opens on the guidance for the page the
 * user is on, and lets them browse the other topics from the Help index.
 */
export function HelpDrawer() {
  const { state, pageId, closeHelp, startTour } = useGuidance();
  const open = state.help.open;
  const dialog = useModalDialog(open, closeHelp);
  return (
    <dialog
      {...dialog}
      aria-labelledby="help-title"
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-[27rem] max-w-full border-l border-line bg-surface p-0 text-navy-900 shadow-raised backdrop:bg-navy-950/40 max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:h-auto max-sm:max-h-[88dvh] max-sm:w-full max-sm:rounded-t-2xl max-sm:border-l-0 max-sm:border-t"
    >
      {/* Mounted only while open, so it starts fresh on the current page each time. */}
      {open && <HelpPanel startId={state.help.id ?? pageId} pageId={pageId} closeHelp={closeHelp} startTour={startTour} />}
    </dialog>
  );
}

function HelpPanel({ startId, pageId, closeHelp, startTour }: { startId: GuidanceId; pageId: GuidanceId; closeHelp: () => void; startTour: () => void }) {
  const [viewId, setViewId] = useState<GuidanceId>(startId);
  const [showIndex, setShowIndex] = useState(false);
  const content = getGuidance(viewId);
  const related = relatedEntries(viewId);
  const go = (id: GuidanceId) => {
    setViewId(id);
    setShowIndex(false);
  };
  return (
    <div className="flex max-h-[inherit] min-h-0 flex-col sm:h-dvh">
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-forest-700">Help</p>
          <h2 id="help-title" className="text-lg font-semibold text-navy-950">{showIndex ? "Help topics" : content.title}</h2>
        </div>
        <button type="button" onClick={closeHelp} className="grid size-11 shrink-0 place-items-center rounded-lg text-navy-700 hover:bg-navy-100">
          <X aria-hidden className="size-5" />
          <span className="sr-only">Close help</span>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {showIndex ? (
          <nav aria-label="Help topics">
            <ul className="space-y-2">
              {helpTopics().map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => go(t.entries[0]!)} className="flex min-h-11 w-full items-center rounded-lg border border-line px-3 py-2 text-left text-sm font-semibold text-navy-900 hover:bg-navy-50">{t.title}</button>
                </li>
              ))}
            </ul>
          </nav>
        ) : (
          <>
            {viewId !== pageId && (
              <button type="button" onClick={() => go(pageId)} className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-forest-800 underline underline-offset-2">
                <ArrowLeft aria-hidden className="size-4" /> Back to help for this page
              </button>
            )}
            <GuidanceBody content={content} onNavigate={closeHelp} />
            {related.length > 0 && (
              <div className="mt-5 border-t border-line pt-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-forest-800">Reading each part of the results</h3>
                <ul className="mt-2 space-y-1.5">
                  {related.map((id) => (
                    <li key={id}><button type="button" onClick={() => go(id)} className="min-h-11 w-full rounded-lg border border-line px-3 py-2 text-left text-sm font-semibold text-navy-900 hover:bg-navy-50">{getGuidance(id).title}</button></li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      <div className="space-y-2 border-t border-line bg-navy-50/60 px-5 py-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setShowIndex((v) => !v)} className="min-h-11 rounded-lg border border-navy-200 bg-surface px-3 py-2 text-sm font-semibold text-navy-800 hover:bg-navy-50">{showIndex ? "Help for this page" : "All help topics"}</button>
          <button type="button" onClick={startTour} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-navy-200 bg-surface px-3 py-2 text-sm font-semibold text-navy-800 hover:bg-navy-50"><RotateCcw aria-hidden className="size-4" /> Restart Quick Tour</button>
        </div>
        <p className="text-xs text-slate-600">{DISCLAIMER}</p>
      </div>
    </div>
  );
}
