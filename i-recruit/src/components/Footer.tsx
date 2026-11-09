import Link from "next/link";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { NAV, SITE, whatsappLink } from "@/lib/site";
import { Wordmark } from "./Logo";

export function Footer() {
  return (
    <footer className="relative bg-ink text-white/80">
      <div className="h-1.5 bg-orange" />
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.4fr_1fr_1.3fr]">
        <div>
          <Wordmark tone="light" />
          <p className="eyebrow mt-6 text-white">{SITE.tagline}</p>
          <p className="mt-4 max-w-sm text-white/65">
            Vetted masons and labourers from Nigeria, Cameroon and Kenya, placed with construction
            companies across Alberta.
          </p>
        </div>

        <nav aria-label="Footer">
          <h2 className="font-display text-xl font-bold uppercase tracking-wider text-orange">Explore</h2>
          <ul className="mt-4 space-y-2.5">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="transition-colors hover:text-orange">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/privacy" className="transition-colors hover:text-orange">
                Privacy
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h2 className="font-display text-xl font-bold uppercase tracking-wider text-orange">Contact</h2>
          <ul className="mt-4 space-y-3">
            <li className="flex gap-3">
              <Mail className="mt-1 h-5 w-5 shrink-0 text-orange" aria-hidden />
              <a href={`mailto:${SITE.email}`} className="break-all hover:text-orange">
                {SITE.email}
              </a>
            </li>
            <li className="flex gap-3">
              <Phone className="mt-1 h-5 w-5 shrink-0 text-orange" aria-hidden />
              <a href={`tel:${SITE.phone.tel}`} className="hover:text-orange">
                {SITE.phone.display}
              </a>
            </li>
            <li className="flex gap-3">
              <MessageCircle className="mt-1 h-5 w-5 shrink-0 text-orange" aria-hidden />
              <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="hover:text-orange">
                WhatsApp {SITE.whatsapp.display}
              </a>
            </li>
            <li className="flex gap-3">
              <MapPin className="mt-1 h-5 w-5 shrink-0 text-orange" aria-hidden />
              <address className="not-italic">{SITE.address.lines.join(", ")}</address>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-6 text-sm text-white/55 sm:px-8">
          <p>&copy; {new Date().getFullYear()} I-Recruit. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
