"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { appointmentSchema, AppointmentInput, TIME_SLOTS } from "@/lib/validations";

type Service = { id: string; name: string; price: string };

export function BookingForm({ services }: { services: Service[] }) {
  const searchParams = useSearchParams();
  const preselected = searchParams.get("service") ?? "";
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AppointmentInput>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: { serviceId: preselected },
  });

  const onSubmit = async (data: AppointmentInput) => {
    setServerError(null);
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setServerError(body.error ?? "Something went wrong. Please try again.");
      return;
    }

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="card flex flex-col items-center gap-3 p-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green/10 text-green">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <h3 className="font-display text-xl font-bold text-navy">
          Appointment request received
        </h3>
        <p className="max-w-sm text-sm text-muted">
          Thank you — our team will confirm your appointment shortly by phone
          or email. If it&rsquo;s urgent, please chat with us on WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5 p-7">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Full Name</label>
          <input
            {...register("patientName")}
            className="w-full rounded-lg border border-border bg-off px-3.5 py-2.5 text-sm outline-none focus:border-blue"
            placeholder="Jane Doe"
          />
          {errors.patientName && (
            <p className="mt-1 text-xs text-red">{errors.patientName.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Phone Number</label>
          <input
            {...register("patientPhone")}
            className="w-full rounded-lg border border-border bg-off px-3.5 py-2.5 text-sm outline-none focus:border-blue"
            placeholder="080..."
          />
          {errors.patientPhone && (
            <p className="mt-1 text-xs text-red">{errors.patientPhone.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-ink">Email Address</label>
        <input
          {...register("patientEmail")}
          type="email"
          className="w-full rounded-lg border border-border bg-off px-3.5 py-2.5 text-sm outline-none focus:border-blue"
          placeholder="you@example.com"
        />
        {errors.patientEmail && (
          <p className="mt-1 text-xs text-red">{errors.patientEmail.message}</p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-ink">Service</label>
        <select
          {...register("serviceId")}
          className="w-full rounded-lg border border-border bg-off px-3.5 py-2.5 text-sm outline-none focus:border-blue"
          defaultValue={preselected}
        >
          <option value="">Select a service</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.price}
            </option>
          ))}
        </select>
        {errors.serviceId && (
          <p className="mt-1 text-xs text-red">{errors.serviceId.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Preferred Date</label>
          <input
            {...register("preferredDate")}
            type="date"
            min={new Date().toISOString().split("T")[0]}
            className="w-full rounded-lg border border-border bg-off px-3.5 py-2.5 text-sm outline-none focus:border-blue"
          />
          {errors.preferredDate && (
            <p className="mt-1 text-xs text-red">{errors.preferredDate.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Preferred Time</label>
          <select
            {...register("preferredTime")}
            className="w-full rounded-lg border border-border bg-off px-3.5 py-2.5 text-sm outline-none focus:border-blue"
          >
            <option value="">Select a time</option>
            {TIME_SLOTS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {errors.preferredTime && (
            <p className="mt-1 text-xs text-red">{errors.preferredTime.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-ink">
          Additional Notes (optional)
        </label>
        <textarea
          {...register("notes")}
          rows={3}
          className="w-full rounded-lg border border-border bg-off px-3.5 py-2.5 text-sm outline-none focus:border-blue"
          placeholder="Referral doctor, symptoms, or other details"
        />
      </div>

      {serverError && <p className="text-sm text-red">{serverError}</p>}

      <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full">
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Request Appointment
      </button>
    </form>
  );
}
