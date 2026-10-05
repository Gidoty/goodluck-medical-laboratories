import { cn } from "@/lib/cn";

export type AssumptionKind = "user" | "illustrative" | "sourced" | "derived" | "convention" | "excluded";

const CONFIG: Record<AssumptionKind, { label: string; style: string; title: string }> = {
  user: { label: "USER INPUT", style: "border-line bg-navy-50 text-navy-700", title: "Entered by you." },
  illustrative: { label: "ILLUSTRATIVE ASSUMPTION", style: "border-amber-300 bg-amber-50 text-amber-950", title: "A placeholder to show how the tool works. Not current market data." },
  sourced: { label: "SOURCED VALUE", style: "border-forest-300 bg-forest-50 text-forest-900", title: "You named a source for this number." },
  derived: { label: "DERIVED VALUE", style: "border-navy-300 bg-navy-100 text-navy-900", title: "Worked out from your other inputs. Not entered directly." },
  convention: { label: "MODEL CONVENTION", style: "border-navy-300 bg-surface text-navy-900", title: "A fixed rule of the calculation, not something you entered." },
  excluded: { label: "MISSING / EXCLUDED", style: "border-red-300 bg-red-50 text-red-900", title: "Not entered, or deliberately left out of the primary calculation." },
};

export function AssumptionBadge({ kind, className }: { kind: AssumptionKind; className?: string }) {
  const c = CONFIG[kind];
  return (
    <span title={c.title} className={cn("inline-flex items-center whitespace-nowrap rounded border px-1.5 py-px text-[0.65rem] font-bold tracking-wide", c.style, className)}>
      {c.label}
    </span>
  );
}
