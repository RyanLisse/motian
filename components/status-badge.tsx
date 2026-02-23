import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; className: string }> = {
  success: {
    label: "Geslaagd",
    className: "bg-[#10a37f]/10 text-[#10a37f] border-[#10a37f]/20",
  },
  partial: {
    label: "Gedeeltelijk",
    className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  },
  failed: {
    label: "Mislukt",
    className: "bg-red-500/10 text-red-500 border-red-500/20",
  },
  gezond: {
    label: "Gezond",
    className: "bg-[#10a37f]/10 text-[#10a37f] border-[#10a37f]/20",
  },
  waarschuwing: {
    label: "Waarschuwing",
    className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  },
  kritiek: {
    label: "Kritiek",
    className: "bg-red-500/10 text-red-500 border-red-500/20",
  },
  inactief: {
    label: "Inactief",
    className: "bg-[#6b6b6b]/10 text-[#6b6b6b] border-[#6b6b6b]/20",
  },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status,
    className: "bg-[#6b6b6b]/10 text-[#6b6b6b] border-[#6b6b6b]/20",
  };

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
