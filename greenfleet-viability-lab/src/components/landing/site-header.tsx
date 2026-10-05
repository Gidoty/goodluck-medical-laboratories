import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { HelpButton } from "@/guidance/HelpButtons";
import { ButtonLink } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Logo />
        <nav aria-label="Site" className="flex items-center gap-1 sm:gap-3">
          <Link href="/methodology" className="hidden rounded-md px-3 py-2 text-sm font-medium text-navy-700 hover:bg-navy-100 sm:inline-block">
            Methodology
          </Link>
          <Link href="/about" className="hidden rounded-md px-3 py-2 text-sm font-medium text-navy-700 hover:bg-navy-100 sm:inline-block">
            About
          </Link>
          <HelpButton />
          <ButtonLink href="/overview" variant="secondary" size="sm">
            Open workspace
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
