import type { ReactNode } from "react";

/** Keeps wide tables inside the viewport: the table scrolls, the page does not. */
export function ResponsiveTable({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="relative overflow-x-auto rounded-xl border border-line print:overflow-visible" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full min-w-[34rem] border-collapse text-left text-sm print:min-w-0 print:text-xs">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}
