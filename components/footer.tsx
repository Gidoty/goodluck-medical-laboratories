import Link from "next/link";
import { FlaskConical, MapPin, Mail, Phone, Clock } from "lucide-react";
import { SITE } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-border bg-navy text-white/80">
      <div className="container-page grid grid-cols-1 gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue text-white">
              <FlaskConical className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <span className="font-display text-base font-bold text-white">
              Goodluck Medical
            </span>
          </div>
          <p className="text-sm leading-relaxed text-white/60">
            An accredited medical laboratory in Akure delivering precise
            diagnostics, ultrasound scanning, and home testing services with
            fast, reliable turnaround.
          </p>
        </div>

        <div>
          <h4 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-white">
            Quick Links
          </h4>
          <ul className="space-y-2.5 text-sm text-white/60">
            <li><Link href="/services" className="hover:text-cyan">Our Services</Link></li>
            <li><Link href="/book" className="hover:text-cyan">Book an Appointment</Link></li>
            <li><Link href="/login" className="hover:text-cyan">Patient Portal</Link></li>
            <li><Link href="/contact" className="hover:text-cyan">Contact Us</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-white">
            Services
          </h4>
          <ul className="space-y-2.5 text-sm text-white/60">
            <li>Ultrasound Scanning</li>
            <li>Medical Microbiology</li>
            <li>Chemical Pathology</li>
            <li>Haematology &amp; Blood Serology</li>
            <li>Equipment Sales &amp; Supply</li>
            <li>Home Testing Services</li>
          </ul>
        </div>

        <div>
          <h4 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-white">
            Get In Touch
          </h4>
          <ul className="space-y-3 text-sm text-white/60">
            <li className="flex gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan" />
              <span>{SITE.address}</span>
            </li>
            <li className="flex gap-2.5">
              <Phone className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan" />
              <span>{SITE.phones.join(" · ")}</span>
            </li>
            <li className="flex gap-2.5">
              <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan" />
              <span className="break-all">{SITE.email}</span>
            </li>
            <li className="flex gap-2.5">
              <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan" />
              <span>Mon–Sat, Emergency Sundays</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-5">
        <div className="container-page flex flex-col items-center justify-between gap-2 text-xs text-white/50 sm:flex-row">
          <p>© {new Date().getFullYear()} {SITE.legalName}. All rights reserved.</p>
          <p>Ricabim House, Oba Adesida Rd, Akure, Ondo State</p>
        </div>
      </div>
    </footer>
  );
}
