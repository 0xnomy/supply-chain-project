"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  className?: string;
  label?: string;
  showValue?: boolean;
  formatValue?: (value: number) => string;
}

export function Slider({
  min,
  max,
  step = 1,
  value,
  onChange,
  className,
  label,
  showValue = true,
  formatValue,
}: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={cn("space-y-2", className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && <span className="text-sm text-[#64748B]">{label}</span>}
          {showValue && (
            <span className="text-sm font-medium text-accent">
              {formatValue ? formatValue(value) : value}
            </span>
          )}
        </div>
      )}
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gray-700"
          style={{
            background: `linear-gradient(to right, #14B8A6 0%, #14B8A6 ${percentage}%, #374151 ${percentage}%, #374151 100%)`,
          }}
        />
      </div>
    </div>
  );
}
