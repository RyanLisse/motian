import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; className: string }> = {
  success: {
    label: "Geslaagd",
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  },
  partial: {
    label: "Gedeeltelijk",
    className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:text-yellow-400",
  },
  failed: {
    label: "Mislukt",
    className: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",
  },
  gezond: {
    label: "Gezond",
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  },
  waarschuwing: {
    label: "Waarschuwing",
    className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:text-yellow-400",
  },
  kritiek: {
    label: "Kritiek",
    className: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",
  },
  inactief: {
    label: "Inactief",
    className: "bg-muted text-muted-foreground border-border",
  },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground border-border",
  };

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
