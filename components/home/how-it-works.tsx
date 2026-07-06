import { CalendarCheck, Syringe, Microscope, MonitorSmartphone } from "lucide-react";
import { Reveal } from "@/components/reveal";

const STEPS = [
  {
    icon: CalendarCheck,
    title: "Book Online or via WhatsApp",
    description:
      "Choose a service, pick a convenient date and time, and submit your request in under a minute.",
  },
  {
    icon: Syringe,
    title: "Sample Collection",
    description:
      "Visit our Akure lab or request home sample collection — our phlebotomists come to you.",
  },
  {
    icon: Microscope,
    title: "Laboratory Analysis",
    description:
      "Our accredited scientists process your samples using modern equipment and strict quality control.",
  },
  {
    icon: MonitorSmartphone,
    title: "Secure Results Online",
    description:
      "Get notified and view or download your results from your private patient portal account.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="section-pad bg-white">
      <div className="container-page">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="badge border border-border bg-blue-light text-blue">
            Simple Process
          </span>
          <h2 className="mt-4 font-display text-3xl font-extrabold text-navy sm:text-4xl">
            How it works
          </h2>
          <p className="mt-3 text-muted">
            A streamlined path from booking to results, designed around your time.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <Reveal key={step.title} delay={i * 80} className="relative">
              <div className="flex flex-col items-start">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue text-white shadow-[0_10px_24px_-10px_rgba(21,104,184,0.6)]">
                  <step.icon className="h-6 w-6" strokeWidth={2} />
                </span>
                <span className="mt-4 font-display text-xs font-bold uppercase tracking-wider text-faint">
                  Step {i + 1}
                </span>
                <h3 className="mt-1 font-display text-base font-bold text-navy">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {step.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
