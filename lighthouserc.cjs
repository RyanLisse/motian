const baseUrl = process.env.LHCI_BASE_URL ?? "http://127.0.0.1:3001";
const candidateDetailPath = process.env.LHCI_CANDIDATE_DETAIL_PATH ?? "/kandidaten";

const urls = ["/", "/kandidaten", "/vacatures", candidateDetailPath, "/chat"].map((path) =>
  new URL(path, baseUrl).toString(),
);

module.exports = {
  ci: {
    collect: {
      url: urls,
      numberOfRuns: 1,
      settings: {
        chromeFlags: "--no-sandbox --disable-dev-shm-usage",
        formFactor: "mobile",
        throttlingMethod: "simulate",
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.75 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci",
    },
  },
};
