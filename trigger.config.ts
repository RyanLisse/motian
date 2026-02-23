import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_nqihauooanbnqnbpoybp",
  dirs: ["./trigger"],
  runtime: "node-22",
  logLevel: "info",
  enableConsoleLogging: true,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 30000,
      factor: 2,
      randomize: true,
    },
  },
});
