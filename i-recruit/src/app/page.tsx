import {
  BadgeCheck,
  ClipboardCheck,
  FileText,
  Handshake,
  HardHat,
  Hammer,
  Search,
  ShieldCheck,
  Users,
  Globe,
  MapPin,
  Layers,
} from "lucide-react";
import { ButtonLink } from "@/components/ButtonLink";
import { BrickWall } from "@/components/BrickWall";
import Image from "next/image";
import { LogoMark } from "@/components/Logo";
import { Gallery } from "@/components/Gallery";
import { WORK } from "@/lib/media";
import { SectionHeading } from "@/components/SectionHeading";
import { SITE, whatsappLink } from "@/lib/site";

const TRUST = [
  { icon: MapPin, title: "Alberta focus", text: "Built around Alberta construction employers." },
  { icon: Globe, title: "Nigeria · Cameroon · Kenya", text: "Talent sourced across three African countries." },
  { icon: ShieldCheck, title: "Screened candidates", text: "Skills, safety awareness and work ethic checked." },
  { icon: FileText, title: "Documentation support", text: "Help with paperwork and compliance steps." },
];

const STEPS = [
  { icon: ClipboardCheck, title: "Tell us what you need", text: "Trade, headcount, project location and start date. A short form or a WhatsApp message is enough." },
  { icon: Search, title: "We source and screen", text: "We search our candidate pool in Nigeria, Cameroon and Kenya, verify details and assess skills." },
  { icon: Users, title: "You review a shortlist", text: "You see qualified candidates matched to your trade and project, and choose who to interview." },
  { icon: Handshake, title: "We support the placement", text: "Documentation, orientation and compliance guidance for you and the worker, from offer to arrival." },
];

const VALUES = [
  { title: "Reliability", text: "The right workers, when and where they are needed." },
  { title: "Integrity", text: "We recruit transparently, fairly and in line with the law." },
  { title: "Quality", text: "Every candidate is screened for skills, safety awareness and work ethic." },
  { title: "Partnership", text: "Long-term relationships with employers and workers alike." },
];

export default function Home() {
  return (
    <>
      {/* HERO */}
      <section className="bg-bricks edge-slant-bottom relative overflow-hidden pb-32 pt-14 text-white sm:pb-40 sm:pt-20">
        <BrickWall className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[62%] opacity-60 [mask-image:linear-gradient(to_right,transparent_10%,black_65%)] lg:block" />
        <div
          aria-hidden
          className="absolute bottom-0 right-0 h-[46vw] max-h-[560px] w-[46vw] max-w-[560px] bg-orange"
          style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}
        />
        <div
          aria-hidden
          className="absolute bottom-0 right-0 h-[30vw] max-h-[370px] w-[30vw] max-w-[370px] bg-orange-deep"
          style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}
        />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="eyebrow hero-in flex items-center gap-3 text-orange">
              <span className="h-0.5 w-10 bg-orange" /> Construction recruitment for Alberta
            </p>
            <h1
              className="hero-in mt-5 text-[3.4rem] font-extrabold uppercase leading-[0.92] sm:text-8xl lg:text-[7.5rem]"
              style={{ animationDelay: "90ms" }}
            >
              Skilled masons.
              <span className="block text-orange">Reliable labour.</span>
            </h1>
            <p
              className="hero-in mt-8 max-w-xl text-lg text-white/80 sm:text-xl"
              style={{ animationDelay: "180ms" }}
            >
              I-Recruit sources, screens and places vetted masons and labourers from Nigeria, Cameroon and
              Kenya with construction companies across Alberta, so your projects stay staffed and on schedule.
            </p>
            <div className="hero-in mt-10 flex flex-col gap-3 sm:flex-row" style={{ animationDelay: "270ms" }}>
              <ButtonLink href="/employers#request">Request workers</ButtonLink>
              <ButtonLink href="/workers#register" variant="ghost-light">
                Register as a worker
              </ButtonLink>
            </div>
          </div>

          <div className="hero-in relative mx-auto hidden w-full max-w-sm lg:block" style={{ animationDelay: "250ms" }}>
            <div className="absolute -bottom-4 -left-4 h-full w-full border-4 border-orange" aria-hidden />
            <div className="relative aspect-[4/5] overflow-hidden bg-ink shadow-[0_40px_80px_-30px_rgb(0_0_0/0.7)]">
              <Image
                src={WORK.masonSmiling.src}
                alt={WORK.masonSmiling.alt}
                fill
                priority
                sizes="384px"
                className="object-cover object-[50%_18%]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" aria-hidden />
            </div>
            <LogoMark className="absolute -right-8 -top-8 h-24 w-24 drop-shadow-[0_12px_20px_rgb(0_0_0/0.5)]" />
            <div className="absolute -left-10 bottom-14 border-l-4 border-orange bg-ink/95 px-5 py-3">
              <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-white/60">Trades</p>
              <p className="font-display text-2xl font-bold uppercase">Masons · Labourers</p>
            </div>
            <div className="absolute -right-10 bottom-0 border-l-4 border-orange bg-ink/95 px-5 py-3">
              <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-white/60">Placing in</p>
              <p className="font-display text-2xl font-bold uppercase">Alberta, Canada</p>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section aria-label="Why employers choose I-Recruit" className="relative z-10 -mt-12 px-5 sm:-mt-20 sm:px-8">
        <ul className="mx-auto grid max-w-7xl gap-px overflow-hidden bg-charcoal/15 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.45)] sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4 bg-white p-6">
              <Icon className="mt-1 h-8 w-8 shrink-0 text-orange-ink" aria-hidden />
              <div>
                <p className="font-display text-xl font-bold uppercase leading-tight text-charcoal">{title}</p>
                <p className="mt-1 text-sm text-muted">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* TRADES */}
      <section className="px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto max-w-7xl">
          <SectionHeading eyebrow="Who we place" title="Two trades. Done properly.">
            We focus on the people who physically build: the masons who lay the work and the labourers who keep a
            site moving.
          </SectionHeading>

          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {[
              {
                icon: Hammer,
                img: WORK.formwork,
                title: "Masons and bricklayers",
                text: "Experienced tradespeople for brick, block and masonry work on residential, commercial and civil projects. Each candidate's trade experience is assessed before you see them.",
                points: ["Brick and block laying", "Masonry finishing and repair", "Reads plans and works to spec"],
              },
              {
                icon: HardHat,
                img: WORK.stairsForm,
                title: "Construction labourers",
                text: "Dependable manual workers for site preparation, material handling, mixing, cleanup and support on active building sites.",
                points: ["Site preparation and support", "Material handling", "Safety-aware and punctual"],
              },
            ].map(({ icon: Icon, img, title, text, points }) => (
              <article
                key={title}
                className="reveal group relative overflow-hidden border-t-4 border-orange bg-white shadow-[0_20px_50px_-30px_rgb(0_0_0/0.4)] transition-transform duration-300 hover:-translate-y-1"
              >
                <div className="relative aspect-[16/8] overflow-hidden bg-charcoal">
                  <Image src={img.src} alt={img.alt} fill sizes="(min-width: 768px) 560px, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
                <div className="p-8 sm:p-10">
                <Icon className="h-12 w-12 text-orange-ink" aria-hidden />
                <h3 className="mt-6 text-4xl font-extrabold uppercase leading-none text-charcoal">{title}</h3>
                <p className="mt-4 text-muted">{text}</p>
                <ul className="mt-6 space-y-2">
                  {points.map((p) => (
                    <li key={p} className="flex items-center gap-3 font-medium text-charcoal">
                      <BadgeCheck className="h-5 w-5 shrink-0 text-orange-ink" aria-hidden /> {p}
                    </li>
                  ))}
                </ul>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section className="bg-charcoal edge-slant-top edge-slant-bottom relative px-5 pb-32 pt-32 text-white sm:px-8 sm:pb-40 sm:pt-40">
        <div className="mx-auto max-w-7xl">
          <SectionHeading eyebrow="How it works" title="From request to site, in four steps" tone="dark">
            A clear process with a single point of contact, so you always know where your hiring stands.
          </SectionHeading>
          <ol className="mt-16 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="reveal relative border-t border-white/20 pt-6">
                <span className="font-display text-7xl font-extrabold leading-none text-orange/90">0{i + 1}</span>
                <Icon className="mt-4 h-7 w-7 text-white/80" aria-hidden />
                <h3 className="mt-3 text-2xl font-bold uppercase text-white">{title}</h3>
                <p className="mt-3 text-white/70">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* SCREENING */}
      <section className="px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Our standard" title="Every candidate is screened">
              Hiring from overseas only works when you can trust who arrives. We screen before we recommend, so
              the person on your site matches the person on paper.
            </SectionHeading>
            <figure className="reveal relative mt-10 overflow-hidden bg-charcoal">
              <Image src={WORK.safety.src} alt={WORK.safety.alt} width={WORK.safety.w} height={WORK.safety.h} sizes="(min-width: 1024px) 560px, 100vw" className="h-auto w-full" />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 to-transparent px-5 pb-4 pt-12 font-display text-xl font-bold uppercase tracking-wide text-white">
                Site safety briefing
              </figcaption>
            </figure>
            <div className="mt-8">
              <ButtonLink href="/services" variant="dark">
                See our services
              </ButtonLink>
            </div>
          </div>
          <ul className="reveal grid gap-4">
            {[
              ["Skills assessment", "Trade ability is tested against the work you need done."],
              ["Pre-employment screening", "Identity, credentials and work history are verified."],
              ["Safety awareness orientation", "Workers are briefed on workplace safety before placement."],
              ["Work ethic", "Punctuality, attitude and reliability are part of the review."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-5 border-l-4 border-orange bg-white p-6 shadow-[0_14px_40px_-28px_rgb(0_0_0/0.5)]">
                <Layers className="mt-1 h-7 w-7 shrink-0 text-orange-ink" aria-hidden />
                <div>
                  <h3 className="text-2xl font-bold uppercase text-charcoal">{t}</h3>
                  <p className="mt-1 text-muted">{d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ON SITE */}
      <section className="bg-ink px-5 py-24 text-white sm:px-8 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionHeading eyebrow="On site" title="The work our tradespeople do" tone="dark">
            Block laying, foundations, staircases and finishing. This is the standard of work we recruit for.
          </SectionHeading>
          <div className="mt-12">
            <Gallery
              items={[
                { ...WORK.trenchMortar, caption: "Block laying" },
                { ...WORK.wallsLevel, caption: "Built to line" },
                { ...WORK.plastered, caption: "Wall finishing" },
                { ...WORK.trenchPointing, caption: "Pointing joints" },
                { ...WORK.stairsPour, caption: "Staircase pour" },
                { ...WORK.rebar, caption: "Foundation steel" },
                { ...WORK.corner, caption: "Corner work" },
                { ...WORK.rooftop, caption: "Upper-floor walls" },
                { ...WORK.interior, caption: "Interior walls" },
              ]}
            />
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="bg-stone px-5 py-24 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionHeading eyebrow="What we stand for" title="Core values" />
          <dl className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v, i) => (
              <div key={v.title} className="reveal border-t-2 border-charcoal pt-5">
                <p className="font-display text-sm font-bold tracking-[0.2em] text-orange-ink">0{i + 1}</p>
                <dt className="mt-1 text-3xl font-extrabold uppercase text-charcoal">{v.title}</dt>
                <dd className="mt-2 text-muted">{v.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* SPLIT CTA */}
      <section className="px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
          <div className="reveal bg-charcoal p-10 text-white sm:p-14">
            <p className="eyebrow text-orange">For employers</p>
            <h2 className="mt-3 text-5xl font-extrabold uppercase leading-none">Need masons or labourers?</h2>
            <p className="mt-5 max-w-md text-white/75">
              Send us your trade, headcount and project location. We come back with a plan and timeline.
            </p>
            <div className="mt-8">
              <ButtonLink href="/employers#request">Request workers</ButtonLink>
            </div>
          </div>
          <div className="reveal bg-orange p-10 text-ink sm:p-14">
            <p className="eyebrow text-ink/80">For workers</p>
            <h2 className="mt-3 text-5xl font-extrabold uppercase leading-none">Ready to build a career in Canada?</h2>
            <p className="mt-5 max-w-md text-ink/80">
              Register your trade and experience. Qualified candidates are screened and matched to Alberta employers.
            </p>
            <div className="mt-8">
              <ButtonLink href="/workers#register" variant="dark">
                Register now
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* VISION */}
      <section className="bg-bricks edge-slant-top px-5 pb-24 pt-32 text-center text-white sm:px-8 sm:pb-28 sm:pt-40">
        <div className="mx-auto max-w-4xl">
          <p className="eyebrow text-orange">Our vision</p>
          <blockquote className="mt-6 font-display text-3xl font-bold uppercase leading-tight sm:text-5xl">
            To be Canada&apos;s most trusted recruitment partner for the construction industry.
          </blockquote>
          <p className="mx-auto mt-6 max-w-2xl text-white/70">
            Connecting skilled masons and dependable manual labourers with the companies that build the nation&apos;s future.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/contact">Talk to our team</ButtonLink>
            <ButtonLink href={whatsappLink("Hello I-Recruit, I would like to make an enquiry.")} variant="ghost-light" external>
              WhatsApp {SITE.whatsapp.display}
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
