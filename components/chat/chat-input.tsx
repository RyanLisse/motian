"use client";

import { Send } from "lucide-react";

type Props = {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
};

export function ChatInput({ input, setInput, onSubmit, isLoading }: Props) {
  return (
    <form onSubmit={onSubmit} className="border-t border-[#2d2d2d] p-3">
      <div className="flex items-center gap-2 rounded-lg border border-[#2d2d2d] bg-[#1a1a1a] px-3 py-2 focus-within:border-[#444]">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Stel een vraag..."
          className="flex-1 bg-transparent text-sm text-[#eee] placeholder-[#666] outline-none"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded-md p-1.5 text-[#8e8e8e] transition-colors hover:bg-[#222] hover:text-[#eee] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
