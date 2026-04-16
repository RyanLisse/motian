/** @type {import('@lhci/cli').UserConfig} */
module.exports = {
  ci: {
    collect: {
      // URLs are provided by the GitHub Actions workflow.
      // For local testing, point LHCI at the canonical routes directly:
      //   npx lhci collect --config=./lighthouserc.cjs \
      //     --url=http://127.0.0.1:3001/overzicht \
      //     --url=http://127.0.0.1:3001/kandidaten \
      //     --url=http://127.0.0.1:3001/vacatures \
      //     --url=http://127.0.0.1:3001/chat
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
    upload: {
      target: "temporary-public-storage",
    },
  },
};
