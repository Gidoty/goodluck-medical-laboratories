import type { Metadata, Viewport } from "next";
import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-500.css";
import "@fontsource/barlow/latin-600.css";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/barlow-condensed/latin-700-italic.css";
import "@fontsource/barlow-condensed/latin-800.css";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import { JsonLd } from "@/components/JsonLd";
import { SITE, siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "I-Recruit | Skilled Masons and Reliable Labour for Alberta",
    template: "%s | I-Recruit",
  },
  description: SITE.description,
  applicationName: "I-Recruit",
  keywords: [
    "construction recruitment Alberta",
    "mason recruitment",
    "bricklayer staffing Alberta",
    "construction labour supply",
    "skilled trades recruitment Canada",
  ],
  openGraph: {
    type: "website",
    siteName: "I-Recruit",
    locale: "en_CA",
    title: "I-Recruit | Skilled Masons. Reliable Labour.",
    description: SITE.description,
  },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "./" },
  ...(process.env.NEXT_PUBLIC_NOINDEX === "1" ? { robots: { index: false, follow: false } } : {}),
};

export const viewport: Viewport = {
  themeColor: "#2c2d31",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA">
      <body>
        <a
          href="#main"
          className="sr-only z-[100] bg-orange px-4 py-3 font-display text-lg font-bold uppercase text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <WhatsAppFloat />
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "EmploymentAgency",
            name: SITE.name,
            description: SITE.description,
            url: siteUrl(),
            email: SITE.email,
            telephone: SITE.phone.tel,
            slogan: SITE.tagline,
            address: {
              "@type": "PostalAddress",
              streetAddress: SITE.address.street,
              addressLocality: SITE.address.city,
              addressRegion: SITE.address.region,
              addressCountry: SITE.address.country,
            },
            areaServed: { "@type": "AdministrativeArea", name: "Alberta, Canada" },
          }}
        />
      </body>
    </html>
  );
}
