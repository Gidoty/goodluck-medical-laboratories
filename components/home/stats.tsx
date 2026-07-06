import { Reveal } from "@/components/reveal";

const STATS = [
  { value: "6+", label: "Diagnostic Services" },
  { value: "24hr", label: "Avg. Result Turnaround" },
  { value: "1000+", label: "Patients Served" },
  { value: "7", label: "Days a Week Available" },
];

export function Stats() {
  return (
    <section className="border-y border-border bg-navy">
      <div className="container-page grid grid-cols-2 gap-6 py-10 sm:grid-cols-4 sm:py-12">
        {STATS.map((stat, i) => (
          <Reveal key={stat.label} delay={i * 60} className="text-center">
            <p className="font-display text-3xl font-extrabold text-white sm:text-4xl">
              {stat.value}
            </p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-white/60 sm:text-sm">
              {stat.label}
            </p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
