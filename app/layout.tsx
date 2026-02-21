import type { Metadata } from "next";
import "./globals.css";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AiChat } from "@/components/ai-chat";

export const metadata: Metadata = {
  title: "Motian - Recruitment Platform",
  description: "AI-Assisted Recruitment Operations Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl" className="dark">
      <body className="min-h-screen bg-background antialiased">
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[#2d2d2d] bg-[#0d0d0d] px-4">
                <SidebarTrigger className="-ml-1 text-[#8e8e8e] hover:text-[#ececec]" />
                <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4 bg-[#2d2d2d]" />
                <span className="text-sm font-semibold text-[#ececec]">Motian</span>
              </header>
              <main className="flex-1 overflow-y-auto">
                {children}
              </main>
            </SidebarInset>
            <AiChat />
          </SidebarProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
