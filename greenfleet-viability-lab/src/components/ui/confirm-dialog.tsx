"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { createConfirmGate } from "@/state/confirmGate";
import { Button } from "./button";

export interface ConfirmedAction {
  pending: boolean;
  request(): void;
  confirm(): void;
  cancel(): void;
}

/** Runs `action` only after `confirm()`; `request()` merely opens the question. See state/confirmGate.ts. */
export function useConfirmedAction(action: () => void): ConfirmedAction {
  const [gate] = useState(() => createConfirmGate(action));
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  return {
    pending: gate.pending,
    request: () => {
      gate.request();
      rerender();
    },
    confirm: () => {
      gate.confirm();
      rerender();
    },
    cancel: () => {
      gate.cancel();
      rerender();
    },
  };
}

export function ConfirmDialog({
  flow,
  title,
  confirmLabel,
  children,
}: {
  flow: ConfirmedAction;
  title: string;
  confirmLabel: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (flow.pending && !el.open) el.showModal();
    if (!flow.pending && el.open) el.close();
  }, [flow.pending]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        flow.cancel();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-card border border-line bg-surface p-0 text-navy-900 shadow-raised backdrop:bg-navy-950/60"
    >
      <div className="p-6">
        <h2 id="confirm-title" className="text-lg font-semibold text-navy-950">
          {title}
        </h2>
        <div className="mt-2 text-sm text-slate-700">{children}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" autoFocus onClick={flow.cancel}>
            Keep my work
          </Button>
          <Button variant="danger" onClick={flow.confirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
