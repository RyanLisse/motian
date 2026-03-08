import { headers } from "next/headers";
import { ChatPageContent } from "@/components/chat/chat-page-content";
import { getRequestOrigin, getStableChatOrigin } from "@/src/lib/chat-origin";

export default async function ChatPage() {
  const currentOrigin = getStableChatOrigin(getRequestOrigin(await headers()));

  return (
    <div className="flex h-[calc(100dvh-3rem)] min-h-0 flex-col overflow-hidden">
      <ChatPageContent currentOrigin={currentOrigin} />
    </div>
  );
}
