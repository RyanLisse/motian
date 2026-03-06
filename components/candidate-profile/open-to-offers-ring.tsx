"use client";

interface OpenToOffersRingProps {
  /** 0–100, e.g. 87 for 87% */
  percentage: number;
  label?: string;
  className?: string;
}

/** Circular progress ring for "Open to offers" (orange accent). */
export function OpenToOffersRing({
  percentage,
  label = "Open to offers",
  className = "",
}: OpenToOffersRingProps) {
  const clamped = Math.min(100, Math.max(0, percentage));
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative size-14 shrink-0">
        <svg className="size-14 -rotate-90" viewBox="0 0 60 60" aria-hidden>
          <title>Open voor aanbiedingen {clamped}%</title>
          <circle
            cx="30"
            cy="30"
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="5"
          />
          <circle
            cx="30"
            cy="30"
            r={radius}
            fill="none"
            stroke="hsl(24 95% 53%)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-[stroke-dashoffset] duration-500"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-foreground">
          {Math.round(clamped)}%
        </span>
      </div>
      <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">{label}</span>
    </div>
  );
}
