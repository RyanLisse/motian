import { Building2 } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { isSvgImageUrl, normalizeRemoteImageUrl } from "@/src/lib/image-utils";

const BLUR_PLACEHOLDER =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgdmlld0JveD0iMCAwIDY0IDY0IiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIj48cmVjdCB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIGZpbGw9IiNlZWVlZWUiLz48L3N2Zz4=";

type CompanyLogoProps = {
  src?: string | null;
  companyName?: string | null;
  size?: number;
  sizes?: string;
  priority?: boolean;
  blur?: boolean;
  className?: string;
  imageClassName?: string;
};

export function CompanyLogo({
  src,
  companyName,
  size = 40,
  sizes,
  priority = false,
  blur = false,
  className,
  imageClassName,
}: CompanyLogoProps) {
  const resolvedSrc = normalizeRemoteImageUrl(src);
  const label = companyName?.trim() || "Onbekend bedrijf";
  const containerClassName = cn(
    "shrink-0 overflow-hidden rounded-lg border border-border/70 bg-background/70 shadow-sm",
    className,
  );

  if (!resolvedSrc) {
    return (
      <div
        aria-hidden="true"
        className={cn(containerClassName, "flex items-center justify-center text-muted-foreground")}
        style={{ width: size, height: size }}
      >
        <Building2 className="h-4 w-4" />
      </div>
    );
  }

  return (
    <div className={containerClassName} style={{ width: size, height: size }}>
      <Image
        src={resolvedSrc}
        alt={`${label} logo`}
        width={size}
        height={size}
        sizes={sizes ?? `${size}px`}
        priority={priority}
        unoptimized={isSvgImageUrl(resolvedSrc)}
        placeholder={blur ? "blur" : "empty"}
        blurDataURL={blur ? BLUR_PLACEHOLDER : undefined}
        className={cn("size-full object-contain p-1.5", imageClassName)}
      />
    </div>
  );
}
