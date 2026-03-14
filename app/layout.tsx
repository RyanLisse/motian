import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { ChatContextProvider } from "@/components/chat/chat-context-provider";
import { ChatWidget } from "@/components/chat/chat-widget";
import { SidebarLayout } from "@/components/sidebar-layout";
import { getRequestOrigin, getStableChatOrigin } from "@/src/lib/chat-origin";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "optional",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "optional",
});

export const metadata: Metadata = {
  title: "Motian - Recruitment Platform",
  description: "AI-Assisted Recruitment Operations Platform",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const currentOrigin = getStableChatOrigin(getRequestOrigin(await headers()));

  return (
    <html lang="nl" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${playfair.variable} ${jetbrainsMono.variable} min-h-screen bg-background antialiased`}
      >
        <Providers>
          <ChatContextProvider>
            <SidebarLayout>{children}</SidebarLayout>
            <ChatWidget currentOrigin={currentOrigin} />
          </ChatContextProvider>
        </Providers>
      </body>
    </html>
  );
}
