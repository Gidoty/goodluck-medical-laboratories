"use client";

import { FlaskConical, Play, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { DEMO_CASES, DEMO_NOTICE, type DemoCaseId } from "@/domain/demo";
import { isUntouched } from "@/domain/mutations";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, useConfirmedAction } from "@/components/ui/confirm-dialog";
import { FIRST_STEP } from "@/domain/steps";
import { useAssessmentActions, useAssessmentState } from "@/state/StoreProvider";

const FIRST = `/assessment/${FIRST_STEP}`;

/**
 * Starting points. A blank assessment is the primary path; the demo exists only to try the interface.
 * Anything that would discard entered work asks first.
 */
export function StartActions({ variant }: { variant: "overview" | "compact" }) {
  const { assessment } = useAssessmentState();
  const actions = useAssessmentActions();
  const router = useRouter();
  const hasWork = !isUntouched(assessment);

  const blank = useConfirmedAction(() => {
    actions.reset();
    router.push(FIRST);
  });
  const demo = useConfirmedAction(() => {
    actions.loadDemo();
    router.push(FIRST);
  });
  const reset = useConfirmedAction(actions.reset);

  // The case is chosen before the confirmation question, so the confirmed action reads it from a ref.
  const chosenCase = useRef<DemoCaseId | undefined>(undefined);
  const demoCase = useConfirmedAction(() => {
    actions.loadDemo(chosenCase.current);
    router.push(FIRST);
  });
  const loadCase = (id: DemoCaseId) => {
    chosenCase.current = id;
    if (hasWork) demoCase.request();
    else {
      actions.loadDemo(id);
      router.push(FIRST);
    }
  };

  const startBlank = () => (hasWork ? blank.request() : router.push(FIRST));
  const loadDemo = () => (hasWork ? demo.request() : (actions.loadDemo(), router.push(FIRST)));

  return (
    <>
      {variant === "overview" ? (
        <div className="flex flex-wrap gap-3">
          <Button onClick={startBlank}><Play aria-hidden className="size-4" /> Start Blank Assessment</Button>
          <Button variant="secondary" onClick={loadDemo}><FlaskConical aria-hidden className="size-4" /> Load Demo Assessment</Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={loadDemo}><FlaskConical aria-hidden className="size-4" /> Load Demo Assessment</Button>
          <Button variant="ghost" size="sm" onClick={() => (hasWork ? reset.request() : undefined)} disabled={!hasWork}><RotateCcw aria-hidden className="size-4" /> Reset Assessment</Button>
        </div>
      )}
      <DemoCaseMenu onLoad={loadCase} onBlank={startBlank} showBlank={assessment.origin === "demo"} />
      <ConfirmDialog flow={demoCase} title="Replace your work with this demonstration case?" confirmLabel="Discard and load case">Your current entries will be deleted and replaced with synthetic demonstration values. This cannot be undone.</ConfirmDialog>
      <ConfirmDialog flow={blank} title="Start a blank assessment?" confirmLabel="Discard and start blank">Everything you have entered will be deleted from this browser. This cannot be undone.</ConfirmDialog>
      <ConfirmDialog flow={demo} title="Replace your work with the demo?" confirmLabel="Discard and load demo">Your current entries will be deleted and replaced with illustrative demo values. This cannot be undone.</ConfirmDialog>
      <ConfirmDialog flow={reset} title="Reset this assessment?" confirmLabel="Delete my entries">All entered values, sources and notes will be deleted from this browser. This cannot be undone.</ConfirmDialog>
    </>
  );
}

/**
 * The five synthetic demonstration cases. A native <details> keeps this keyboard and screen-reader accessible
 * without custom focus handling. Loading a case goes through the same confirmation as any action that discards work.
 */
function DemoCaseMenu({ onLoad, onBlank, showBlank }: { onLoad: (id: DemoCaseId) => void; onBlank: () => void; showBlank: boolean }) {
  return (
    <details className="mt-3 rounded-lg border border-line bg-surface">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-sm font-semibold text-navy-800"><FlaskConical aria-hidden className="size-4" /> Synthetic demonstration cases</summary>
      <div className="space-y-2 border-t border-line p-3">
        <p className="text-xs font-medium text-amber-900">SYNTHETIC DEMONSTRATION CASES. {DEMO_NOTICE}</p>
        <ul className="space-y-2">
          {DEMO_CASES.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => onLoad(c.id)} className="min-h-11 w-full rounded-lg border border-line px-3 py-2 text-left hover:bg-navy-50">
                <span className="block text-sm font-semibold text-navy-950">Case {c.number}: {c.title}</span>
                <span className="mt-0.5 block text-xs text-slate-700">{c.purpose}</span>
              </button>
            </li>
          ))}
        </ul>
        {showBlank && <button type="button" onClick={onBlank} className="min-h-11 rounded-lg border border-navy-200 px-3 py-2 text-sm font-semibold text-navy-800 hover:bg-navy-50">Return to Blank Assessment</button>}
      </div>
    </details>
  );
}
