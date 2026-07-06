import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { Download } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Test Results | Admin" };

export const dynamic = "force-dynamic";

export default async function AdminResultsPage() {
  const results = await prisma.testResult.findMany({
    include: { patient: true, service: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold text-navy">Test Results</h1>
      <p className="mt-1 text-sm text-muted">{results.length} results across all patients</p>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-off text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Test</th>
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/admin/patients/${r.patientId}`} className="font-medium text-blue hover:underline">
                    {r.patient.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink">{r.testName}</td>
                <td className="px-4 py-3 text-muted">{r.service?.name ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{format(r.createdAt, "d MMM yyyy")}</td>
                <td className="px-4 py-3">
                  <span
                    className={`badge ${
                      r.status === "READY" ? "bg-green/10 text-green" : "bg-amber/10 text-amber"
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {r.filePath && (
                    <a href={`/api/results/${r.id}/download`} className="text-blue hover:text-blue-dark">
                      <Download className="h-4 w-4" />
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {results.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  No results uploaded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
