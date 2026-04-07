"use client";

import { Search } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0 overflow-x-hidden">
          <div className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border/80 bg-background/95 px-3 pt-[max(env(safe-area-inset-top),0px)] backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden">
            <SidebarTrigger
              className="size-10 rounded-xl border border-border bg-background/95 shadow-sm"
              title="Navigatie openen of sluiten (⌘/Ctrl+B)"
            />
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => document.dispatchEvent(new CustomEvent("motian-command-palette-open"))}
              className="flex size-10 items-center justify-center rounded-xl border border-border bg-background/95 shadow-sm text-muted-foreground transition-colors hover:text-foreground"
              title="Zoeken (⌘K)"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:pb-0">
            {children}
          </div>
          <MobileBottomNav />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
