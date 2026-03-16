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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const currentOrigin = getStableChatOrigin(getRequestOrigin(await headers()));

  return (
    <html lang="nl" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Suppress known third-party deprecation warnings (zustand default export)
                const isZustandDeprecation = (args) => {
                  const msg = args[0]?.toString?.() ?? "";
                  return msg.includes("[DEPRECATED]") && msg.includes("zustand");
                };
                const origWarn = console.warn;
                const origError = console.error;
                console.warn = (...args) => { if (!isZustandDeprecation(args)) origWarn.apply(console, args); };
                console.error = (...args) => { if (!isZustandDeprecation(args)) origError.apply(console, args); };

                // Patch storage if blocked
                const noop = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: 0 };
                try { localStorage.getItem("test"); } catch(e) { try { Object.defineProperty(window, "localStorage", { value: noop }); } catch(err) {} }
                try { sessionStorage.getItem("test"); } catch(e) { try { Object.defineProperty(window, "sessionStorage", { value: noop }); } catch(err) {} }
              })();
            `,
          }}
        />
      </head>
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
