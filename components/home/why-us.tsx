import {
  BadgeCheck,
  Clock3,
  Home,
  MonitorSmartphone,
  Microscope,
  HeartHandshake,
} from "lucide-react";
import { Reveal } from "@/components/reveal";

const POINTS = [
  {
    icon: BadgeCheck,
    title: "Qualified & Experienced Team",
    description: "Our scientists and sonographers bring years of hands-on clinical experience.",
  },
  {
    icon: Microscope,
    title: "Modern Equipment",
    description: "We invest in reliable, well-maintained diagnostic equipment for accurate results.",
  },
  {
    icon: Clock3,
    title: "Fast Turnaround",
    description: "Most results are ready same-day, with urgent requests prioritised.",
  },
  {
    icon: Home,
    title: "Home Sample Collection",
    description: "Skip the trip — our team collects samples at your home or office.",
  },
  {
    icon: MonitorSmartphone,
    title: "Secure Online Portal",
    description: "View and download your results anytime from a private patient account.",
  },
  {
    icon: HeartHandshake,
    title: "Patient-First Care",
    description: "Friendly, confidential service from booking through to your results.",
  },
];

export function WhyUs() {
  return (
    <section className="section-pad">
      <div className="container-page">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="badge border border-border bg-blue-light text-blue">
            Why Choose Us
          </span>
          <h2 className="mt-4 font-display text-3xl font-extrabold text-navy sm:text-4xl">
            Built around accuracy and convenience
          </h2>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {POINTS.map((point, i) => (
            <Reveal key={point.title} delay={i * 60}>
              <div className="card flex h-full gap-4 p-6">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-cyan/10 text-cyan">
                  <point.icon className="h-5 w-5" strokeWidth={2} />
                </span>
                <div>
                  <h3 className="font-display text-base font-bold text-navy">
                    {point.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">
                    {point.description}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
