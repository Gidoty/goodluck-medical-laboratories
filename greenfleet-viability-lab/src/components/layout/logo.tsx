import Link from "next/link";
import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="8" className="fill-forest-700" />
      <path d="M7 22c4.5 0 5-6 9-6s4.5-5 9-5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="7" cy="22" r="2.4" fill="#fff" />
      <circle cx="25" cy="11" r="2.4" fill="#fff" />
    </svg>
  );
}

export function Logo({ href = "/", light }: { href?: string; light?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-md" aria-label="GreenFleet Viability Lab, home">
      <LogoMark />
      <span className="leading-tight">
        <span className={cn("block text-sm font-bold tracking-tight", light ? "text-white" : "text-navy-950")}>GreenFleet</span>
        <span className={cn("block text-xs font-medium", light ? "text-forest-200" : "text-forest-700")}>Viability Lab</span>
      </span>
    </Link>
  );
}
