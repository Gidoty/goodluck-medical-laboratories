import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Notice",
  description: "How I-Recruit handles the information you send us.",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Privacy notice" />
      <section className="px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-3xl space-y-8 text-lg text-charcoal">
          <div>
            <h2 className="text-3xl font-extrabold uppercase">What this website collects</h2>
            <p className="mt-3 text-muted">
              This website does not store the details you type into its forms. When you press send, the form opens
              WhatsApp or your email app with your message filled in. I-Recruit receives the information only when
              you send that message.
            </p>
          </div>
          <div>
            <h2 className="text-3xl font-extrabold uppercase">How we use your information</h2>
            <p className="mt-3 text-muted">
              We use the details you send us to reply to your enquiry, to assess and screen candidates, and to match
              workers with employers. If you register as a worker, we may share your professional details with
              prospective employers as part of a placement.
            </p>
          </div>
          <div>
            <h2 className="text-3xl font-extrabold uppercase">Third-party services</h2>
            <p className="mt-3 text-muted">
              Messages sent through WhatsApp or email are handled by those services under their own privacy terms.
            </p>
          </div>
          <div>
            <h2 className="text-3xl font-extrabold uppercase">Your choices</h2>
            <p className="mt-3 text-muted">
              To ask what we hold about you, or to have it deleted, email{" "}
              <a className="font-semibold text-orange-ink underline underline-offset-4" href={`mailto:${SITE.email}`}>
                {SITE.email}
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
