"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Check, X } from "lucide-react";

type Service = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: string;
  active: boolean;
};

export function ServiceRow({ service }: { service: Service }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: service.name,
    price: service.price,
    description: service.description,
  });

  const save = async () => {
    setLoading(true);
    await fetch(`/api/services/${service.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    setEditing(false);
    router.refresh();
  };

  const toggleActive = async () => {
    setLoading(true);
    await fetch(`/api/services/${service.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !service.active }),
    });
    setLoading(false);
    router.refresh();
  };

  if (editing) {
    return (
      <div className="card space-y-3 p-4">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full rounded-lg border border-border bg-off px-3 py-2 text-sm outline-none focus:border-blue"
        />
        <input
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          className="w-full rounded-lg border border-border bg-off px-3 py-2 text-sm outline-none focus:border-blue"
        />
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={2}
          className="w-full rounded-lg border border-border bg-off px-3 py-2 text-sm outline-none focus:border-blue"
        />
        <div className="flex gap-2">
          <button onClick={save} disabled={loading} className="btn btn-primary !py-1.5 !px-3 text-xs">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Save
          </button>
          <button onClick={() => setEditing(false)} className="btn btn-outline !py-1.5 !px-3 text-xs">
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card flex items-center justify-between p-4">
      <div>
        <p className="text-sm font-semibold text-ink">{service.name}</p>
        <p className="text-xs text-muted">{service.category} · {service.price}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`badge ${service.active ? "bg-green/10 text-green" : "bg-off text-muted"}`}>
          {service.active ? "Active" : "Hidden"}
        </span>
        <button onClick={() => setEditing(true)} className="text-muted hover:text-blue" aria-label="Edit">
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={toggleActive}
          disabled={loading}
          className="text-xs font-semibold text-blue hover:underline"
        >
          {service.active ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
