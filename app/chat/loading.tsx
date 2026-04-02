import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="flex h-[calc(100dvh-3rem)] min-h-0 flex-col overflow-hidden md:h-dvh">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-border px-4 py-3">
          <Skeleton className="h-9 w-48 bg-muted" />
        </div>
        <div className="flex-1 space-y-4 overflow-hidden px-4 py-6">
          {Array.from({ length: 4 }).map((_, i) => {
            const isUser = i % 2 !== 0;
            return (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                key={`msg-${i}`}
                className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && <Skeleton className="h-8 w-8 shrink-0 rounded-full bg-muted" />}
                <Skeleton className={`h-20 rounded-xl bg-card ${isUser ? "w-64" : "w-80"}`} />
              </div>
            );
          })}
        </div>
        <div className="border-t border-border px-4 py-3">
          <Skeleton className="h-9 w-full rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  );
}
