import type { ReactNode } from "react";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";
import { TopBar } from "./top-bar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)] print:block">
      <a href="#main" className="sr-only z-50 print:hidden rounded-md bg-surface px-4 py-2 font-semibold focus:not-sr-only focus:absolute focus:left-4 focus:top-4">
        Skip to main content
      </a>
      <aside className="hidden print:hidden bg-navy-950 p-5 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="mb-8 px-1">
          <Logo href="/overview" light />
        </div>
        <NavLinks />
        <p className="mt-auto px-1 text-xs leading-relaxed text-navy-300">
          Academic decision-support prototype. Not financial or engineering advice.
        </p>
      </aside>
      <div className="min-w-0">
        <TopBar />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
