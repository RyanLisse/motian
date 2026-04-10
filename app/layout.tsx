import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { RouteShellOverlays } from "@/components/route-shell-overlays";
import { SidebarLayout } from "@/components/sidebar-layout";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
  fallback: ["system-ui", "arial", "sans-serif"],
  preload: true,
});

const playfair = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  variable: "--font-serif",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-mono",
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Consolas", "monospace"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Motian - Recruitment Platform",
  description: "AI-Assisted Recruitment Operations Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="nl"
      suppressHydrationWarning
      className={`${inter.variable} ${playfair.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <Script src="/suppress-vendor-noise.js" strategy="beforeInteractive" />
        <Script src="/theme-init.js" strategy="beforeInteractive" />
      </head>
      <body className="min-h-screen bg-background antialiased">
        <Providers>
          <SidebarLayout>{children}</SidebarLayout>
          <RouteShellOverlays />
        </Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
