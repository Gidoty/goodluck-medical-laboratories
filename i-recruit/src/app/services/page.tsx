import type { Metadata } from "next";
import { ClipboardCheck, FileText, Hammer, LineChart, ShieldCheck, Users } from "lucide-react";
import { ButtonLink } from "@/components/ButtonLink";
import { PageHero } from "@/components/PageHero";
import { SectionHeading } from "@/components/SectionHeading";

export const metadata: Metadata = {
  title: "Services: Construction Recruitment and Workforce Consulting",
  description:
    "Recruitment, screening, documentation support and workforce consulting for Alberta construction companies hiring masons and labourers.",
};

const SERVICES = [
  {
    icon: Users,
    title: "Recruitment and placement",
    text: "We source masons, bricklayers and labourers from Nigeria, Cameroon and Kenya and match them to your project requirements.",
  },
  {
    icon: ClipboardCheck,
    title: "Skills assessment and screening",
    text: "Trade ability, credentials and work history are checked before a candidate is recommended to you.",
  },
  {
    icon: ShieldCheck,
    title: "Safety awareness orientation",
    text: "Workers receive an orientation on workplace safety so they arrive prepared for a Canadian site.",
  },
  {
    icon: FileText,
    title: "Documentation and compliance support",
    text: "We help employers and candidates prepare documents and work through Canadian labour and immigration requirements.",
  },
  {
    icon: LineChart,
    title: "Workforce planning and advisory",
    text: "Consulting on how many workers you need, when to hire and how to stage recruitment across your projects.",
  },
  {
    icon: Hammer,
    title: "Employer and worker matching",
    text: "Our platform and process connect the right tradespeople to the right employers, so both sides know what to expect.",
  },
];

export default function ServicesPage() {
  return (
    <>
      <PageHero eyebrow="Services" title="Recruitment built for construction">
        Everything from sourcing a mason in Port Harcourt to supporting their placement on an Alberta site.
      </PageHero>

      <section className="px-5 py-24 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionHeading eyebrow="What we do" title="Six services, one team" />
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map(({ icon: Icon, title, text }) => (
              <article
                key={title}
                className="reveal group border-t-4 border-orange bg-white p-8 shadow-[0_20px_50px_-30px_rgb(0_0_0/0.4)] transition-transform duration-300 hover:-translate-y-1"
              >
                <Icon className="h-10 w-10 text-orange-ink" aria-hidden />
                <h3 className="mt-5 text-3xl font-extrabold uppercase leading-none text-charcoal">{title}</h3>
                <p className="mt-3 text-muted">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-charcoal px-5 py-20 text-center text-white sm:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-4xl font-extrabold uppercase sm:text-6xl">Let&apos;s plan your next crew</h2>
          <p className="mt-5 text-white/75">Tell us about your project and we will come back with a clear plan.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/employers#request">Request workers</ButtonLink>
            <ButtonLink href="/contact" variant="ghost-light">
              Contact us
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
