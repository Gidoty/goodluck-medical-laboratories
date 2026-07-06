const ITEMS = [
  "Ultrasound Scanning",
  "Medical Microbiology",
  "Chemical Pathology",
  "Haematology & Blood Serology",
  "Equipment Sales & Supply",
  "Home Testing Services",
  "Secure Online Results",
];

export function Ticker() {
  const items = [...ITEMS, ...ITEMS];
  return (
    <div className="overflow-hidden border-y border-border bg-navy py-3">
      <div className="ticker-track">
        {items.map((item, i) => (
          <span
            key={i}
            className="mx-4 flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-white/80"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
