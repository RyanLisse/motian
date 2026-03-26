"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function OpdrachtenLayoutShell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isDetailPage = pathname.startsWith("/vacatures/") || pathname.startsWith("/opdrachten/");

  return (
    <div className="flex h-full min-h-0">
      <div
        className={cn(
          "border-border bg-sidebar flex min-h-0 flex-col",
          isDetailPage
            ? "hidden md:flex md:w-[380px] md:shrink-0 md:border-r"
            : "w-full",
        )}
      >
        {sidebar}
      </div>
      <div
        className={cn(
          "min-w-0",
          isDetailPage
            ? "flex min-w-0 flex-1 flex-col overflow-hidden"
            : "hidden",
        )}
      >
        {children}
      </div>
    </div>
  );
}
