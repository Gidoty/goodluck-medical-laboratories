import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { FileText, CalendarClock, ArrowRight, FlaskConical } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "My Portal | Goodluck Medical Laboratories" };

const STATUS_STYLES: Record<string, string> = {
  READY: "bg-green/10 text-green",
  PENDING: "bg-amber/10 text-amber",
  CONFIRMED: "bg-blue-light text-blue",
  CANCELLED: "bg-red/10 text-red",
  COMPLETED: "bg-green/10 text-green",
};

export default async function PortalPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [user, results, appointments] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.testResult.findMany({
      where: { patientId: userId },
      include: { service: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.appointment.findMany({
      where: { userId },
      include: { service: true },
      orderBy: { preferredDate: "desc" },
    }),
  ]);

  return (
    <div className="section-pad">
      <div className="container-page">
        <div className="mb-10 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue text-white">
            <FlaskConical className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-extrabold text-navy">
              Welcome back, {user?.name?.split(" ")[0]}
            </h1>
            <p className="text-sm text-muted">Here&rsquo;s an overview of your lab activity</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <section>
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-navy">
              <FileText className="h-5 w-5 text-blue" /> My Test Results
            </h2>
            {results.length === 0 ? (
              <div className="card p-6 text-sm text-muted">
                You have no test results yet. Once your samples are processed,
                results will appear here.
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((r) => (
                  <Link
                    key={r.id}
                    href={`/portal/results/${r.id}`}
                    className="card flex items-center justify-between p-4 transition-colors hover:border-blue"
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink">{r.testName}</p>
                      <p className="text-xs text-muted">
                        {r.service?.name ?? "General"} · {format(r.resultDate, "d MMM yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`badge ${STATUS_STYLES[r.status]}`}>{r.status}</span>
                      <ArrowRight className="h-4 w-4 text-faint" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-navy">
              <CalendarClock className="h-5 w-5 text-blue" /> My Appointments
            </h2>
            {appointments.length === 0 ? (
              <div className="card p-6 text-sm text-muted">
                No appointments booked yet.{" "}
                <Link href="/book" className="font-semibold text-blue hover:underline">
                  Book one now
                </Link>
                .
              </div>
            ) : (
              <div className="space-y-3">
                {appointments.map((a) => (
                  <div key={a.id} className="card flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {a.service?.name ?? "General consultation"}
                      </p>
                      <p className="text-xs text-muted">
                        {format(a.preferredDate, "d MMM yyyy")} · {a.preferredTime}
                      </p>
                    </div>
                    <span className={`badge ${STATUS_STYLES[a.status]}`}>{a.status}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
