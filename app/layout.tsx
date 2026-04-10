import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { DataRefreshListener } from "@/components/data-refresh-listener";
import { RouteShellOverlays } from "@/components/route-shell-overlays";
import { SidebarLayout } from "@/components/sidebar-layout";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Motian - Recruitment Platform",
  description: "AI-Assisted Recruitment Operations Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <head>
        <Script src="/suppress-vendor-noise.js" strategy="beforeInteractive" />
        <Script src="/theme-init.js" strategy="beforeInteractive" />
      </head>
      <body
        className={`${inter.variable} ${playfair.variable} ${jetbrainsMono.variable} min-h-screen bg-background antialiased`}
      >
        <Providers>
          <SidebarLayout>{children}</SidebarLayout>
          <DataRefreshListener />
          <RouteShellOverlays />
        </Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
