"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { ChatContextProvider } from "@/components/chat/chat-context-provider";
import { WebVitalsReporter } from "@/components/web-vitals-reporter";

const ChatWidget = dynamic(
  () => import("@/components/chat/chat-widget").then((mod) => mod.ChatWidget),
  {
    ssr: false,
  },
);
const CommandPalette = dynamic(
  () => import("@/components/command-palette").then((mod) => mod.CommandPalette),
  { ssr: false },
);
const MotianWebMcpProvider = dynamic(
  () =>
    import("@/components/webmcp/motian-webmcp-provider").then((mod) => mod.MotianWebMcpProvider),
  { ssr: false },
);

export function RouteShellOverlays() {
  const pathname = usePathname();
  const isDeveloperRoute = pathname.startsWith("/ontwikkelaar");
  const isChatRoute = pathname.startsWith("/chat");
  const currentOrigin = typeof window !== "undefined" ? window.location.origin : null;

  return (
    <>
      <WebVitalsReporter />
      <CommandPalette />
      {isDeveloperRoute ? <MotianWebMcpProvider /> : null}
      {!isChatRoute ? (
        <ChatContextProvider>
          <ChatWidget currentOrigin={currentOrigin} />
        </ChatContextProvider>
      ) : null}
    </>
  );
}
