import { PageHelpButton } from "@/guidance/HelpButtons";
import { getGuidance, STEP_GUIDANCE } from "@/guidance/registry";
import type { StepId } from "@/domain/steps";

/** One or two plain sentences at the top of each step. The full guidance is one click away. */
export function StepGuidanceNote({ stepId }: { stepId: StepId }) {
  const g = getGuidance(STEP_GUIDANCE[stepId]);
  return (
    <div className="mb-5 rounded-xl border border-forest-200 bg-forest-50/50 p-3 text-sm text-navy-900" data-testid="step-guidance">
      {g.whatYouAreDoing && <p><span className="font-semibold">In this step: </span>{g.whatYouAreDoing}</p>}
      {g.whatHappensNext && <p className="mt-1"><span className="font-semibold">Next: </span>{g.whatHappensNext}</p>}
      <PageHelpButton id={g.id} label="More help for this step" className="-ml-2.5 mt-1 min-h-9" />
    </div>
  );
}
