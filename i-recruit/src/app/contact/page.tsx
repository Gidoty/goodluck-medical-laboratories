import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { EnquiryForm } from "@/components/EnquiryForm";
import { PageHero } from "@/components/PageHero";
import { SITE, whatsappLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact I-Recruit",
  description:
    "Contact I-Recruit by email, phone or WhatsApp to hire masons and labourers for Alberta projects, or to register as a worker.",
};

export default function ContactPage() {
  const cards = [
    { icon: MessageCircle, label: "WhatsApp", value: SITE.whatsapp.display, href: whatsappLink(), external: true },
    { icon: Phone, label: "Phone", value: SITE.phone.display, href: `tel:${SITE.phone.tel}` },
    { icon: Mail, label: "Email", value: SITE.email, href: `mailto:${SITE.email}` },
  ];
  return (
    <>
      <PageHero eyebrow="Contact" title="Talk to I-Recruit">
        Hiring in Alberta or looking for work? Reach us the way that suits you.
      </PageHero>

      <section className="px-5 py-24 sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            {cards.map(({ icon: Icon, label, value, href, external }) => (
              <a
                key={label}
                href={href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="group flex items-center gap-5 border-l-4 border-orange bg-white p-6 shadow-[0_14px_40px_-28px_rgb(0_0_0/0.5)] transition-transform hover:-translate-y-0.5"
              >
                <Icon className="h-8 w-8 shrink-0 text-orange-ink" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold uppercase tracking-widest text-muted">{label}</span>
                  <span className="block break-all font-display text-xl font-bold text-charcoal sm:text-2xl group-hover:text-orange-ink">
                    {value}
                  </span>
                </span>
              </a>
            ))}
            <div className="flex items-start gap-5 bg-charcoal p-6 text-white">
              <MapPin className="mt-1 h-8 w-8 shrink-0 text-orange" aria-hidden />
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-white/60">Office</p>
                <address className="mt-1 not-italic text-lg">
                  {SITE.address.lines.map((l) => (
                    <span key={l} className="block">
                      {l}
                    </span>
                  ))}
                </address>
                <p className="mt-3 text-sm text-white/60">Serving employers in {SITE.serviceArea}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 shadow-[0_30px_60px_-35px_rgb(0_0_0/0.5)] sm:p-10">
            <h2 className="mb-6 text-4xl font-extrabold uppercase text-charcoal">Send us a message</h2>
            <EnquiryForm kind="general" />
          </div>
        </div>
      </section>
    </>
  );
}
