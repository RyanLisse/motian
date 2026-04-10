"use client";

interface OpenToOffersRingProps {
  /** 0–100, e.g. 87 for 87%, or null when availability is unknown */
  percentage: number | null;
  label?: string;
  statusLabel?: string;
  detail?: string;
  className?: string;
}

/** Circular progress ring for "Open to offers" (orange accent). */
export function OpenToOffersRing({
  percentage,
  label = "Open to offers",
  statusLabel,
  detail,
  className = "",
}: OpenToOffersRingProps) {
  const clamped = percentage == null ? null : Math.min(100, Math.max(0, percentage));
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    clamped == null ? circumference : circumference - (clamped / 100) * circumference;
  const progressStroke = clamped == null ? "hsl(var(--border))" : "hsl(24 95% 53%)";
  const valueText = clamped == null ? "—" : `${Math.round(clamped)}%`;

  return (
    <div className={`rounded-3xl border border-border/80 bg-card/95 p-4 shadow-sm ${className}`}>
      <div className="flex items-center gap-3">
        <div className="relative size-16 shrink-0">
          <svg className="size-16 -rotate-90" viewBox="0 0 60 60" aria-hidden>
            <title>
              {statusLabel ? `${label} — ${statusLabel}` : `${label} ${clamped ?? "onbekend"}`}
            </title>
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
              stroke={progressStroke}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-[stroke-dashoffset] duration-500"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-foreground">
            {valueText}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-base font-semibold text-foreground">
            {statusLabel ?? "Beschikbaarheid onbekend"}
          </p>
          {detail ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
