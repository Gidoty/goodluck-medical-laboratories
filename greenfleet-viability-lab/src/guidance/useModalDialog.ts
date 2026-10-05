"use client";

import { useEffect, useRef } from "react";

/**
 * Drives a native <dialog> from React state. showModal() traps focus, makes the rest of the page
 * inert, closes on Escape and returns focus to the control that opened it.
 */
export function useModalDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const justClosed = wasOpen.current && !open;
    wasOpen.current = open;
    if (open && !el.open) {
      // Remember what opened the dialog. A control inside another dialog (the tour is restarted from Help, which then closes) is not a
      // place focus can return to, so it is not remembered.
      const active = document.activeElement;
      opener.current = active instanceof HTMLElement && active !== document.body && !active.closest("dialog") ? active : null;
      el.showModal();
    }
    if (!open && el.open) el.close();
    if (!justClosed) return; // never move focus on first render or while nothing has been closed
    // After it closes, focus must land on a control, never on the page body. The browser restores focus to the opener when it can;
    // otherwise the Help button is the stable place to resume from.
    const t = window.setTimeout(() => {
      const active = document.activeElement;
      if (active && active !== document.body && !active.closest("dialog:not([open])")) return;
      const target = opener.current?.isConnected ? opener.current : document.querySelector<HTMLElement>("[data-help-trigger]");
      target?.focus();
    }, 0);
    return () => window.clearTimeout(t);
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
