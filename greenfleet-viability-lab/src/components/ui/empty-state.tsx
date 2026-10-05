import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-navy-200 bg-surface px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-navy-50 text-navy-500">
        <Icon aria-hidden className="size-6" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-navy-950">{title}</h3>
      {children && <div className="mt-1 max-w-md text-sm text-slate-600">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
