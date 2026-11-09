import type { Metadata } from "next";
import { Check } from "lucide-react";
import { EnquiryForm } from "@/components/EnquiryForm";
import { Faq } from "@/components/Faq";
import { PageHero } from "@/components/PageHero";
import { SectionHeading } from "@/components/SectionHeading";
import { SITE, whatsappLink } from "@/lib/site";
import { ButtonLink } from "@/components/ButtonLink";

export const metadata: Metadata = {
  title: "For Employers: Hire Masons and Labourers in Alberta",
  description:
    "Request vetted masons, bricklayers and construction labourers for your Alberta projects. I-Recruit sources, screens and supports every placement.",
};

const FAQ = [
  {
    q: "Which trades can I request?",
    a: "Masons and bricklayers, and general construction labourers. If you need a mix, tell us the split and we plan the search around it.",
  },
  {
    q: "Where do your workers come from?",
    a: "Our candidates are sourced from Nigeria, Cameroon and Kenya. We assess each person's trade experience before presenting them to you.",
  },
  {
    q: "How long does it take to fill a request?",
    a: "It depends on the trade, the number of workers and the approvals involved. After your request we give you a realistic timeline for your specific project, not a generic promise.",
  },
  {
    q: "Do you handle immigration paperwork?",
    a: "We help employers and candidates with documentation and guide both sides through Canadian labour and immigration requirements. Final decisions on permits rest with the Government of Canada, and we do not guarantee outcomes.",
  },
  {
    q: "Can you help me plan my workforce?",
    a: "Yes. We advise on how many workers you need, when to recruit and how to stage hiring across projects.",
  },
];

export default function EmployersPage() {
  return (
    <>
      <PageHero eyebrow="For employers" title="Staff your Alberta sites with workers you can rely on">
        Tell us the trade, the headcount and the start date. We source, screen and support the placement.
      </PageHero>

      <section className="px-5 py-24 sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="What you get" title="Less hiring risk, more finished work" />
            <ul className="mt-10 space-y-5">
              {[
                ["Vetted candidates", "Skills, safety awareness and work ethic are checked before we recommend anyone."],
                ["One point of contact", "A single team from first request to the worker's first day."],
                ["Compliance support", "Help with documentation and with Canadian labour and immigration requirements."],
                ["Workforce planning", "Advice on headcount and timing so crews are ready when the project starts."],
              ].map(([t, d]) => (
                <li key={t} className="reveal flex gap-4">
                  <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center bg-orange text-ink">
                    <Check className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-2xl font-bold uppercase text-charcoal">{t}</h3>
                    <p className="text-muted">{d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-charcoal p-8 text-white sm:p-12">
            <p className="eyebrow text-orange">What to include in your request</p>
            <ol className="mt-6 space-y-5">
              {[
                "Trade: masons, labourers or both",
                "Number of workers and any experience level required",
                "Project location in Alberta",
                "Target start date and expected duration",
                "Certifications, tickets or equipment you require",
              ].map((t, i) => (
                <li key={t} className="flex gap-4 border-b border-white/10 pb-5 last:border-0 last:pb-0">
                  <span className="font-display text-4xl font-extrabold leading-none text-orange">{i + 1}</span>
                  <span className="pt-1 text-lg text-white/85">{t}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="request" className="scroll-mt-24 bg-stone px-5 py-24 sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <SectionHeading eyebrow="Staffing request" title="Request workers">
              Fill in what you know. Missing details are fine. We follow up to complete the picture.
            </SectionHeading>
            <p className="mt-8 text-muted">
              Prefer to talk? Message us on{" "}
              <a className="font-semibold text-orange-ink underline underline-offset-4" href={whatsappLink()} target="_blank" rel="noopener noreferrer">
                WhatsApp {SITE.whatsapp.display}
              </a>{" "}
              or email{" "}
              <a className="font-semibold text-orange-ink underline underline-offset-4 break-all" href={`mailto:${SITE.email}`}>
                {SITE.email}
              </a>
              .
            </p>
          </div>
          <div className="bg-white p-6 shadow-[0_30px_60px_-35px_rgb(0_0_0/0.5)] sm:p-10">
            <EnquiryForm kind="employer" />
          </div>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-4xl">
          <SectionHeading eyebrow="Employer FAQ" title="Common questions" />
          <div className="mt-10">
            <Faq items={FAQ} />
          </div>
          <div className="mt-12">
            <ButtonLink href="/contact" variant="dark">
              Ask something else
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
