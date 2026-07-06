import type { Metadata } from "next";
import { MapPin, Phone, Mail, Clock, MessageCircle } from "lucide-react";
import { ContactForm } from "@/components/contact-form";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact Us | Goodluck Medical Laboratories",
  description: "Get in touch with Goodluck Medical Laboratories in Akure, Ondo State.",
};

export default function ContactPage() {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    SITE.address
  )}`;

  return (
    <div className="section-pad">
      <div className="container-page grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <span className="badge border border-border bg-blue-light text-blue">Contact Us</span>
          <h1 className="mt-4 font-display text-3xl font-extrabold text-navy sm:text-4xl">
            We&rsquo;re here to help
          </h1>
          <p className="mt-3 max-w-md text-muted">
            Have a question about a test, result, or our services? Send us a
            message or reach out directly.
          </p>

          <div className="mt-7 space-y-4">
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="card flex gap-3 p-4 hover:border-blue">
              <MapPin className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue" />
              <div>
                <p className="text-sm font-semibold text-ink">Visit Us</p>
                <p className="text-sm text-muted">{SITE.address}</p>
              </div>
            </a>
            <div className="card flex gap-3 p-4">
              <Phone className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue" />
              <div>
                <p className="text-sm font-semibold text-ink">Call Us</p>
                <p className="text-sm text-muted">{SITE.phones.join(" · ")}</p>
              </div>
            </div>
            <div className="card flex gap-3 p-4">
              <Mail className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue" />
              <div>
                <p className="text-sm font-semibold text-ink">Email Us</p>
                <p className="text-sm text-muted">{SITE.email}</p>
              </div>
            </div>
            <div className="card flex gap-3 p-4">
              <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue" />
              <div>
                <p className="text-sm font-semibold text-ink">Opening Hours</p>
                {SITE.hours.map((h) => (
                  <p key={h.day} className="text-sm text-muted">
                    {h.day}: {h.time}
                  </p>
                ))}
              </div>
            </div>
            <a href={SITE.whatsappLink} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp w-full">
              <MessageCircle className="h-5 w-5" /> Chat on WhatsApp
            </a>
          </div>
        </div>

        <ContactForm />
      </div>
    </div>
  );
}
