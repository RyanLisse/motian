"use client"

import { TooltipProvider } from "@/components/ui/tooltip"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[#2d2d2d] px-4">
            <SidebarTrigger className="-ml-1 text-[#8e8e8e] hover:text-[#ececec]" />
            <Separator orientation="vertical" className="mr-2 h-4 bg-[#2d2d2d]" />
            <span className="text-sm font-medium text-[#8e8e8e]">Motian</span>
          </header>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
