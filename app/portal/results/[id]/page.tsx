import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ResultDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const result = await prisma.testResult.findUnique({
    where: { id },
    include: { service: true },
  });

  if (!result || result.patientId !== session!.user.id) {
    notFound();
  }

  return (
    <div className="section-pad">
      <div className="container-page mx-auto max-w-2xl">
        <Link href="/portal" className="mb-6 flex items-center gap-1.5 text-sm font-semibold text-blue hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to portal
        </Link>

        <div className="card p-7">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-display text-2xl font-extrabold text-navy">
                {result.testName}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {result.service?.name ?? "General"} · {format(result.resultDate, "d MMMM yyyy")}
              </p>
            </div>
            <span
              className={`badge ${
                result.status === "READY" ? "bg-green/10 text-green" : "bg-amber/10 text-amber"
              }`}
            >
              {result.status}
            </span>
          </div>

          {result.notes && (
            <div className="mt-6 rounded-xl bg-off p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-faint">
                Notes from the lab
              </p>
              <p className="mt-1.5 text-sm text-ink/80">{result.notes}</p>
            </div>
          )}

          <div className="mt-6 border-t border-border pt-6">
            {result.status !== "READY" ? (
              <p className="text-sm text-muted">
                Your result is still being processed. You&rsquo;ll be able to
                download it here as soon as it&rsquo;s ready.
              </p>
            ) : result.filePath ? (
              <a
                href={`/api/results/${result.id}/download`}
                className="btn btn-primary"
              >
                <Download className="h-4 w-4" /> Download Result
              </a>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted">
                <FileText className="h-4 w-4" /> No file attached — please
                contact the lab if you need a document copy.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
