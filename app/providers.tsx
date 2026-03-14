"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { PostHogProvider } from "@/src/components/posthog-provider";
import { SafeStoragePatch } from "@/src/components/safe-storage-patch";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <SafeStoragePatch>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <QueryClientProvider client={queryClient}>
          <PostHogProvider>{children}</PostHogProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeStoragePatch>
  );
}
