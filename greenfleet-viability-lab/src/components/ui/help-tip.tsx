"use client";

import { Info } from "lucide-react";
import { useId, useState } from "react";
import { GLOSSARY } from "@/content/glossary";

/**
 * Short plain-English explanation of a term. Opens on click or keyboard focus, and on mouse hover.
 * The bubble is positioned against the nearest `relative` ancestor (the field's label row), so it
 * can never push the page wider than the screen.
 */
export function HelpTip({ term }: { term: string }) {
  const entry = GLOSSARY[term];
  const id = useId();
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  if (!entry) return null;
  const open = pinned || hover;
  return (
    <>
      <button
        type="button"
        aria-label={`What is ${entry.term}?`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setPinned((p) => !p)}
        onBlur={() => setPinned(false)}
        onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
        onPointerLeave={() => setHover(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setPinned(false);
            setHover(false);
          }
        }}
        className="-my-1 grid size-8 shrink-0 place-items-center rounded-full text-navy-500 hover:bg-navy-100 hover:text-navy-800"
      >
        <Info aria-hidden className="size-4" />
      </button>
      {open && (
        <div role="tooltip" id={id} className="absolute left-0 top-full z-30 mt-1 w-[min(20rem,calc(100vw-3rem))] rounded-lg border border-navy-200 bg-surface p-3 text-xs leading-relaxed text-navy-800 shadow-raised">
          <p className="font-semibold text-navy-950">{entry.term}</p>
          <p className="mt-1">{entry.text}</p>
        </div>
      )}
    </>
  );
}
