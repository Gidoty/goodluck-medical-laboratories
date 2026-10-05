"use client";

import { OPTIONS } from "@/domain/schema/options";
import { cn } from "@/lib/cn";
import { CURRENCIES, isCurrencyCode, type CurrencyCode } from "@/lib/currency";
import { inputClass } from "./field-shell";

export function CurrencySelect({ value, onChange, id, className }: { value: CurrencyCode; onChange: (c: CurrencyCode) => void; id: string; className?: string }) {
  return (
    <select id={id} value={value} className={cn(inputClass, "border-navy-200 py-2", className)} onChange={(e) => isCurrencyCode(e.target.value) && onChange(e.target.value)}>
      {OPTIONS.currency.map((o) => (
        <option key={o.id} value={o.id}>
          {o.id} ({CURRENCIES[o.id as CurrencyCode].symbol})
        </option>
      ))}
    </select>
  );
}
