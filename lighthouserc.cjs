/** @type {import('@lhci/cli').UserConfig} */
module.exports = {
  ci: {
    collect: {
      // Use Vercel preview URL or local dev server
      url: [
        "http://localhost:3002/",
        "http://localhost:3002/kandidaten",
        "http://localhost:3002/vacatures",
        "http://localhost:3002/chat",
      ],
      numberOfRuns: 3,
      settings: {
        // Mobile profile: throttled CPU + slow 4G
        preset: "desktop",
        // Override to mobile emulation
        formFactor: "mobile",
        screenEmulation: {
          mobile: true,
          width: 375,
          height: 812,
          deviceScaleFactor: 3,
        },
        throttling: {
          cpuSlowdownMultiplier: 4,
          downloadThroughputKbps: 1600,
          uploadThroughputKbps: 750,
          rttMs: 150,
        },
        // Skip audits that need auth
        onlyCategories: ["performance"],
      },
    },
    assert: {
      assertions: {
        // Core Web Vitals budgets
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        // Performance score gate
        "categories:performance": ["error", { minScore: 0.75 }],
        // Additional useful metrics (warn, don't fail)
        "first-contentful-paint": ["warn", { maxNumericValue: 1800 }],
        "total-blocking-time": ["warn", { maxNumericValue: 300 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
