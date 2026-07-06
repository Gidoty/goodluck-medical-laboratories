import { Hero } from "@/components/home/hero";
import { Ticker } from "@/components/home/ticker";
import { ServicesGrid } from "@/components/home/services-grid";
import { HowItWorks } from "@/components/home/how-it-works";
import { WhyUs } from "@/components/home/why-us";
import { Stats } from "@/components/home/stats";
import { PortalPromo } from "@/components/home/portal-promo";
import { Testimonials } from "@/components/home/testimonials";
import { FinalCta } from "@/components/home/final-cta";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <>
      <Hero />
      <Ticker />
      <ServicesGrid />
      <HowItWorks />
      <Stats />
      <WhyUs />
      <PortalPromo />
      <Testimonials />
      <FinalCta />
    </>
  );
}
