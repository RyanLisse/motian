import { ChatContextProvider } from "@/components/chat/chat-context-provider";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <ChatContextProvider>{children}</ChatContextProvider>;
}
