import type { ReactNode } from "react";

/** A formula on its own line, followed by what it means in plain words. */
export function Formula({ children, meaning }: { children: ReactNode; meaning?: ReactNode }) {
  return (
    <div className="my-3 rounded-lg border border-line bg-navy-50/70 px-4 py-3">
      <p className="overflow-x-auto font-mono text-[0.85rem] leading-relaxed text-navy-950">{children}</p>
      {meaning && <p className="mt-1.5 text-sm text-slate-700">{meaning}</p>}
    </div>
  );
}
