import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PLATFORM_LABELS: Record<string, string> = {
  flextender: "Flextender",
  opdrachtoverheid: "Opdrachtoverheid",
  striive: "Striive",
};

const PLATFORM_STYLES: Record<string, string> = {
  flextender: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  opdrachtoverheid: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  striive: "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

export function formatPlatformLabel(platform: string) {
  const knownLabel = PLATFORM_LABELS[platform];

  if (knownLabel) return knownLabel;
  if (!platform) return "Onbekend";

  return `${platform.slice(0, 1).toUpperCase()}${platform.slice(1)}`;
}

export function PlatformBadge({ platform, className }: { platform: string; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-border/70 bg-transparent text-muted-foreground",
        PLATFORM_STYLES[platform],
        className,
      )}
    >
      {formatPlatformLabel(platform)}
    </Badge>
  );
}
