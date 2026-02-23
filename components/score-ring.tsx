"use client";

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

function getScoreColor(score: number): string {
  if (score >= 90) return "text-green-500";
  if (score >= 80) return "text-blue-500";
  if (score >= 70) return "text-amber-500";
  return "text-red-500";
}

function getStrokeColor(score: number): string {
  if (score >= 90) return "stroke-green-500";
  if (score >= 80) return "stroke-blue-500";
  if (score >= 70) return "stroke-amber-500";
  return "stroke-red-500";
}

export function ScoreRing({ score, size = 56, strokeWidth = 4, className = "" }: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true" role="presentation">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${getStrokeColor(score)} transition-[stroke-dashoffset] duration-700 ease-out`}
        />
      </svg>
      <span className={`absolute text-xs font-bold ${getScoreColor(score)}`}>
        {Math.round(score)}
      </span>
    </div>
  );
}

export function getGradeLabel(score: number): {
  label: string;
  color: string;
} {
  if (score >= 90)
    return { label: "Uitstekend", color: "bg-green-500/10 text-green-600 border-green-500/20" };
  if (score >= 80)
    return { label: "Sterk", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" };
  if (score >= 70)
    return { label: "Goed", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" };
  return { label: "Onder", color: "bg-red-500/10 text-red-600 border-red-500/20" };
}
