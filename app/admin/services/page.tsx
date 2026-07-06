import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ServiceRow } from "@/components/admin/service-row";
import { AddServiceForm } from "@/components/admin/add-service-form";

export const metadata: Metadata = { title: "Services | Admin" };

export const dynamic = "force-dynamic";

export default async function AdminServicesPage() {
  const services = await prisma.service.findMany({ orderBy: { order: "asc" } });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-navy">Services &amp; Pricing</h1>
          <p className="mt-1 text-sm text-muted">Manage what appears on the public services page</p>
        </div>
        <AddServiceForm />
      </div>

      <div className="mt-6 space-y-3">
        {services.map((s) => (
          <ServiceRow key={s.id} service={s} />
        ))}
      </div>
    </div>
  );
}
