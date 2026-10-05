import { AlertTriangle, CheckCircle2, CircleHelp, XCircle } from "lucide-react";
import type { ViabilityStatus } from "@/domain/types";
import { cn } from "@/lib/cn";

/**
 * Presentation only. This component displays a status it is given; it never decides one.
 * The rules that assign a status live in src/calculation/viability (Commercial Viability Policy).
 */
const CONFIG = {
  viable: { label: "VIABLE", Icon: CheckCircle2, style: "border-forest-300 bg-forest-50 text-forest-900" },
  conditionally_viable: { label: "CONDITIONALLY VIABLE", Icon: AlertTriangle, style: "border-amber-300 bg-amber-50 text-amber-950" },
  not_yet_viable: { label: "NOT YET VIABLE", Icon: XCircle, style: "border-red-300 bg-red-50 text-red-900" },
  insufficient_evidence: { label: "INSUFFICIENT EVIDENCE", Icon: CircleHelp, style: "border-slate-400 bg-slate-100 text-slate-800" },
} as const satisfies Record<ViabilityStatus, { label: string; Icon: typeof XCircle; style: string }>;

export const VIABILITY_LABEL: Record<ViabilityStatus, string> = {
  viable: CONFIG.viable.label,
  conditionally_viable: CONFIG.conditionally_viable.label,
  not_yet_viable: CONFIG.not_yet_viable.label,
  insufficient_evidence: CONFIG.insufficient_evidence.label,
};

export function StatusBadge({ status, size = "md" }: { status: ViabilityStatus; size?: "sm" | "md" | "lg" }) {
  const { label, Icon, style } = CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-bold tracking-wide",
        style,
        size === "sm" && "px-2.5 py-0.5 text-[0.7rem]",
        size === "md" && "px-3 py-1 text-xs",
        size === "lg" && "px-4 py-1.5 text-sm",
      )}
    >
      <Icon aria-hidden className={size === "lg" ? "size-5" : "size-4"} />
      {label}
    </span>
  );
}
