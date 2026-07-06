import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { UploadResultForm } from "@/components/admin/upload-result-form";

export default async function AdminPatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [patient, services] = await Promise.all([
    prisma.user.findUnique({
      where: { id, role: "PATIENT" },
      include: {
        results: { include: { service: true }, orderBy: { createdAt: "desc" } },
        appointments: { include: { service: true }, orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.service.findMany({ where: { active: true }, select: { id: true, name: true } }),
  ]);

  if (!patient) notFound();

  return (
    <div>
      <Link href="/admin/patients" className="mb-6 flex items-center gap-1.5 text-sm font-semibold text-blue hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to patients
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-navy">{patient.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {patient.email} {patient.phone ? `· ${patient.phone}` : ""} · Joined{" "}
            {format(patient.createdAt, "d MMM yyyy")}
          </p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 font-display text-base font-bold text-navy">Test Results</h2>
            <div className="space-y-3">
              {patient.results.map((r) => (
                <div key={r.id} className="card flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-semibold text-ink">{r.testName}</p>
                    <p className="text-xs text-muted">
                      {r.service?.name ?? "General"} · {format(r.createdAt, "d MMM yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`badge ${
                        r.status === "READY" ? "bg-green/10 text-green" : "bg-amber/10 text-amber"
                      }`}
                    >
                      {r.status}
                    </span>
                    {r.filePath && (
                      <a
                        href={`/api/results/${r.id}/download`}
                        className="text-blue hover:text-blue-dark"
                        aria-label="Download result"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {patient.results.length === 0 && (
                <div className="card p-5 text-sm text-muted">No results uploaded yet.</div>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-3 font-display text-base font-bold text-navy">Appointments</h2>
            <div className="space-y-3">
              {patient.appointments.map((a) => (
                <div key={a.id} className="card flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-semibold text-ink">{a.service?.name ?? "General"}</p>
                    <p className="text-xs text-muted">
                      {format(a.preferredDate, "d MMM yyyy")} · {a.preferredTime}
                    </p>
                  </div>
                  <span className="badge bg-blue-light text-blue">{a.status}</span>
                </div>
              ))}
              {patient.appointments.length === 0 && (
                <div className="card p-5 text-sm text-muted">No appointments booked yet.</div>
              )}
            </div>
          </section>
        </div>

        <UploadResultForm patientId={patient.id} services={services} />
      </div>
    </div>
  );
}
