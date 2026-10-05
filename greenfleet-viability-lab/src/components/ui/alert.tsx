import { AlertTriangle, Info, FlaskConical } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "info" | "warning" | "demo";

const STYLE: Record<Tone, string> = {
  info: "border-navy-200 bg-navy-50 text-navy-900",
  warning: "border-amber-300 bg-amber-50 text-amber-950",
  demo: "border-forest-200 bg-forest-50 text-forest-900",
};
const ICON = { info: Info, warning: AlertTriangle, demo: FlaskConical } as const;

export function Alert({ tone = "info", title, children, className }: { tone?: Tone; title?: string; children: ReactNode; className?: string }) {
  const Icon = ICON[tone];
  return (
    <div role={tone === "warning" ? "alert" : "note"} className={cn("flex gap-3 rounded-xl border p-4 text-sm", STYLE[tone], className)}>
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div className={cn(title && "mt-1")}>{children}</div>
      </div>
    </div>
  );
}
