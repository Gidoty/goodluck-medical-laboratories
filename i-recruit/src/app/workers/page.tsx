import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { EnquiryForm } from "@/components/EnquiryForm";
import { Faq } from "@/components/Faq";
import { PageHero } from "@/components/PageHero";
import { SectionHeading } from "@/components/SectionHeading";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "For Workers: Mason and Labourer Jobs in Alberta",
  description:
    "Skilled masons, bricklayers and labourers in Nigeria, Cameroon and Kenya: register with I-Recruit to be screened and matched with Alberta construction employers.",
};

const STEPS = [
  ["Register", "Send your trade, experience and contact details using the form below."],
  ["Get screened", "We review your experience, assess your skills and verify your details."],
  ["Safety orientation", "You are briefed on workplace safety before any placement."],
  ["Get matched", "Suitable candidates are put forward to Alberta employers who need your trade."],
  ["Documentation support", "We help you prepare the paperwork and understand the requirements."],
];

const FAQ = [
  {
    q: "Who can register?",
    a: "Experienced masons, bricklayers and construction labourers living in Nigeria, Cameroon or Kenya. Other countries can submit an enquiry and we will let you know if we can help.",
  },
  {
    q: "What happens after I register?",
    a: "A member of our team contacts you to confirm your details. Your skills assessment and screening follow, and suitable candidates are put forward to Alberta employers.",
  },
  {
    q: "What should I prepare?",
    a: "Your work history, the types of projects you have worked on, any trade certificates or safety training, and a valid passport if you have one.",
  },
  {
    q: "Do you help with paperwork?",
    a: "Yes. We help you prepare your documents and explain the Canadian labour and immigration requirements that apply to your placement.",
  },
];

export default function WorkersPage() {
  return (
    <>
      <PageHero eyebrow="For workers" title="Take your trade to Alberta">
        If you are a skilled mason, bricklayer or labourer, register with I-Recruit to be screened and matched with
        construction employers in Canada.
      </PageHero>

      <section className="px-5 py-24 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionHeading eyebrow="Your path" title="How registration works" />
          <ol className="mt-14 grid gap-px bg-charcoal/15 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="reveal bg-white p-6">
                <span className="font-display text-6xl font-extrabold leading-none text-orange">{i + 1}</span>
                <h3 className="mt-3 text-2xl font-bold uppercase text-charcoal">{t}</h3>
                <p className="mt-2 text-sm text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="register" className="scroll-mt-24 bg-stone px-5 py-24 sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <SectionHeading eyebrow="Worker registration" title="Register your interest">
              Tell us about your trade and experience. A member of our team will contact you.
            </SectionHeading>
            <div className="mt-8 flex gap-4 border-l-4 border-orange bg-white p-5">
              <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-orange-ink" aria-hidden />
              <p className="text-sm text-charcoal">
                <strong>Protect yourself from fake offers.</strong> Only trust messages that come from{" "}
                <span className="break-all font-semibold">{SITE.email}</span>, {SITE.phone.display} or{" "}
                {SITE.whatsapp.display}. If anyone else claims to represent I-Recruit, contact us to check.
              </p>
            </div>
          </div>
          <div className="bg-white p-6 shadow-[0_30px_60px_-35px_rgb(0_0_0/0.5)] sm:p-10">
            <EnquiryForm kind="worker" />
          </div>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-4xl">
          <SectionHeading eyebrow="Worker FAQ" title="Before you apply" />
          <div className="mt-10">
            <Faq items={FAQ} />
          </div>
        </div>
      </section>
    </>
  );
}
