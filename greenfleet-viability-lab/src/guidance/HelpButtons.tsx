"use client";

import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/cn";
import { useGuidance } from "./context";
import type { GuidanceId } from "./types";

/** Global Help control for the top bar and site header. Opens help for the current page. */
export function HelpButton({ className }: { className?: string }) {
  const { openHelp, state } = useGuidance();
  return (
    <button
      type="button"
      onClick={() => openHelp()}
      aria-haspopup="dialog"
      aria-expanded={state.help.open}
      className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-navy-200 bg-surface px-3 py-2 text-sm font-semibold text-navy-800 hover:bg-navy-50", className)}
    >
      <CircleHelp aria-hidden className="size-5" />
      Help
    </button>
  );
}

/** Small control that opens the guidance for a page or a part of a page. */
export function PageHelpButton({ id, label = "How to use this page", className }: { id?: GuidanceId; label?: string; className?: string }) {
  const { openHelp, state } = useGuidance();
  return (
    <button
      type="button"
      onClick={() => openHelp(id)}
      aria-haspopup="dialog"
      aria-expanded={state.help.open}
      className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-forest-800 underline-offset-2 hover:bg-forest-50 hover:underline", className)}
    >
      <CircleHelp aria-hidden className="size-4" />
      {label}
    </button>
  );
}
