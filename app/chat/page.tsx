import { ChatPageContent } from "@/components/chat/chat-page-content";

export default function ChatPage() {
  return (
    <div className="flex h-[calc(100dvh-3rem)] min-h-0 flex-col overflow-hidden">
      <ChatPageContent />
    </div>
  );
}
