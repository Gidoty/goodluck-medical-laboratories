"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";

/** Slide-in navigation built on <dialog>, which provides focus trapping and Escape handling. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="grid size-10 place-items-center rounded-lg border border-line bg-surface text-navy-800 hover:bg-navy-50 lg:hidden"
      >
        <Menu aria-hidden className="size-5" />
        <span className="sr-only">Open navigation menu</span>
      </button>
      <dialog
        ref={dialog}
        aria-label="Navigation menu"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dialog.current) setOpen(false);
        }}
        className="m-0 h-full max-h-none w-72 max-w-[85vw] bg-navy-950 p-4 text-white backdrop:bg-navy-950/60"
      >
        <div className="mb-6 flex items-center justify-between">
          <Logo href="/overview" light />
          <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-lg text-navy-100 hover:bg-navy-800">
            <X aria-hidden className="size-5" />
            <span className="sr-only">Close navigation menu</span>
          </button>
        </div>
        <NavLinks onNavigate={() => setOpen(false)} />
      </dialog>
    </>
  );
}
