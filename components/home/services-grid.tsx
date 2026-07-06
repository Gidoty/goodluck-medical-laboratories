import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getIcon } from "@/lib/icons";
import { Reveal } from "@/components/reveal";

export async function ServicesGrid() {
  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
  });

  return (
    <section id="services" className="section-pad">
      <div className="container-page">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="badge border border-border bg-blue-light text-blue">
            What We Offer
          </span>
          <h2 className="mt-4 font-display text-3xl font-extrabold text-navy sm:text-4xl">
            Comprehensive laboratory services
          </h2>
          <p className="mt-3 text-muted">
            From routine blood work to specialist imaging, our accredited
            team handles every stage of your diagnostic journey.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service, i) => {
            const Icon = getIcon(service.icon);
            return (
              <Reveal key={service.id} delay={i * 60}>
                <Link
                  href={`/services#${service.slug}`}
                  className="card group flex h-full flex-col p-6 transition-transform hover:-translate-y-1 hover:shadow-lg"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-light text-blue transition-colors group-hover:bg-blue group-hover:text-white">
                    <Icon className="h-6 w-6" strokeWidth={2} />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold text-navy">
                    {service.name}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                    {service.description}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                    <span className="text-sm font-semibold text-blue">
                      {service.price}
                    </span>
                    <ArrowRight className="h-4 w-4 text-faint transition-transform group-hover:translate-x-1 group-hover:text-blue" />
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
