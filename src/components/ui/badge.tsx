import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "danger" | "warning" | "success" | "outline";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantClasses = {
    default: "bg-accent/20 text-accent border-accent/30",
    danger: "bg-danger/20 text-red-400 border-danger/30",
    warning: "bg-warning/20 text-amber-400 border-warning/30",
    success: "bg-success/20 text-green-400 border-success/30",
    outline: "bg-transparent text-[#64748B] border-gray-500",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
