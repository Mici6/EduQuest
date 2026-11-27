import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils/format";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "iris" | "danger" | "outline" | "dark";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-sun-200 text-ink-950 hover:bg-sun-100 shadow-[0_8px_24px_-10px_rgb(255_211_77/0.6)]",
  secondary: "bg-ink-700 text-fg border border-line hover:bg-ink-750 hover:border-line-strong",
  ghost: "text-fg-2 hover:text-fg hover:bg-white/[0.06]",
  iris: "bg-iris-400 text-ink-950 hover:bg-iris-300 shadow-[0_8px_24px_-10px_rgb(155_140_255/0.6)]",
  danger: "bg-rose/15 text-rose border border-rose/25 hover:bg-rose/25",
  outline: "border border-line-strong text-fg hover:bg-white/[0.05]",
  dark: "bg-ink-950 text-fg hover:bg-ink-900",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 [&_svg]:size-3.5",
  md: "h-10 px-4 text-sm gap-2 [&_svg]:size-4",
  lg: "h-12 px-6 text-[15px] gap-2 [&_svg]:size-[18px]",
  icon: "size-10 [&_svg]:size-[18px]",
  "icon-sm": "size-8 [&_svg]:size-4",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-full font-semibold whitespace-nowrap transition-[background-color,color,border-color,box-shadow,scale] duration-[160ms] ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 select-none",
    VARIANT[variant],
    SIZE[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean }) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={loading || rest.disabled} aria-busy={loading || undefined} {...rest}>
      {loading ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize; children: ReactNode }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
