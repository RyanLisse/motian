"use client";

import { useLayoutEffect } from "react";

/**
 * Suppress known third-party deprecation warnings we cannot fix (e.g. @xyflow/react
 * using zustand default export). Leaves other console output unchanged.
 */
function suppressKnownDeprecations() {
  if (typeof window === "undefined") return;
  const isZustandDeprecation = (args: unknown[]) => {
    const msg = args[0]?.toString?.() ?? "";
    return msg.includes("[DEPRECATED]") && msg.includes("zustand");
  };
  const origWarn = console.warn;
  const origError = console.error;
  console.warn = (...args: unknown[]) => {
    if (isZustandDeprecation(args)) return;
    origWarn.apply(console, args);
  };
  console.error = (...args: unknown[]) => {
    if (isZustandDeprecation(args)) return;
    origError.apply(console, args);
  };
}

/**
 * In restricted contexts (cross-origin iframe, strict Safari, embedded browser),
 * accessing localStorage/sessionStorage can throw "Access to storage is not allowed".
 * This patch runs before other client code and replaces window.localStorage with a
 * no-op implementation when the real one throws, so next-themes, PostHog, etc. don't
 * cause uncaught promise rejections.
 */
function patchStorageIfBlocked() {
  if (typeof window === "undefined") return;

  const noop = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    get length() {
      return 0;
    },
  };

  try {
    window.localStorage.getItem("__motian_storage_test__");
  } catch {
    try {
      Object.defineProperty(window, "localStorage", {
        value: noop,
        writable: true,
        configurable: true,
      });
    } catch {
      // Ignore if we can't patch (e.g. frozen window)
    }
  }

  try {
    window.sessionStorage.getItem("__motian_storage_test__");
  } catch {
    try {
      Object.defineProperty(window, "sessionStorage", {
        value: noop,
        writable: true,
        configurable: true,
      });
    } catch {
      // Ignore
    }
  }
}

export function SafeStoragePatch({ children }: { children: React.ReactNode }) {
  useLayoutEffect(() => {
    suppressKnownDeprecations();
    patchStorageIfBlocked();
  }, []);
  return <>{children}</>;
}
