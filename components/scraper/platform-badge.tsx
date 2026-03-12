import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getPlatformMetadata } from "@/src/lib/platform-catalog";

export function formatPlatformLabel(platform: string) {
  const knownLabel = getPlatformMetadata(platform)?.displayName;

  if (knownLabel) return knownLabel;
  if (!platform) return "Onbekend";

  return `${platform.slice(0, 1).toUpperCase()}${platform.slice(1)}`;
}

export function PlatformBadge({ platform, className }: { platform: string; className?: string }) {
  const metadata = getPlatformMetadata(platform);

  return (
    <Badge
      variant="outline"
      className={cn(
        "border-border/70 bg-transparent text-muted-foreground",
        metadata?.badgeClassName,
        className,
      )}
    >
      {formatPlatformLabel(platform)}
    </Badge>
  );
}
