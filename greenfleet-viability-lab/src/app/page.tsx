import { Hero } from "@/components/landing/hero";
import { HowItWorksSection, PathwaysSection, PrincipleSection, SiteFooter } from "@/components/landing/sections";
import { SiteHeader } from "@/components/landing/site-header";

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <PathwaysSection />
        <HowItWorksSection />
        <PrincipleSection />
      </main>
      <SiteFooter />
    </>
  );
}
