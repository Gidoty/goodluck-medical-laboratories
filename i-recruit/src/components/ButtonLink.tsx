import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

type Variant = "primary" | "dark" | "ghost-light" | "ghost-dark";

const styles: Record<Variant, string> = {
  primary:
    "bg-orange text-ink hover:bg-orange-deep hover:text-white shadow-[0_8px_24px_-8px_rgb(245_139_30/0.7)]",
  dark: "bg-charcoal text-white hover:bg-ink",
  "ghost-light": "border-2 border-white/35 text-white hover:border-orange hover:text-orange",
  "ghost-dark": "border-2 border-charcoal/30 text-charcoal hover:border-charcoal hover:bg-charcoal hover:text-white",
};

export function ButtonLink({
  href,
  children,
  variant = "primary",
  arrow = true,
  external = false,
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: Variant;
  arrow?: boolean;
  external?: boolean;
  className?: string;
}) {
  const cls = `group inline-flex items-center justify-center gap-2 px-6 py-3.5 font-display text-lg font-bold uppercase tracking-wider transition-colors duration-200 ${styles[variant]} ${className}`;
  const inner = (
    <>
      {children}
      {arrow ? (
        <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
      ) : null}
    </>
  );
  if (external || /^(https?:|mailto:|tel:)/.test(href)) {
    return (
      <a
        href={href}
        className={cls}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}
