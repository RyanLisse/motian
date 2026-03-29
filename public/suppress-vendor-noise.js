// Suppress known third-party console noise that cannot be fixed in source:
// 1. Vercel instrumentation: "Access to storage is not allowed from this context"
// 2. @xyflow/react → zustand 4.x: "[DEPRECATED] Default export is deprecated"
//
// These fire before React mounts, so PostHog's suppressor is not active yet.
// This script runs via <Script strategy="beforeInteractive"> in layout.tsx.
(function () {
  var origError = console.error;
  var origWarn = console.warn;

  console.error = function () {
    var msg = arguments[0];
    if (typeof msg === "string" && msg.includes("Access to storage")) return;
    origError.apply(console, arguments);
  };

  console.warn = function () {
    var msg = arguments[0];
    if (typeof msg === "string" && msg.includes("DEPRECATED")) return;
    origWarn.apply(console, arguments);
  };

  window.addEventListener("unhandledrejection", function (e) {
    var msg = (e.reason && e.reason.message) || String(e.reason || "");
    if (msg.includes("storage") || msg.includes("Access to storage")) {
      e.preventDefault();
    }
  });
})();
