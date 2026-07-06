"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X } from "lucide-react";

export function AddPatientForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not create patient");
      return;
    }

    setForm({ name: "", email: "", phone: "", password: "" });
    setOpen(false);
    router.refresh();
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-primary">
        <Plus className="h-4 w-4" /> Add Patient
      </button>
    );
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-navy">New Patient Account</h3>
        <button onClick={() => setOpen(false)} className="text-muted hover:text-red">
          <X className="h-4 w-4" />
        </button>
      </div>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <input
          required
          placeholder="Full name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded-lg border border-border bg-off px-3.5 py-2.5 text-sm outline-none focus:border-blue"
        />
        <input
          required
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="rounded-lg border border-border bg-off px-3.5 py-2.5 text-sm outline-none focus:border-blue"
        />
        <input
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="rounded-lg border border-border bg-off px-3.5 py-2.5 text-sm outline-none focus:border-blue"
        />
        <input
          required
          type="password"
          placeholder="Temporary password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="rounded-lg border border-border bg-off px-3.5 py-2.5 text-sm outline-none focus:border-blue"
        />
        {error && <p className="text-sm text-red sm:col-span-2">{error}</p>}
        <button type="submit" disabled={loading} className="btn btn-primary sm:col-span-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Create Patient
        </button>
      </form>
    </div>
  );
}
