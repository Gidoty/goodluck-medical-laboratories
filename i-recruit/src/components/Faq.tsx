import { ChevronDown } from "lucide-react";

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-charcoal/15 border-y border-charcoal/15">
      {items.map((item) => (
        <details key={item.q} className="group">
          <summary className="flex cursor-pointer items-center justify-between gap-6 py-5 font-display text-2xl font-bold uppercase tracking-wide text-charcoal marker:content-none hover:text-orange-ink">
            {item.q}
            <ChevronDown className="faq-chevron h-6 w-6 shrink-0 text-orange-ink transition-transform" aria-hidden />
          </summary>
          <p className="max-w-3xl pb-6 text-muted">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
