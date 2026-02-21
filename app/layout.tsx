import type { Metadata } from "next";
import "./globals.css";
import { TopNav } from "@/components/top-nav";
import { TooltipProvider } from "@/components/ui/tooltip";

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
      <body className="min-h-screen bg-background antialiased flex flex-col">
        <TooltipProvider>
          <TopNav />
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
