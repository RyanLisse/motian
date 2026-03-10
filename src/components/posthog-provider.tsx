"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

type WindowStorageLike = {
  localStorage?: Pick<Storage, "setItem" | "removeItem"> | null;
  sessionStorage?: Pick<Storage, "setItem" | "removeItem"> | null;
};

function canUseStorage(storage?: Pick<Storage, "setItem" | "removeItem"> | null): boolean {
  if (!storage) return false;

  try {
    storage.setItem("__motian_posthog_storage__", "1");
    storage.removeItem("__motian_posthog_storage__");
    return true;
  } catch {
    return false;
  }
}

export function getPostHogPersistence(
  windowLike?: WindowStorageLike | null,
): "localStorage+cookie" | "memory" {
  return canUseStorage(windowLike?.localStorage) ? "localStorage+cookie" : "memory";
}

export function getPostHogInitOptions(windowLike?: WindowStorageLike | null) {
  return {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
    person_profiles: "identified_only" as const,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    capture_exceptions: true,
    persistence: getPostHogPersistence(windowLike),
  };
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) {
      return;
    }

    try {
      posthog.init(key, getPostHogInitOptions(window));
    } catch (error) {
      // Only silently ignore storage-related failures (private mode, iframe, strict partitioning)
      // Surface other errors for debugging
      const isStorageError =
        (error instanceof Error &&
          (error.message.includes("storage") ||
            error.message.includes("localStorage") ||
            error.message.includes("sessionStorage"))) ||
        (error instanceof DOMException &&
          (error.name === "SecurityError" ||
            error.name === "QuotaExceededError" ||
            error.name === "NotAllowedError"));

      if (!isStorageError) {
        console.error("PostHog initialization failed:", error);
      }
    }
  }, []);

  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return <>{children}</>;
  }

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
