import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "./card";

/**
 * A metric tile. `value` is null until a calculation supplies one, which renders the empty state:
 * the component cannot show a made-up number because it never creates one.
 */
export function KpiCard({
  label,
  icon: Icon,
  value,
  unit,
  hint,
}: {
  label: string;
  icon: LucideIcon;
  value: ReactNode | null;
  unit?: string;
  hint: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
        <Icon aria-hidden className="size-4 text-forest-700" />
        {label}
      </div>
      <p className="mt-3 text-2xl font-semibold text-navy-950">
        {value === null ? (
          <span className="text-navy-300" aria-label="Not yet calculated">
            —
          </span>
        ) : (
          <>
            {value}
            {unit && <span className="ml-1 text-sm font-medium text-slate-600">{unit}</span>}
          </>
        )}
      </p>
      <p className="mt-1 text-xs text-slate-600">{hint}</p>
    </Card>
  );
}
