"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0 overflow-x-hidden">
          <div className="sticky top-0 z-30 flex h-10 items-center border-b border-border/80 bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
            <SidebarTrigger
              className="size-9 rounded-lg border border-border bg-background/95 shadow-sm"
              title="Navigatie openen of sluiten (⌘/Ctrl+B)"
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
