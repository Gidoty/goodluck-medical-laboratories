"use client";

import { useId, useRef, useState } from "react";
import { Mail, MessageCircle } from "lucide-react";
import { SITE, whatsappLink } from "@/lib/site";

type Kind = "employer" | "worker" | "general";

type Field = {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "number" | "textarea" | "select";
  options?: string[];
  required?: boolean;
  placeholder?: string;
  wide?: boolean;
};

const FIELDS: Record<Kind, { title: string; fields: Field[] }> = {
  employer: {
    title: "Employer staffing request",
    fields: [
      { name: "company", label: "Company name", required: true },
      { name: "name", label: "Your name", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "phone", label: "Phone or WhatsApp", type: "tel" },
      { name: "trade", label: "Trade needed", type: "select", options: ["Masons / Bricklayers", "Labourers", "Both"], required: true },
      { name: "headcount", label: "Number of workers", type: "number", required: true, placeholder: "e.g. 6" },
      { name: "location", label: "Project location in Alberta", placeholder: "e.g. Calgary, Edmonton, Fort McMurray" },
      { name: "start", label: "Target start date", placeholder: "e.g. March 2027" },
      { name: "details", label: "Project details", type: "textarea", wide: true, placeholder: "Scope, duration, certifications or equipment required" },
    ],
  },
  worker: {
    title: "Worker registration",
    fields: [
      { name: "name", label: "Full name", required: true },
      { name: "country", label: "Country", type: "select", options: ["Nigeria", "Cameroon", "Kenya", "Other"], required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "phone", label: "Phone or WhatsApp", type: "tel", required: true },
      { name: "trade", label: "Your trade", type: "select", options: ["Mason / Bricklayer", "Labourer", "Both"], required: true },
      { name: "years", label: "Years of experience", type: "number", required: true, placeholder: "e.g. 5" },
      { name: "details", label: "Work history and certifications", type: "textarea", wide: true, placeholder: "Types of projects, employers, trade certificates, safety training" },
    ],
  },
  general: {
    title: "Send us a message",
    fields: [
      { name: "name", label: "Your name", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "phone", label: "Phone or WhatsApp", type: "tel" },
      { name: "topic", label: "I am a", type: "select", options: ["Employer", "Worker", "Other"], required: true },
      { name: "details", label: "Message", type: "textarea", wide: true, required: true },
    ],
  },
};

const input =
  "w-full border-2 border-charcoal/20 bg-white px-4 py-3 text-ink transition-colors placeholder:text-charcoal/40 focus:border-orange focus:outline-none";

export function EnquiryForm({ kind, id }: { kind: Kind; id?: string }) {
  const config = FIELDS[kind];
  const formRef = useRef<HTMLFormElement>(null);
  const uid = useId();
  const [hint, setHint] = useState("");

  function compose(): string | null {
    const form = formRef.current;
    if (!form || !form.reportValidity()) return null;
    const data = new FormData(form);
    const lines = config.fields
      .map((f) => {
        const v = String(data.get(f.name) ?? "").trim();
        return v ? `${f.label}: ${v}` : null;
      })
      .filter(Boolean);
    return `${config.title} (I-Recruit website)\n\n${lines.join("\n")}`;
  }

  function sendWhatsApp() {
    const text = compose();
    if (!text) return;
    window.open(whatsappLink(text), "_blank", "noopener,noreferrer");
    setHint("WhatsApp opened with your details filled in. Press send there to finish.");
  }

  function sendEmail() {
    const text = compose();
    if (!text) return;
    const subject = `${config.title} - I-Recruit`;
    window.location.href = `mailto:${SITE.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    setHint("Your email app opened with your details filled in. Press send there to finish.");
  }

  return (
    <form ref={formRef} id={id} onSubmit={(e) => e.preventDefault()} noValidate={false} className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        {config.fields.map((f) => {
          const fid = `${uid}-${f.name}`;
          return (
            <div key={f.name} className={f.wide ? "sm:col-span-2" : ""}>
              <label htmlFor={fid} className="mb-1.5 block text-sm font-semibold uppercase tracking-wider text-charcoal">
                {f.label}
                {f.required ? <span className="text-orange-ink"> *</span> : null}
              </label>
              {f.type === "textarea" ? (
                <textarea id={fid} name={f.name} rows={5} required={f.required} placeholder={f.placeholder} className={input} />
              ) : f.type === "select" ? (
                <select id={fid} name={f.name} required={f.required} defaultValue="" className={input}>
                  <option value="" disabled>
                    Select
                  </option>
                  {f.options?.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={fid}
                  name={f.name}
                  type={f.type ?? "text"}
                  min={f.type === "number" ? 0 : undefined}
                  required={f.required}
                  placeholder={f.placeholder}
                  autoComplete={f.name === "email" ? "email" : f.name === "name" ? "name" : f.type === "tel" ? "tel" : undefined}
                  className={input}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={sendWhatsApp}
          className="inline-flex items-center justify-center gap-2 bg-orange px-6 py-3.5 font-display text-lg font-bold uppercase tracking-wider text-ink transition-colors hover:bg-orange-deep hover:text-white"
        >
          <MessageCircle className="h-5 w-5" aria-hidden /> Send via WhatsApp
        </button>
        <button
          type="button"
          onClick={sendEmail}
          className="inline-flex items-center justify-center gap-2 border-2 border-charcoal px-6 py-3.5 font-display text-lg font-bold uppercase tracking-wider text-charcoal transition-colors hover:bg-charcoal hover:text-white"
        >
          <Mail className="h-5 w-5" aria-hidden /> Send by email
        </button>
      </div>
      <p role="status" className="min-h-6 text-sm text-muted">
        {hint || "We reply by email or WhatsApp. Your details go straight to I-Recruit and are not stored on this website."}
      </p>
    </form>
  );
}
