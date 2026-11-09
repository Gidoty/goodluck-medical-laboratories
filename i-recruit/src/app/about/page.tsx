import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { SectionHeading } from "@/components/SectionHeading";
import { ButtonLink } from "@/components/ButtonLink";
import Image from "next/image";
import { CERTS } from "@/lib/media";

export const metadata: Metadata = {
  title: "About I-Recruit: Vision, Mission and Values",
  description:
    "I-Recruit aims to be Canada's most trusted recruitment partner for the construction industry, connecting skilled masons and labourers with employers.",
};

const VALUES = [
  ["Reliability", "We deliver the right workers, when and where they are needed."],
  ["Integrity", "We recruit transparently, fairly and in line with the law."],
  ["Quality", "Every candidate is screened for skills, safety awareness and work ethic."],
  ["Partnership", "We build long-term relationships with employers and workers alike."],
];

export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="About us" title="Recruitment for the people who build">
        I-Recruit connects skilled masons and dependable labourers with the construction companies that need them.
      </PageHero>

      <section className="px-5 py-24 sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">
          <article className="reveal bg-charcoal p-10 text-white sm:p-14">
            <p className="eyebrow text-orange">Vision</p>
            <p className="mt-5 font-display text-3xl font-bold uppercase leading-tight sm:text-4xl">
              To be Canada&apos;s most trusted recruitment partner for the construction industry.
            </p>
            <p className="mt-5 text-white/70">
              Connecting skilled masons and dependable manual labourers with the companies that build the nation&apos;s future.
            </p>
          </article>
          <article className="reveal border-t-4 border-orange bg-white p-10 shadow-[0_20px_50px_-30px_rgb(0_0_0/0.4)] sm:p-14">
            <p className="eyebrow text-orange-ink">Mission</p>
            <p className="mt-5 text-lg text-charcoal">
              I-Recruit supplies qualified, vetted masons and manual labourers to construction companies across
              Canada. We deliver reliable talent quickly, support compliance with Canadian labour and immigration
              requirements, and provide consulting that helps employers plan their workforce.
            </p>
            <p className="mt-4 text-lg text-charcoal">
              In doing so, we help companies finish projects on time and open real career opportunities for skilled
              workers.
            </p>
          </article>
        </div>
      </section>

      <section className="bg-stone px-5 py-24 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionHeading eyebrow="Core values" title="How we work" />
          <dl className="mt-12 grid gap-10 sm:grid-cols-2">
            {VALUES.map(([t, d], i) => (
              <div key={t} className="reveal flex gap-6 border-t-2 border-charcoal pt-6">
                <span className="font-display text-6xl font-extrabold leading-none text-orange">0{i + 1}</span>
                <div>
                  <dt className="text-3xl font-extrabold uppercase text-charcoal">{t}</dt>
                  <dd className="mt-2 text-muted">{d}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionHeading eyebrow="Credentials" title="Trained and certified">
            Hands-on masonry training, process safety and project management qualifications behind the people who run I-Recruit.
          </SectionHeading>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CERTS.map((c) => (
              <a
                key={c.src}
                href={c.src}
                target="_blank"
                rel="noopener noreferrer"
                className="reveal group flex flex-col border-t-4 border-orange bg-white shadow-[0_20px_50px_-30px_rgb(0_0_0/0.4)] transition-transform duration-300 hover:-translate-y-1"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-stone">
                  <Image src={c.src} alt={c.alt} fill sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw" className="object-contain p-3 transition-transform duration-500 group-hover:scale-[1.03]" />
                </div>
                <div className="p-6">
                  <h3 className="text-2xl font-extrabold uppercase leading-tight text-charcoal">{c.title}</h3>
                  <p className="mt-2 text-sm text-muted">{c.issuer}</p>
                  <p className="text-sm font-semibold text-orange-ink">{c.date}</p>
                </div>
              </a>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted">Select a certificate to view it full size. Held by Dickson Onisobuana, CEO of I-Recruit.</p>
        </div>
      </section>

      <section className="bg-stone px-5 py-24 sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <SectionHeading eyebrow="Where we work" title="Africa to Alberta">
              Our team is based in Port Harcourt, Nigeria. We source candidates in Nigeria, Cameroon and Kenya and
              place them with construction employers in Alberta, Canada.
            </SectionHeading>
          </div>
          <ul className="reveal grid gap-3">
            {["Nigeria", "Cameroon", "Kenya"].map((c) => (
              <li key={c} className="flex items-center justify-between border-l-4 border-orange bg-white px-6 py-4 font-display text-2xl font-bold uppercase text-charcoal">
                {c} <span className="text-sm font-semibold tracking-widest text-orange-ink">SOURCE</span>
              </li>
            ))}
            <li className="flex items-center justify-between border-l-4 border-charcoal bg-charcoal px-6 py-4 font-display text-2xl font-bold uppercase text-white">
              Alberta, Canada <span className="text-sm font-semibold tracking-widest text-orange">PLACEMENT</span>
            </li>
          </ul>
        </div>
        <div className="mx-auto mt-14 flex max-w-7xl flex-col gap-3 sm:flex-row">
          <ButtonLink href="/employers#request">Request workers</ButtonLink>
          <ButtonLink href="/workers#register" variant="ghost-dark">
            Register as a worker
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
