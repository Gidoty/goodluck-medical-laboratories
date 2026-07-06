import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getIcon } from "@/lib/icons";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = {
  title: "Our Services | Goodluck Medical Laboratories",
  description:
    "Explore ultrasound scanning, medical microbiology, chemical pathology, haematology, equipment supply, and home testing services in Akure.",
};

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
  });

  return (
    <div className="section-pad">
      <div className="container-page">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="badge border border-border bg-blue-light text-blue">
            Our Services
          </span>
          <h1 className="mt-4 font-display text-4xl font-extrabold text-navy">
            Complete diagnostic care, under one roof
          </h1>
          <p className="mt-3 text-muted">
            Every service below can be booked online. Prices are starting
            estimates — final cost depends on the specific test requested.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {services.map((service, i) => {
            const Icon = getIcon(service.icon);
            return (
              <Reveal key={service.id} delay={i * 60}>
                <div id={service.slug} className="card scroll-mt-28 p-7">
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-light text-blue">
                      <Icon className="h-6 w-6" strokeWidth={2} />
                    </span>
                    <span className="badge bg-off text-muted">{service.category}</span>
                  </div>
                  <h2 className="mt-4 font-display text-xl font-bold text-navy">
                    {service.name}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {service.description}
                  </p>
                  <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                    <span className="font-display text-base font-bold text-blue">
                      {service.price}
                    </span>
                    <Link
                      href={`/book?service=${service.id}`}
                      className="flex items-center gap-1.5 text-sm font-semibold text-navy hover:text-blue"
                    >
                      Book this <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal className="mt-14 text-center">
          <Link href="/book" className="btn btn-primary">
            <CalendarCheck className="h-5 w-5" /> Book an Appointment
          </Link>
        </Reveal>
      </div>
    </div>
  );
}
