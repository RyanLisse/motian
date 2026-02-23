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
    <div className="flex h-[calc(100vh-57px)]">
      {/* Sidebar: full-width on mobile when no detail selected, fixed sidebar on desktop */}
      <div
        className={cn(
          "border-border bg-sidebar flex flex-col",
          "lg:w-[300px] lg:shrink-0 lg:border-r lg:flex",
          isDetailPage ? "hidden lg:flex" : "w-full"
        )}
      >
        {sidebar}
      </div>
      {/* Main content: hidden on mobile when on index page (sidebar is shown instead) */}
      <div
        className={cn(
          "flex-1 flex flex-col overflow-hidden",
          !isDetailPage && "hidden lg:flex"
        )}
      >
        {children}
      </div>
    </div>
  );
}
