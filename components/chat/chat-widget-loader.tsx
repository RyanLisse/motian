"use client";

import { MessageSquare } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChatContextProvider } from "@/components/chat/chat-context-provider";

const CHAT_WIDGET_OPEN_EVENT = "motian-chat-open";

const ChatWidget = dynamic(
  () => import("@/components/chat/chat-widget").then((mod) => ({ default: mod.ChatWidget })),
  { ssr: false },
);

export function ChatWidgetLoader({ currentOrigin = null }: { currentOrigin?: string | null }) {
  const pathname = usePathname();
  const [shouldLoad, setShouldLoad] = useState(false);
  const [openOnLoad, setOpenOnLoad] = useState(false);

  const requestOpen = useCallback(() => {
    setShouldLoad(true);
    setOpenOnLoad(true);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        requestOpen();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(CHAT_WIDGET_OPEN_EVENT, requestOpen);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(CHAT_WIDGET_OPEN_EVENT, requestOpen);
    };
  }, [requestOpen]);

  if (pathname === "/chat") {
    return null;
  }

  if (!shouldLoad) {
    return (
      <button
        type="button"
        onClick={requestOpen}
        aria-label="Chatwidget openen"
        aria-haspopup="dialog"
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 sm:right-6 sm:bottom-6"
        title="Chatwidget openen (⌘J)"
      >
        <MessageSquare className="h-5 w-5" />
      </button>
    );
  }

  return (
    <ChatContextProvider>
      <ChatWidget currentOrigin={currentOrigin} defaultOpen={openOnLoad} />
    </ChatContextProvider>
  );
}
