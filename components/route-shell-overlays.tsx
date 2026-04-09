"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { ChatWidgetLoader } from "@/components/chat/chat-widget-loader";
import { CommandPaletteLoader } from "@/components/command-palette-loader";
import { WebVitalsReporter } from "@/src/components/web-vitals-reporter";

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
      <CommandPaletteLoader />
      {isDeveloperRoute ? <MotianWebMcpProvider /> : null}
      {!isChatRoute ? <ChatWidgetLoader currentOrigin={currentOrigin} /> : null}
    </>
  );
}
