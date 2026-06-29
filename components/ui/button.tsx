import * as React from "react";
import { cn } from "@/lib/utils/cn";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-gradient-to-r from-studio-purple via-studio-pink to-studio-cyan text-white shadow-glow hover:scale-[1.01] active:scale-[.99]",
        variant === "secondary" && "border border-white/10 bg-white/8 text-white hover:bg-white/12",
        variant === "ghost" && "text-studio-muted hover:bg-white/8 hover:text-white",
        variant === "danger" && "bg-red-500/15 text-red-200 hover:bg-red-500/25",
        className
      )}
      {...props}
    />
  );
}
