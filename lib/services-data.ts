export const SERVICES_DATA = [
  {
    slug: "ultrasound-scanning",
    name: "Ultrasound Scanning",
    category: "Imaging",
    icon: "ultrasound",
    price: "From ₦8,000",
    featured: true,
    order: 1,
    description:
      "Obstetric, abdominal, pelvic, and soft-tissue ultrasound scans performed by experienced sonographers with fast, accurate reporting.",
  },
  {
    slug: "medical-microbiology",
    name: "Medical Microbiology",
    category: "Diagnostics",
    icon: "microbiology",
    price: "From ₦3,500",
    featured: true,
    order: 2,
    description:
      "Culture and sensitivity testing to identify infections and guide effective antibiotic treatment, including urine, stool, and wound cultures.",
  },
  {
    slug: "chemical-pathology",
    name: "Chemical Pathology",
    category: "Diagnostics",
    icon: "pathology",
    price: "From ₦4,000",
    featured: true,
    order: 3,
    description:
      "Comprehensive blood chemistry panels including liver function, kidney function, lipid profile, blood sugar, and electrolyte testing.",
  },
  {
    slug: "haematology-blood-serology",
    name: "Haematology & Blood Serology",
    category: "Diagnostics",
    icon: "haematology",
    price: "From ₦3,000",
    featured: true,
    order: 4,
    description:
      "Full blood count, genotype, blood grouping, HIV/Hepatitis/VDRL screening, and other serology tests with same-day results.",
  },
  {
    slug: "equipment-sales-supply",
    name: "Equipment Sales & Supply",
    category: "Supply",
    icon: "shield",
    price: "Request a quote",
    featured: false,
    order: 5,
    description:
      "Supply and installation of laboratory and diagnostic equipment for clinics, hospitals, and laboratories across Ondo State and beyond.",
  },
  {
    slug: "home-testing-services",
    name: "Home Testing Services",
    category: "Convenience",
    icon: "home",
    price: "From ₦5,000",
    featured: true,
    order: 6,
    description:
      "Our phlebotomists collect samples at your home or office, with results delivered securely to your patient portal — no need to visit the lab.",
  },
] as const;
