"use client";

import { FlaskConical, Play, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
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
      <ConfirmDialog flow={blank} title="Start a blank assessment?" confirmLabel="Discard and start blank">Everything you have entered will be deleted from this browser. This cannot be undone.</ConfirmDialog>
      <ConfirmDialog flow={demo} title="Replace your work with the demo?" confirmLabel="Discard and load demo">Your current entries will be deleted and replaced with illustrative demo values. This cannot be undone.</ConfirmDialog>
      <ConfirmDialog flow={reset} title="Reset this assessment?" confirmLabel="Delete my entries">All entered values, sources and notes will be deleted from this browser. This cannot be undone.</ConfirmDialog>
    </>
  );
}
