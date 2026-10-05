import { Scale } from "lucide-react";
import { cn } from "@/lib/cn";
import { HOW_IT_WORKS, PATHWAYS } from "./pathways";

const TONE: Record<string, string> = {
  diesel: "bg-navy-100 text-navy-800",
  electric: "bg-forest-100 text-forest-800",
  biofuel: "bg-amber-100 text-amber-900",
};

export function PathwaysSection() {
  return (
    <section aria-labelledby="pathways-title" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <h2 id="pathways-title" className="text-2xl font-semibold tracking-tight text-navy-950 sm:text-3xl">Three pathways, one fair comparison</h2>
      <p className="mt-2 max-w-2xl text-slate-600">GreenFleet evaluates each technology under the operating and financial conditions you enter.</p>
      <ul className="mt-8 grid gap-5 md:grid-cols-3">
        {PATHWAYS.map(({ id, name, role, summary, icon: Icon }) => (
          <li key={id} className="rounded-card border border-line bg-surface p-6 shadow-card">
            <span className={cn("grid size-12 place-items-center rounded-xl", TONE[id])}>
              <Icon aria-hidden className="size-6" />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-navy-950">{name}</h3>
            <p className="text-sm font-semibold text-forest-700">{role}</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{summary}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HowItWorksSection() {
  return (
    <section aria-labelledby="how-title" className="border-y border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 id="how-title" className="text-2xl font-semibold tracking-tight text-navy-950 sm:text-3xl">How GreenFleet works</h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {HOW_IT_WORKS.map((s, i) => (
            <li key={s.title}>
              <span className="grid size-9 place-items-center rounded-full bg-forest-700 text-sm font-bold text-white">{i + 1}</span>
              <h3 className="mt-3 font-semibold text-navy-950">{s.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function PrincipleSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex gap-4 rounded-card border border-forest-200 bg-forest-50 p-6">
        <Scale aria-hidden className="mt-0.5 size-6 shrink-0 text-forest-700" />
        <p className="text-base font-medium leading-relaxed text-forest-950">
          GreenFleet does not assume that a green technology is commercially superior. Results are determined by the user&apos;s operating
          and financial assumptions.
        </p>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-8 text-xs leading-relaxed text-slate-600 sm:px-6 lg:px-8">
        <p>
          GreenFleet Viability Lab is a decision-support prototype. Results depend on user-supplied assumptions and should not be
          interpreted as certified financial or engineering advice.
        </p>
        <p className="mt-2">University of Port Harcourt, Centre for Logistics and Transport Studies (CELTRAS).</p>
      </div>
    </footer>
  );
}
