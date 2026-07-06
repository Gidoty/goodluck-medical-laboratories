"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function StatusSelect({
  id,
  status,
  options,
  endpoint,
}: {
  id: string;
  status: string;
  options: string[];
  endpoint: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [loading, setLoading] = useState(false);

  const onChange = async (newStatus: string) => {
    setValue(newStatus);
    setLoading(true);
    await fetch(`${endpoint}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-blue"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />}
    </div>
  );
}
