import { ChatPageContent } from "@/components/chat/chat-page-content";
import { getStableChatOrigin } from "@/src/lib/chat-origin";

export default function ChatPage() {
  const currentOrigin = getStableChatOrigin();

  return (
    <div className="flex h-[calc(100dvh-3rem)] min-h-0 flex-col overflow-hidden">
      <ChatPageContent currentOrigin={currentOrigin} />
    </div>
  );
}
