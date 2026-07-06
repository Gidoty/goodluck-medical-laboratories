import type { Metadata } from "next";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { StatusSelect } from "@/components/admin/status-select";

export const metadata: Metadata = { title: "Appointments | Admin" };

export const dynamic = "force-dynamic";

export default async function AdminAppointmentsPage() {
  const appointments = await prisma.appointment.findMany({
    include: { service: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold text-navy">Appointments</h1>
      <p className="mt-1 text-sm text-muted">{appointments.length} total requests</p>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-off text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Date &amp; Time</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((a) => (
              <tr key={a.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-ink">{a.patientName}</td>
                <td className="px-4 py-3 text-muted">{a.service?.name ?? "—"}</td>
                <td className="px-4 py-3 text-muted">
                  {format(a.preferredDate, "d MMM yyyy")} · {a.preferredTime}
                </td>
                <td className="px-4 py-3 text-muted">
                  <div>{a.patientPhone}</div>
                  <div className="text-xs">{a.patientEmail}</div>
                </td>
                <td className="px-4 py-3">
                  <StatusSelect
                    id={a.id}
                    status={a.status}
                    endpoint="/api/appointments"
                    options={["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]}
                  />
                </td>
              </tr>
            ))}
            {appointments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  No appointments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
