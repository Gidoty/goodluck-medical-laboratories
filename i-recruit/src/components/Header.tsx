"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { NAV } from "@/lib/site";
import { Wordmark } from "./Logo";

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-charcoal">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="I-Recruit home" className="shrink-0">
          <Wordmark tone="light" />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative px-4 py-2 font-display text-lg font-semibold uppercase tracking-wider transition-colors ${
                  active ? "text-orange" : "text-white/85 hover:text-white"
                }`}
              >
                {item.label}
                {active ? <span className="absolute inset-x-4 -bottom-0.5 h-0.5 bg-orange" /> : null}
              </Link>
            );
          })}
          <Link
            href="/employers#request"
            className="ml-4 bg-orange px-5 py-2.5 font-display text-lg font-bold uppercase tracking-wider text-ink transition-colors hover:bg-orange-deep hover:text-white"
          >
            Request Workers
          </Link>
        </nav>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center text-white lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
        </button>
      </div>

      {open ? (
        <div
          id="mobile-menu"
          className="fixed inset-x-0 top-[72px] bottom-0 z-40 overflow-y-auto bg-charcoal px-5 pb-10 pt-6 lg:hidden"
        >
          <nav aria-label="Mobile" className="flex flex-col">
            {[{ href: "/", label: "Home" }, ...NAV].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`border-b border-white/10 py-4 font-display text-3xl font-bold uppercase tracking-wide ${
                  pathname === item.href ? "text-orange" : "text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/employers#request"
              onClick={() => setOpen(false)}
              className="mt-8 bg-orange px-6 py-4 text-center font-display text-xl font-bold uppercase tracking-wider text-ink"
            >
              Request Workers
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
