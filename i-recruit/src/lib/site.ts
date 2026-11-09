export const SITE = {
  name: "I-Recruit",
  tagline: "Skilled Masons. Reliable Labour.",
  description:
    "I-Recruit sources, screens and places vetted masons and labourers from Nigeria, Cameroon and Kenya with construction companies across Alberta, Canada.",
  email: "i.recruitinfodesk@gmail.com",
  phone: { display: "+234 802 295 1081", tel: "+2348022951081" },
  whatsapp: { display: "+234 816 966 5671", number: "2348169665171" },
  address: {
    lines: ["Plot F4B, Sani Abacha Road", "GRA Phase 3", "Port Harcourt, Rivers State", "Nigeria"],
    street: "Plot F4B, Sani Abacha Road, GRA Phase 3",
    city: "Port Harcourt",
    region: "Rivers State",
    country: "NG",
  },
  serviceArea: "Alberta, Canada",
  sourceCountries: ["Nigeria", "Cameroon", "Kenya"],
} as const;

export const NAV = [
  { href: "/employers", label: "For Employers" },
  { href: "/workers", label: "For Workers" },
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export function whatsappLink(text?: string): string {
  const base = `https://wa.me/${SITE.whatsapp.number}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
