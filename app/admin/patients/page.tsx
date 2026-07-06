import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AddPatientForm } from "@/components/admin/add-patient-form";

export const metadata: Metadata = { title: "Patients | Admin" };

export const dynamic = "force-dynamic";

export default async function AdminPatientsPage() {
  const patients = await prisma.user.findMany({
    where: { role: "PATIENT" },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { results: true, appointments: true } } },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-navy">Patients</h1>
          <p className="mt-1 text-sm text-muted">{patients.length} registered patients</p>
        </div>
        <AddPatientForm />
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border bg-off text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Results</th>
              <th className="px-4 py-3">Appointments</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-ink">{p.name}</td>
                <td className="px-4 py-3 text-muted">{p.email}</td>
                <td className="px-4 py-3 text-muted">{p._count.results}</td>
                <td className="px-4 py-3 text-muted">{p._count.appointments}</td>
                <td className="px-4 py-3 text-muted">{format(p.createdAt, "d MMM yyyy")}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/patients/${p.id}`}
                    className="flex items-center gap-1 text-sm font-semibold text-blue hover:underline"
                  >
                    View <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
            {patients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  No patients registered yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
