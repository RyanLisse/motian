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
  const isDetailPage = pathname !== "/opdrachten";

  return (
    <div className="flex h-full min-h-0">
      <div
        className={cn("border-border bg-sidebar flex flex-col", isDetailPage ? "hidden" : "w-full")}
      >
        {sidebar}
      </div>
      <div className={cn("flex-1 flex-col overflow-hidden", isDetailPage ? "flex" : "hidden")}>
        {children}
      </div>
    </div>
  );
}
