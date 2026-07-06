"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Menu, X, FlaskConical, LogOut, LayoutDashboard } from "lucide-react";
import { SITE } from "@/lib/site";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#testimonials", label: "Testimonials" },
  { href: "/contact", label: "Contact" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const isAdminArea = pathname?.startsWith("/admin");
  const isPortalArea = pathname?.startsWith("/portal");

  return (
    <header className="sticky top-0 z-[100] border-b border-border/70 bg-white/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between sm:h-[4.5rem]">
        <Link href="/" className="flex items-center gap-2 font-display">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue text-white">
            <FlaskConical className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-[0.95rem] font-bold text-navy sm:text-base">
              Goodluck Medical
            </span>
            <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-cyan">
              Laboratories Limited
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted transition-colors hover:text-blue"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {status === "authenticated" ? (
            <>
              <Link
                href={session.user.role === "ADMIN" ? "/admin" : "/portal"}
                className="btn btn-outline !py-2.5 !px-4 text-sm"
              >
                <LayoutDashboard className="h-4 w-4" />
                {session.user.role === "ADMIN" ? "Admin Dashboard" : "My Results"}
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-red"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-semibold text-blue hover:text-blue-dark">
                Patient Login
              </Link>
              <Link href="/book" className="btn btn-primary !py-2.5 !px-5 text-sm">
                Book Appointment
              </Link>
            </>
          )}
        </div>

        <button
          className="flex h-10 w-10 items-center justify-center rounded-lg text-navy lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-white lg:hidden">
          <div className="container-page flex flex-col gap-1 py-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-blue-light"
              >
                {link.label}
              </Link>
            ))}
            <div className="my-2 h-px bg-border" />
            {status === "authenticated" ? (
              <>
                <Link
                  href={session.user.role === "ADMIN" ? "/admin" : "/portal"}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-semibold text-blue"
                >
                  {session.user.role === "ADMIN" ? "Admin Dashboard" : "My Results"}
                </Link>
                <button
                  onClick={() => {
                    setOpen(false);
                    signOut({ callbackUrl: "/" });
                  }}
                  className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-semibold text-blue"
              >
                Patient / Staff Login
              </Link>
            )}
            <Link
              href="/book"
              onClick={() => setOpen(false)}
              className="btn btn-primary mt-2 w-full text-sm"
            >
              Book Appointment
            </Link>
          </div>
        </div>
      )}
      {(isAdminArea || isPortalArea) && (
        <div className="bg-navy py-1.5 text-center text-xs font-medium text-white/80">
          {isAdminArea ? "Staff Admin Area" : "Patient Portal"} — {SITE.legalName}
        </div>
      )}
    </header>
  );
}
