import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "forest" | "navy" | "amber" | "red";

const TONES: Record<Tone, string> = {
  neutral: "border-line bg-navy-50 text-navy-700",
  forest: "border-forest-200 bg-forest-50 text-forest-800",
  navy: "border-navy-200 bg-navy-100 text-navy-800",
  amber: "border-amber-300 bg-amber-50 text-amber-900",
  red: "border-red-300 bg-red-50 text-red-900",
};

export function Badge({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold", TONES[tone], className)}
      {...props}
    />
  );
}
