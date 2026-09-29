"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AccentColor = "cyan" | "orange" | "green" | "purple";
export type TrendDir = "up" | "down" | "neutral";

export interface StatCardProps {
  label: string;
  value: string | number;
  trend?: TrendDir;
  trendValue?: string;
  icon?: ReactNode;
  accentColor?: AccentColor;
  animationDelay?: number;
  className?: string;
}

const ACCENT_MAP: Record<AccentColor, { color: string; glow: string }> = {
  cyan:   { color: "var(--accent-cyan)",   glow: "var(--glow-cyan)"    },
  orange: { color: "var(--accent-orange)", glow: "var(--glow-orange)"  },
  green:  { color: "var(--positive)",      glow: "var(--glow-positive)"},
  purple: { color: "var(--accent-ai)",     glow: "var(--glow-ai)"      },
};

function TrendArrow({ dir }: { dir: TrendDir }) {
  if (dir === "up") {
    return (
      <svg
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: 12, height: 12 }}
        aria-hidden
      >
        <path d="M6 9.5V2.5" /><path d="M3 5.5 6 2.5l3 3" />
      </svg>
    );
  }
  if (dir === "down") {
    return (
      <svg
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: 12, height: 12 }}
        aria-hidden
      >
        <path d="M6 2.5v7" /><path d="M3 6.5 6 9.5l3-3" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 12, height: 12 }}
      aria-hidden
    >
      <path d="M2.5 6h7" />
    </svg>
  );
}

function TrendPill({ dir, value }: { dir: TrendDir; value?: string }) {
  const tone =
    dir === "up"
      ? "text-positive bg-[color-mix(in_oklab,var(--positive)_12%,transparent)] border-[color-mix(in_oklab,var(--positive)_28%,transparent)]"
      : dir === "down"
        ? "text-negative bg-[color-mix(in_oklab,var(--negative)_12%,transparent)] border-[color-mix(in_oklab,var(--negative)_28%,transparent)]"
        : "text-secondary bg-surface-2 border-border-active";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-1",
        "font-mono font-medium tabular-nums text-[0.78rem]",
        "animate-trend-in",
        tone,
      )}
    >
      <TrendArrow dir={dir} />
      {value}
    </span>
  );
}

export function StatCard({
  label,
  value,
  trend,
  trendValue,
  icon,
  accentColor = "cyan",
  animationDelay = 0,
  className,
}: StatCardProps) {
  const accent = ACCENT_MAP[accentColor];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[10px]",
        "bg-surface-1 border border-border-subtle text-primary",
        "min-h-35 pl-6 pr-5 py-4.5",
        "flex flex-col justify-between gap-5",
        "animate-fade-slide-up",
        "transition-[transform,border-color,box-shadow,background] duration-200 ease-(--ease-snap)",
        "hover:-translate-y-0.5 hover:border-border-active",
        "hover:bg-linear-to-b hover:from-surface-1 hover:to-surface-2",
        "hover:shadow-[0_8px_24px_var(--accent-glow,var(--glow-cyan))]",
        "before:absolute before:inset-y-0 before:left-0 before:w-0.75",
        "before:bg-(--accent-color) before:shadow-[0_0_12px_var(--accent-glow)]",
        className,
      )}
      style={{
        "--accent-color": accent.color,
        "--accent-glow": accent.glow,
        animationDelay: `${animationDelay}ms`,
      } as React.CSSProperties}
    >
      {/* Fejléc — label + ikon */}
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "font-display font-semibold uppercase",
            "text-[0.7rem] tracking-[0.14em] leading-tight",
            "text-secondary",
          )}
        >
          {label}
        </span>
        {icon && (
          <span
            className={cn(
              "inline-flex items-center justify-center w-6 h-6 shrink-0",
              "text-muted transition-colors duration-200",
              "group-hover:text-(--accent-color)",
            )}
          >
            {icon}
          </span>
        )}
      </div>

      {/* Érték + trend */}
      <div className="flex items-end justify-between gap-3">
        <span
          className={cn(
            "font-mono font-medium tabular-nums",
            "text-[2.5rem] leading-none tracking-[-0.03em]",
            "text-primary animate-count-up",
          )}
          data-stat
        >
          {value}
        </span>
        {trend && <TrendPill dir={trend} value={trendValue} />}
      </div>
    </div>
  );
}
