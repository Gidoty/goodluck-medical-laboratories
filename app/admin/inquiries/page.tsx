import type { Metadata } from "next";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { StatusSelect } from "@/components/admin/status-select";

export const metadata: Metadata = { title: "Inquiries | Admin" };

export const dynamic = "force-dynamic";

export default async function AdminInquiriesPage() {
  const inquiries = await prisma.inquiry.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold text-navy">Inquiries</h1>
      <p className="mt-1 text-sm text-muted">{inquiries.length} messages received</p>

      <div className="mt-6 space-y-4">
        {inquiries.map((inq) => (
          <div key={inq.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{inq.subject}</p>
                <p className="text-xs text-muted">
                  {inq.name} · {inq.email} {inq.phone ? `· ${inq.phone}` : ""} ·{" "}
                  {format(inq.createdAt, "d MMM yyyy, h:mm a")}
                </p>
              </div>
              <StatusSelect
                id={inq.id}
                status={inq.status}
                endpoint="/api/inquiries"
                options={["NEW", "READ", "RESPONDED"]}
              />
            </div>
            <p className="mt-3 text-sm text-ink/80">{inq.message}</p>
          </div>
        ))}
        {inquiries.length === 0 && (
          <div className="card p-8 text-center text-sm text-muted">No inquiries yet.</div>
        )}
      </div>
    </div>
  );
}
