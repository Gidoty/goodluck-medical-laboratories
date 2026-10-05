"use client";

import { ChoiceControl, TextControl } from "./choice-control";
import type { ControlProps } from "./field-shell";
import { NumberControl, QNumberControl } from "./number-control";

/** Renders the right control for a field's kind. All behaviour comes from the schema. */
export function FieldControl(props: ControlProps) {
  const { def } = props;
  switch (def.kind) {
    case "number":
      return <NumberControl {...props} def={def} />;
    case "qnumber":
      return <QNumberControl {...props} def={def} />;
    case "choice":
      return <ChoiceControl {...props} def={def} />;
    case "text":
      return <TextControl {...props} def={def} />;
  }
}
