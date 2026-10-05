import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg" | "sm";

export function buttonStyles({ variant = "primary", size = "md" }: { variant?: Variant; size?: Size } = {}): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-50",
    size === "sm" && "px-3 py-1.5 text-sm",
    size === "md" && "px-4 py-2.5 text-sm",
    size === "lg" && "px-6 py-3 text-base",
    variant === "primary" && "bg-forest-700 text-white hover:bg-forest-800 disabled:hover:bg-forest-700",
    variant === "secondary" && "border border-navy-200 bg-surface text-navy-800 hover:bg-navy-50",
    variant === "ghost" && "text-navy-700 hover:bg-navy-100",
    variant === "danger" && "border border-red-300 bg-surface text-red-800 hover:bg-red-50",
  );
}

interface StyleProps { variant?: Variant; size?: Size }

export function Button({ variant, size, className, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & StyleProps) {
  return <button type={type} className={cn(buttonStyles({ variant, size }), className)} {...props} />;
}

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & StyleProps) {
  return <Link className={cn(buttonStyles({ variant, size }), className)} {...props} />;
}
