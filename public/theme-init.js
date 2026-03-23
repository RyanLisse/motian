/**
 * Theme initialization script for PostHog/Sentry to suppress known deprecation warnings.
 * This runs before React hydrates to prevent flash of wrong theme.
 */
(function () {
  // Suppress known third-party deprecation warnings (zustand default export)
  const isZustandDeprecation = (args) => {
    const msg = args[0]?.toString?.() ?? "";
    return msg.includes("[DEPRECATED]") && msg.includes("zustand");
  };
  const origWarn = console.warn;
  const origError = console.error;
  console.warn = (...args) => {
    if (!isZustandDeprecation(args)) origWarn.apply(console, args);
  };
  console.error = (...args) => {
    if (!isZustandDeprecation(args)) origError.apply(console, args);
  };

  // Patch storage if blocked
  const noop = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  };

  const patchStorage = (storageName) => {
    if (typeof window === "undefined") return;

    try {
      if (window[storageName]) return;
    } catch (e) {
      // Ignore blocked getters and replace below.
    }

    try {
      Object.defineProperty(window, storageName, {
        configurable: true,
        value: noop,
        writable: true,
      });
    } catch (e) {
      // Ignore storage access errors
    }
  };

  patchStorage("localStorage");
  patchStorage("sessionStorage");

  // Apply theme from cookie immediately to prevent flash
  try {
    const theme = (document.cookie.match(/theme=(light|dark)/) || [])[1];
    if (theme) {
      document.documentElement.classList.add(theme);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {
    // Ignore cookie access errors
  }
})();
