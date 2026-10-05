import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PATHWAYS } from "./pathways";
import { cn } from "@/lib/cn";

const ACCENT: Record<string, string> = {
  diesel: "bg-navy-100 text-navy-800",
  electric: "bg-forest-100 text-forest-800",
  biofuel: "bg-amber-100 text-amber-900",
};

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-navy-950 text-white">
      <svg aria-hidden className="pointer-events-none absolute inset-0 size-full opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M48 0H0V48" fill="none" stroke="white" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8 lg:py-24">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-forest-300">Techno-Economic Decision Support for Green Logistics Entrepreneurs</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Is Green Transport Commercially Viable for Your Fleet?</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-navy-100">
            Compare diesel, electric and biofuel transport options using transparent techno-economic analysis tailored to your operating
            conditions.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/assessment/business" size="lg" className="bg-white text-forest-900 hover:bg-forest-50">
              Start New Assessment <ArrowRight aria-hidden className="size-5" />
            </ButtonLink>
            <ButtonLink href="/methodology" size="lg" variant="ghost" className="border border-navy-500 text-white hover:bg-navy-800">
              Explore Methodology
            </ButtonLink>
          </div>
        </div>

        <figure aria-label="The three transport pathways compared" className="rounded-2xl border border-navy-700 bg-navy-900/70 p-5 shadow-raised sm:p-6">
          <ol className="relative space-y-3">
            {PATHWAYS.map(({ id, name, role, icon: Icon }, i) => (
              <li key={id} className="relative flex items-center gap-4 rounded-xl border border-navy-700 bg-navy-800/70 p-4">
                <span className={cn("grid size-11 shrink-0 place-items-center rounded-lg", ACCENT[id])}>
                  <Icon aria-hidden className="size-6" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{name}</span>
                  <span className="block text-sm text-navy-200">{role}</span>
                </span>
                <span className="ml-auto text-xs font-semibold text-navy-300">{i + 1}</span>
              </li>
            ))}
          </ol>
          <figcaption className="mt-4 text-xs leading-relaxed text-navy-300">
            One route, one payload, one set of assumptions. The numbers decide the outcome.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
