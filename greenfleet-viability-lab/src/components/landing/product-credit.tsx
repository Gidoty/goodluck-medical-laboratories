import { LogoMark } from "@/components/layout/logo";

/** Product credit. Used on the landing page only; it must not appear anywhere inside the application. */
export const PRODUCT_CREDIT = "GreenFleet — Built by Group 8, MSc Class of 2025, CELTRAS";

export function ProductCredit() {
  return (
    <p className="flex items-center gap-2 border-t border-line pt-4 text-sm font-medium text-navy-700 lg:shrink-0 lg:whitespace-nowrap lg:border-t-0 lg:pt-0">
      <LogoMark className="size-5" />
      <span>{PRODUCT_CREDIT}</span>
    </p>
  );
}
