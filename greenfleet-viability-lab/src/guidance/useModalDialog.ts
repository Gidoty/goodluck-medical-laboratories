"use client";

import { useEffect, useRef } from "react";

/**
 * Drives a native <dialog> from React state. showModal() traps focus, makes the rest of the page
 * inert, closes on Escape and returns focus to the control that opened it.
 */
export function useModalDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  const props = {
    ref,
    onClose: () => {
      if (open) onClose();
    },
    onClick: (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === ref.current) onClose();
    },
  };
  return props;
}
