import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarCheck, MessageCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { BookingForm } from "@/components/booking-form";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Book an Appointment | Goodluck Medical Laboratories",
  description: "Schedule your lab test, ultrasound scan, or home sample collection online.",
};

export const dynamic = "force-dynamic";

export default async function BookPage() {
  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
    select: { id: true, name: true, price: true },
  });

  return (
    <div className="section-pad">
      <div className="container-page grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <span className="badge border border-border bg-blue-light text-blue">
            <CalendarCheck className="h-3.5 w-3.5" /> Book an Appointment
          </span>
          <h1 className="mt-4 font-display text-3xl font-extrabold text-navy sm:text-4xl">
            Schedule your visit or home collection
          </h1>
          <p className="mt-3 max-w-md text-muted">
            Fill in the form and our team will confirm your appointment by
            phone or email — usually within a few hours. For urgent requests,
            reach us directly on WhatsApp.
          </p>
          <a
            href={SITE.whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-whatsapp mt-6"
          >
            <MessageCircle className="h-5 w-5" /> Chat on WhatsApp instead
          </a>
        </div>

        <Suspense fallback={<div className="card p-7 text-sm text-muted">Loading form…</div>}>
          <BookingForm services={services} />
        </Suspense>
      </div>
    </div>
  );
}
