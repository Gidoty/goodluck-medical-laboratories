"use client";

import { useState } from "react";
import { parseNumericInput, type NumericField } from "@/domain/fieldValue";

/**
 * Lets people type naturally ("1.", "-", "12.5") without the stored number jumping around.
 * Valid text is committed immediately; text that is not a number is held back and flagged.
 */
export function useNumericDraft(stored: NumericField, commit: (f: NumericField) => void) {
  const [draft, setDraft] = useState<string | null>(null);
  const [notANumber, setNotANumber] = useState(false);
  const shown = draft ?? (stored.status === "value" ? String(stored.value) : "");
  return {
    shown,
    notANumber,
    onChange(text: string) {
      setDraft(text);
      const parsed = parseNumericInput(text);
      if (parsed.status === "invalid") {
        setNotANumber(true);
        return;
      }
      setNotANumber(false);
      commit(parsed);
    },
    onBlur() {
      setDraft(null);
      setNotANumber(false);
    },
  };
}
