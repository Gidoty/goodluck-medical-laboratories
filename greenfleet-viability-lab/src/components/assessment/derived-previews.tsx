"use client";

import { AssumptionBadge } from "@/components/ui/assumption-badge";
import { deriveOperations } from "@/domain/derive";
import { createReader } from "@/domain/reader";
import type { Assessment } from "@/domain/stored";
import { formatNumber, formatQuantity, EMPTY_VALUE } from "@/lib/format";

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-1.5">
      <dt className="text-sm text-navy-800">{label}</dt>
      <dd className="text-sm font-semibold text-navy-950">
        {value}
        {note && <span className="ml-2 text-xs font-normal text-slate-600">{note}</span>}
      </dd>
    </div>
  );
}

/** Shown under the operating profile. Plain arithmetic on the user's own numbers, with the working shown. */
export function OperationsPreview({ assessment }: { assessment: Assessment }) {
  const reader = createReader(assessment);
  const d = deriveOperations(assessment, reader);
  const cur = reader.currency;
  return (
    <div className="rounded-xl border border-line bg-navy-50/60 p-4" aria-label="Distance summary">
      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-navy-950">
        Distance summary <AssumptionBadge kind="derived" />
      </p>
      <dl className="mt-1 divide-y divide-line">
        <Row label="Annual distance per vehicle" value={d.annualDistanceKm === null ? EMPTY_VALUE : formatQuantity(d.annualDistanceKm, "km_per_year", cur, 2)} />
        <Row label="Fleet annual distance" value={d.fleetAnnualDistanceKm === null ? EMPTY_VALUE : formatQuantity(d.fleetAnnualDistanceKm, "km_per_year", cur, 2)} />
      </dl>
      <p className="mt-2 text-xs text-slate-600">
        {d.formula ?? "Enter distance and operating days to see the working."} This is a preview of your own numbers. No costs are calculated here.
      </p>
    </div>
  );
}

/** Values the battery-electric assessment reuses from elsewhere, so nothing has to be typed twice. */
export function InheritedBevValues({ assessment }: { assessment: Assessment }) {
  const reader = createReader(assessment);
  const d = deriveOperations(assessment, reader);
  const range = reader.number("bev.usableRange");
  return (
    <div className="rounded-xl border border-line bg-navy-50/60 p-4">
      <p className="text-sm font-semibold text-navy-950">Taken from your other answers</p>
      <dl className="mt-1 divide-y divide-line">
        <Row label="Required daily distance (from Step 1)" value={d.dailyDistanceKm === null ? "Not entered yet" : `${formatNumber(d.dailyDistanceKm, 2)} km/day`} />
        <Row label="Usable range per full charge (from above)" value={range.status === "value" ? `${formatNumber(range.value, 2)} km` : "Not entered yet"} />
      </dl>
      <p className="mt-2 text-xs text-slate-600">GreenFleet will compare these in a later stage. No feasibility rule is applied yet.</p>
    </div>
  );
}
