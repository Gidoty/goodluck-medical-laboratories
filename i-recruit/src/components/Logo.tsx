import { useId } from "react";

/** The I-Recruit mark: hard hat over a course of bricks, inside an orange ring. */
export function LogoMark({ className = "", title }: { className?: string; title?: string }) {
  const id = useId();
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-labelledby={title ? id : undefined}
    >
      {title ? <title id={id}>{title}</title> : null}
      <circle cx="100" cy="100" r="100" fill="#f58b1e" />
      <circle cx="100" cy="100" r="88" fill="#ffffff" />
      <path d="M50 103 A50 48 0 0 1 150 103 Z" fill="#2c2d31" />
      <rect x="94" y="55.5" width="12" height="34" fill="#f58b1e" />
      <rect x="43" y="101" width="114" height="10" rx="5" fill="#2c2d31" />
      <rect x="54" y="119" width="44" height="13" rx="2" fill="#f58b1e" />
      <rect x="102" y="119" width="44" height="13" rx="2" fill="#f58b1e" />
      <rect x="34" y="136" width="42" height="13" rx="2" fill="#2c2d31" />
      <rect x="79" y="136" width="42" height="13" rx="2" fill="#2c2d31" />
      <rect x="124" y="136" width="42" height="13" rx="2" fill="#2c2d31" />
    </svg>
  );
}

export function Wordmark({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <span className="flex items-center gap-3">
      <LogoMark className="h-11 w-11 shrink-0" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.7rem] font-extrabold tracking-tight text-orange">
          I-Recruit
        </span>
        <span
          className={`mt-1 font-display text-[0.62rem] font-bold italic uppercase tracking-[0.2em] ${
            tone === "light" ? "text-white/80" : "text-charcoal/70"
          }`}
        >
          Masons &amp; Labour
        </span>
      </span>
    </span>
  );
}
