import Link from "next/link";
import { CalendarCheck, Phone } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { SITE } from "@/lib/site";

export function FinalCta() {
  return (
    <section className="section-pad">
      <div className="container-page">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-navy px-6 py-14 text-center sm:px-14">
            <div
              className="pointer-events-none absolute -top-16 right-0 h-72 w-72 rounded-full opacity-30 blur-3xl"
              style={{ background: "radial-gradient(circle, var(--cyan), transparent 70%)" }}
            />
            <h2 className="relative font-display text-3xl font-extrabold text-white sm:text-4xl">
              Ready to book your test?
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-white/70">
              Schedule an appointment in minutes, or call us directly for
              urgent enquiries. We&rsquo;re here Mon–Sat, with emergency
              sample collection on Sundays.
            </p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/book" className="btn btn-primary">
                <CalendarCheck className="h-5 w-5" /> Book an Appointment
              </Link>
              <a href={`tel:+234${SITE.phones[0].slice(1)}`} className="btn bg-white text-navy hover:bg-white/90">
                <Phone className="h-5 w-5" /> Call {SITE.phones[0]}
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
