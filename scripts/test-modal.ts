/**
 * Quick diagnostic: test Modal sandbox creation.
 * Run: npx tsx scripts/test-modal.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });

import { ModalClient } from "modal";

async function test() {
  try {
    console.log("1. Creating ModalClient...");
    const modal = new ModalClient();

    console.log("2. Getting app...");
    const app = await modal.apps.fromName("motian-scraper", {
      createIfMissing: true,
    });
    console.log("   App ID:", app.appId);

    console.log("3. Defining image...");
    const image = modal.images
      .fromRegistry("node:22-slim")
      .dockerfileCommands([
        "RUN apt-get update && apt-get install -y wget gnupg ca-certificates",
        "RUN npx playwright install --with-deps chromium",
        "RUN npm install -g @browserbasehq/stagehand@latest zod playwright",
      ]);

    console.log("4. Creating sandbox (this may take a few minutes on first run)...");
    const sandbox = await modal.sandboxes.create(app, image, {
      env: {
        STRIIVE_USERNAME: process.env.STRIIVE_USERNAME ?? "",
        STRIIVE_PASSWORD: process.env.STRIIVE_PASSWORD ?? "",
        STAGEHAND_ENV: "LOCAL",
      },
      timeoutMs: 10 * 60 * 1000,
      workdir: "/root",
    });
    console.log("   Sandbox created successfully!");

    console.log("5. Running quick test command...");
    const proc = await sandbox.exec(["node", "--version"], {
      timeoutMs: 30_000,
    });
    const exitCode = await proc.wait();
    const stdout = await proc.stdout.readText();
    console.log(`   Node version in sandbox: ${stdout.trim()} (exit: ${exitCode})`);

    console.log("6. Terminating sandbox...");
    await sandbox.terminate().catch(() => {});
    console.log("   Done! Modal sandbox works correctly.");
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error("ERROR:", error.message);
    if (error.stack) {
      console.error(error.stack.split("\n").slice(0, 8).join("\n"));
    }
  }
}

test();
