"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <div className="pointer-events-none fixed left-3 top-3 z-40 md:hidden">
          <SidebarTrigger
            className="pointer-events-auto size-8 rounded-md border border-border bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80"
            title="Navigatie openen of sluiten (⌘/Ctrl+B)"
          />
        </div>
        <SidebarInset className="overflow-x-hidden">{children}</SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
