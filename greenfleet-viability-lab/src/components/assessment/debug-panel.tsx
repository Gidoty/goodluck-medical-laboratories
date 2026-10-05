"use client";

import { Check, Copy } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { normalizeAssessment } from "@/domain/normalize";
import type { Assessment } from "@/domain/stored";
import { Button } from "@/components/ui/button";

const noop = () => () => undefined;
const debugRequested = () => new URLSearchParams(window.location.search).get("debug") === "1";

/** Developer-only view of the exact object the calculation engine will receive. Hidden in normal use. */
export function DebugPanel({ assessment }: { assessment: Assessment }) {
  const enabled = useSyncExternalStore(noop, () => process.env.NODE_ENV === "development" || debugRequested(), () => false);
  const result = useMemo(() => (enabled ? normalizeAssessment(assessment) : null), [assessment, enabled]);
  const [copied, setCopied] = useState(false);
  if (!enabled || !result) return null;
  const json = result.ok ? JSON.stringify(result.input, null, 2) : "";

  return (
    <details className="rounded-xl border border-dashed border-navy-300 bg-surface text-sm">
      <summary className="cursor-pointer px-4 py-3 font-medium text-navy-700">Developer: inspect normalized input</summary>
      <div className="space-y-3 border-t border-line p-4">
        {result.ok ? (
          <>
            <p className="text-xs text-slate-600">This is the exact validated object the calculation engine will receive. Canonical units are documented in docs/NORMALIZED_INPUT.md.</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(json);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  /* clipboard unavailable */
                }
              }}
            >
              {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />} {copied ? "Copied" : "Copy JSON"}
            </Button>
            <pre className="max-h-96 overflow-auto rounded-lg bg-navy-950 p-4 text-xs leading-relaxed text-navy-100" tabIndex={0}>{json}</pre>
          </>
        ) : (
          <p className="text-slate-700">Not available yet: {result.issues.length} validation {result.issues.length === 1 ? "problem blocks" : "problems block"} normalization.</p>
        )}
      </div>
    </details>
  );
}
