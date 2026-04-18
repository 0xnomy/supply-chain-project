"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: "default" | "danger" | "warning" | "success" | "accent";
  className?: string;
  large?: boolean;
}

const variantStyles = {
  default: "border-[#E2E8F0] bg-white shadow-sm",
  danger: "border-[#E2E8F0] bg-white shadow-sm",
  warning: "border-[#E2E8F0] bg-white shadow-sm",
  success: "border-[#E2E8F0] bg-white shadow-sm",
  accent: "border-[#E2E8F0] bg-white shadow-sm",
};

const valueStyles = {
  default: "text-[#0F172A]",
  danger: "text-red-500",
  warning: "text-amber-500",
  success: "text-green-500",
  accent: "text-accent",
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
  className,
  large,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border p-6 transition-all duration-300 hover:scale-[1.02]",
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-[#64748B] mb-1">{title}</p>
          <p
            className={cn(
              "font-bold tracking-tight",
              large ? "text-4xl lg:text-5xl" : "text-2xl lg:text-3xl",
              valueStyles[variant]
            )}
          >
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-[#94A3B8] mt-2 leading-relaxed max-w-xs">
              {subtitle}
            </p>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              "p-2 rounded-lg",
              variant === "danger" && "bg-red-50",
              variant === "warning" && "bg-amber-50",
              variant === "success" && "bg-green-50",
              variant === "accent" && "bg-teal-50",
              variant === "default" && "bg-slate-50"
            )}
          >
            <Icon
              className={cn(
                "w-5 h-5",
                variant === "danger" && "text-red-500",
                variant === "warning" && "text-amber-500",
                variant === "success" && "text-green-500",
                variant === "accent" && "text-accent",
                variant === "default" && "text-[#64748B]"
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface MetricRowProps {
  label: string;
  value: string;
  sublabel?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function MetricRow({ label, value, sublabel, trend, className }: MetricRowProps) {
  return (
    <div className={cn("flex items-center justify-between py-3 border-b border-[#E2E8F0]/50 last:border-0", className)}>
      <div>
        <span className="text-sm text-[#64748B]">{label}</span>
        {sublabel && <p className="text-xs text-[#94A3B8]">{sublabel}</p>}
      </div>
      <span
        className={cn(
          "text-sm font-semibold",
          trend === "up" && "text-red-500",
          trend === "down" && "text-green-500",
          trend === "neutral" && "text-[#64748B]",
          !trend && "text-[#0F172A]"
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-6", className)}>
      <h2 className="text-2xl font-bold text-[#0F172A]">{title}</h2>
      {subtitle && <p className="text-[#64748B] mt-1">{subtitle}</p>}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle: string;
  badge?: string;
}) {
  return (
    <div className="mb-8">
      {badge && (
        <span className="inline-flex items-center rounded-full bg-accent/10 border border-accent/30 px-3 py-1 text-xs font-medium text-accent mb-3">
          {badge}
        </span>
      )}
      <h1 className="text-3xl lg:text-4xl font-bold text-[#0F172A] mb-2">{title}</h1>
      <p className="text-[#64748B] text-lg max-w-3xl">{subtitle}</p>
    </div>
  );
}
