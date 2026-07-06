import Link from "next/link";
import { CalendarCheck, MessageCircle, ShieldCheck, Home as HomeIcon, Clock3, CheckCircle2 } from "lucide-react";
import { SITE } from "@/lib/site";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute -top-24 -right-24 h-[28rem] w-[28rem] rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--cyan), transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -left-32 top-40 h-[24rem] w-[24rem] rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--blue), transparent 70%)" }}
      />

      <div className="container-page relative grid grid-cols-1 items-center gap-14 py-14 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <div>
          <span className="fade-up badge border border-border bg-blue-light text-blue">
            <ShieldCheck className="h-3.5 w-3.5" /> Serving Akure &amp; Ondo State
          </span>

          <h1 className="fade-up delay-1 mt-5 font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-navy sm:text-5xl lg:text-[3.4rem]">
            Accurate diagnostics,{" "}
            <span className="text-blue">delivered with care</span>.
          </h1>

          <p className="fade-up delay-2 mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            {SITE.legalName} provides ultrasound scanning, medical microbiology,
            chemical pathology, haematology, and home sample collection —
            with secure online results you can access anytime.
          </p>

          <div className="fade-up delay-3 mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/book" className="btn btn-primary text-base">
              <CalendarCheck className="h-5 w-5" /> Book an Appointment
            </Link>
            <a
              href={SITE.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-whatsapp text-base"
            >
              <MessageCircle className="h-5 w-5" /> Chat on WhatsApp
            </a>
          </div>

          <div className="fade-up delay-4 mt-9 flex flex-wrap gap-x-7 gap-y-3 text-sm text-muted">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-cyan" /> MLSCN-aligned lab practice
            </span>
            <span className="flex items-center gap-2">
              <HomeIcon className="h-4 w-4 text-cyan" /> Home sample collection
            </span>
            <span className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-cyan" /> Fast turnaround
            </span>
          </div>
        </div>

        <div className="fade-up delay-2 relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="card relative overflow-hidden p-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-faint">
                  Patient Portal
                </p>
                <p className="font-display text-lg font-bold text-navy">
                  Demo Patient
                </p>
              </div>
              <span className="badge bg-green/10 text-green">
                <CheckCircle2 className="h-3.5 w-3.5" /> Online
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-off p-3.5">
                <div>
                  <p className="text-sm font-semibold text-ink">Full Blood Count</p>
                  <p className="text-xs text-muted">Haematology · Ref# GML-2201</p>
                </div>
                <span className="badge bg-green/10 text-green">Ready</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-off p-3.5">
                <div>
                  <p className="text-sm font-semibold text-ink">Abdominal Ultrasound</p>
                  <p className="text-xs text-muted">Imaging · Ref# GML-2202</p>
                </div>
                <span className="badge bg-amber/10 text-amber">Processing</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-off p-3.5">
                <div>
                  <p className="text-sm font-semibold text-ink">Next Appointment</p>
                  <p className="text-xs text-muted">Thu, 10:00 AM</p>
                </div>
                <span className="badge bg-blue-light text-blue">Confirmed</span>
              </div>
            </div>

            <p className="mt-5 text-center text-xs text-faint">
              Secure results delivered straight to your patient account.
            </p>
          </div>

          <div className="pulse-ring absolute -bottom-5 -left-5 hidden rounded-2xl bg-white p-3.5 shadow-lg sm:block">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-green/10 text-green">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold text-ink">Result Ready</p>
                <p className="text-[0.65rem] text-muted">Just now</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
