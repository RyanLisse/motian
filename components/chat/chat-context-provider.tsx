"use client";

import { useParams, usePathname } from "next/navigation";
import { createContext, type ReactNode, useContext, useMemo } from "react";

type ChatContext = {
  route: string;
  entityType: "opdracht" | "kandidaat" | null;
  entityId: string | null;
};

const ChatCtx = createContext<ChatContext>({
  route: "/",
  entityType: null,
  entityId: null,
});

export function useChatContext() {
  return useContext(ChatCtx);
}

export function ChatContextProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();

  const value = useMemo<ChatContext>(() => {
    const id = params?.id ?? null;

    if (pathname.startsWith("/opdrachten/") && id) {
      return { route: pathname, entityType: "opdracht", entityId: id };
    }
    if (pathname.startsWith("/kandidaten/") && id) {
      return { route: pathname, entityType: "kandidaat", entityId: id };
    }

    return { route: pathname, entityType: null, entityId: null };
  }, [pathname, params?.id]);

  return <ChatCtx.Provider value={value}>{children}</ChatCtx.Provider>;
}
