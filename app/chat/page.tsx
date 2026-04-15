import { ChatPageContent } from "@/components/chat/chat-page-content";

export default function ChatPage() {
  return (
    <div className="flex h-[var(--mobile-content-height)] min-h-0 flex-col overflow-hidden md:h-auto md:flex-1">
      <ChatPageContent />
    </div>
  );
}
