"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UploadCloud } from "lucide-react";

type Service = { id: string; name: string };

export function UploadResultForm({ patientId, services }: { patientId: string; services: Service[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("patientId", patientId);

    const res = await fetch("/api/results", { method: "POST", body: formData });

    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not save result");
      return;
    }

    (e.target as HTMLFormElement).reset();
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-5">
      <h3 className="flex items-center gap-2 font-display text-base font-bold text-navy">
        <UploadCloud className="h-4 w-4 text-blue" /> Upload New Result
      </h3>

      <input
        name="testName"
        required
        placeholder="Test name (e.g. Full Blood Count)"
        className="w-full rounded-lg border border-border bg-off px-3.5 py-2.5 text-sm outline-none focus:border-blue"
      />

      <select
        name="serviceId"
        className="w-full rounded-lg border border-border bg-off px-3.5 py-2.5 text-sm outline-none focus:border-blue"
      >
        <option value="">No specific service</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <select
        name="status"
        defaultValue="READY"
        className="w-full rounded-lg border border-border bg-off px-3.5 py-2.5 text-sm outline-none focus:border-blue"
      >
        <option value="READY">Ready</option>
        <option value="PENDING">Pending / Processing</option>
      </select>

      <textarea
        name="notes"
        rows={2}
        placeholder="Notes (optional)"
        className="w-full rounded-lg border border-border bg-off px-3.5 py-2.5 text-sm outline-none focus:border-blue"
      />

      <input
        name="file"
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-blue-light file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue"
      />

      {error && <p className="text-sm text-red">{error}</p>}

      <button type="submit" disabled={loading} className="btn btn-primary w-full">
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Save Result
      </button>
    </form>
  );
}
