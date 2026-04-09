import { access, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type AppBuildManifest = {
  pages?: Record<string, string[]>;
};
type BudgetResult = { route: string; sizeKb: number; budgetKb: number; passed: boolean };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(projectRoot, ".next", "app-build-manifest.json");
const serverAppRoot = path.join(projectRoot, ".next", "server", "app");

const ROUTE_BUDGETS_KB: Record<string, number> = {
  "/overzicht/page": 260,
  "/vacatures/page": 320,
  "/kandidaten/page": 320,
  "/pipeline/page": 280,
  "/messages/page": 260,
};

async function loadManifest(): Promise<AppBuildManifest> {
  try {
    await access(manifestPath);
  } catch {
    throw new Error(
      "Build manifest ontbreekt. Draai eerst `pnpm build` voordat je budget checks uitvoert.",
    );
  }

  const manifestModule = await import(manifestPath, {
    with: { type: "json" },
  });
  return (manifestModule.default ?? {}) as AppBuildManifest;
}

async function getTotalBytes(chunks: string[]) {
  const uniqueChunks = Array.from(new Set(chunks));
  let total = 0;

  for (const chunk of uniqueChunks) {
    const chunkPath = path.join(projectRoot, ".next", chunk);
    try {
      const info = await stat(chunkPath);
      total += info.size;
    } catch {
      // Some manifest entries are virtual/non-file; ignore them for file-size budgets.
    }
  }

  return total;
}

async function getServerClientManifestBytes(route: string) {
  const routePath = route.replace(/^\/|\/page$/g, "");
  const clientManifestPath = path.join(
    serverAppRoot,
    routePath,
    "page_client-reference-manifest.js",
  );
  const pageJsPath = path.join(serverAppRoot, routePath, "page.js");

  let total = 0;
  try {
    total += (await stat(clientManifestPath)).size;
  } catch {
    return 0;
  }

  try {
    total += (await stat(pageJsPath)).size;
  } catch {
    // Optional in some build layouts.
  }

  return total;
}

async function main() {
  let manifest: AppBuildManifest | null = null;
  try {
    manifest = await loadManifest();
  } catch {
    manifest = null;
  }

  const pages = manifest?.pages ?? {};
  const results: BudgetResult[] = [];

  for (const [route, budgetKb] of Object.entries(ROUTE_BUDGETS_KB)) {
    let totalBytes = 0;
    const chunks = pages[route];
    if (chunks) {
      totalBytes = await getTotalBytes(chunks);
    }

    if (totalBytes === 0) {
      totalBytes = await getServerClientManifestBytes(route);
    }

    const sizeKb = Math.round((totalBytes / 1024) * 10) / 10;
    results.push({ route, sizeKb, budgetKb, passed: sizeKb > 0 && sizeKb <= budgetKb });
  }

  const failed = results.filter((entry) => !entry.passed);

  for (const entry of results) {
    const status = entry.passed ? "PASS" : "FAIL";
    console.log(`${status} ${entry.route} ${entry.sizeKb}KB / ${entry.budgetKb}KB`);
  }

  if (failed.length > 0) {
    console.error(`\nShell performance budget check failed for ${failed.length} route(s).`);
    process.exit(1);
  }
}

void main();
