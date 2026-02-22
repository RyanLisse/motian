import type { Metadata } from "next";
import "./globals.css";
import { SidebarLayout } from "@/components/sidebar-layout";
import { Providers } from "./providers";

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
        <Providers>
          <SidebarLayout>{children}</SidebarLayout>
        </Providers>
      </body>
    </html>
  );
}
