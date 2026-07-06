import Link from "next/link";
import { CheckCircle2, LockKeyhole, ArrowRight } from "lucide-react";
import { Reveal } from "@/components/reveal";

const FEATURES = [
  "View and download your lab results anytime, from any device",
  "Get notified the moment new results are ready",
  "Track the status of your booked appointments",
  "Keep a private history of all your past tests",
];

export function PortalPromo() {
  return (
    <section className="section-pad">
      <div className="container-page grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <span className="badge border border-border bg-cyan/10 text-cyan">
            <LockKeyhole className="h-3.5 w-3.5" /> Innovative Feature
          </span>
          <h2 className="mt-4 font-display text-3xl font-extrabold text-navy sm:text-4xl">
            Your results, secured in one online portal
          </h2>
          <p className="mt-3 max-w-lg text-muted">
            No more waiting on phone calls for results. Create a free patient
            account and access everything from your last visit to your most
            recent test — securely, whenever you need it.
          </p>

          <ul className="mt-6 space-y-3">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm text-ink/80">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green" />
                {feature}
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className="btn btn-primary">
              Create Patient Account <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="btn btn-outline">
              Log In
            </Link>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div className="card mx-auto max-w-md p-6">
            <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-faint">
              <LockKeyhole className="h-3.5 w-3.5" /> End-to-end account security
            </div>
            {[
              { label: "Password-protected patient login", done: true },
              { label: "Results visible only to you and lab staff", done: true },
              { label: "Downloadable, printable result records", done: true },
              { label: "No public sharing of your health data", done: true },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center gap-3 border-b border-border py-3 last:border-0"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green/10 text-green">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <span className="text-sm text-ink/80">{row.label}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
