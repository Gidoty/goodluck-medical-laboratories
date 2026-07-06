import { Star, Quote } from "lucide-react";
import { Reveal } from "@/components/reveal";

const TESTIMONIALS = [
  {
    name: "Adeola O.",
    location: "Akure",
    quote:
      "Booked my scan online and got a home visit for my blood test the same week. Results were on the portal before I even got home.",
  },
  {
    name: "Tunde A.",
    location: "Ondo State",
    quote:
      "The staff were professional and my full blood count results came back the same day. Highly recommend for anyone in Akure.",
  },
  {
    name: "Blessing E.",
    location: "Akure",
    quote:
      "I appreciate being able to log in and check my results myself instead of calling to ask. Very convenient service.",
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="section-pad bg-white">
      <div className="container-page">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="badge border border-border bg-blue-light text-blue">
            Patient Stories
          </span>
          <h2 className="mt-4 font-display text-3xl font-extrabold text-navy sm:text-4xl">
            Trusted by patients across Ondo State
          </h2>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i * 80}>
              <div className="card flex h-full flex-col p-6">
                <Quote className="h-6 w-6 text-blue-light" fill="currentColor" strokeWidth={0} />
                <p className="mt-3 flex-1 text-sm leading-relaxed text-ink/80">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                  <div>
                    <p className="text-sm font-bold text-navy">{t.name}</p>
                    <p className="text-xs text-muted">{t.location}</p>
                  </div>
                  <div className="flex gap-0.5 text-amber">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
