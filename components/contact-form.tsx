"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { inquirySchema, InquiryInput } from "@/lib/validations";

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InquiryInput>({ resolver: zodResolver(inquirySchema) });

  const onSubmit = async (data: InquiryInput) => {
    setServerError(null);
    const res = await fetch("/api/inquiries", {
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
        <h3 className="font-display text-xl font-bold text-navy">Message sent</h3>
        <p className="max-w-sm text-sm text-muted">
          Thanks for reaching out — we&rsquo;ll respond to your enquiry as soon as possible.
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
            {...register("name")}
            className="w-full rounded-lg border border-border bg-off px-3.5 py-2.5 text-sm outline-none focus:border-blue"
            placeholder="Your name"
          />
          {errors.name && <p className="mt-1 text-xs text-red">{errors.name.message}</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Phone (optional)</label>
          <input
            {...register("phone")}
            className="w-full rounded-lg border border-border bg-off px-3.5 py-2.5 text-sm outline-none focus:border-blue"
            placeholder="080..."
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-ink">Email Address</label>
        <input
          {...register("email")}
          type="email"
          className="w-full rounded-lg border border-border bg-off px-3.5 py-2.5 text-sm outline-none focus:border-blue"
          placeholder="you@example.com"
        />
        {errors.email && <p className="mt-1 text-xs text-red">{errors.email.message}</p>}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-ink">Subject</label>
        <input
          {...register("subject")}
          className="w-full rounded-lg border border-border bg-off px-3.5 py-2.5 text-sm outline-none focus:border-blue"
          placeholder="What is this about?"
        />
        {errors.subject && <p className="mt-1 text-xs text-red">{errors.subject.message}</p>}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-ink">Message</label>
        <textarea
          {...register("message")}
          rows={5}
          className="w-full rounded-lg border border-border bg-off px-3.5 py-2.5 text-sm outline-none focus:border-blue"
          placeholder="How can we help?"
        />
        {errors.message && <p className="mt-1 text-xs text-red">{errors.message.message}</p>}
      </div>

      {serverError && <p className="text-sm text-red">{serverError}</p>}

      <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full">
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Send Message
      </button>
    </form>
  );
}
