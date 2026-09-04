import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

const ROOT = join(process.cwd());

/**
 * R22 / R23 — pnpm 9.15 reads overrides from package.json#pnpm; drizzle-orm
 * converges on one version across workspace packages (WP8a / WP8b).
 */
describe("workspace config hygiene (WP8a)", () => {
  it("package.json pnpm.overrides is present where pnpm 9.15 reads it (R22)", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      pnpm?: {
        overrides?: Record<string, string>;
        packageExtensions?: Record<string, unknown>;
        peerDependencyRules?: Record<string, unknown>;
      };
      packageManager?: string;
    };

    expect(pkg.packageManager).toMatch(/^pnpm@9\./);
    expect(pkg.pnpm?.overrides).toBeTypeOf("object");
    expect(Object.keys(pkg.pnpm?.overrides ?? {}).length).toBeGreaterThan(0);
    expect(pkg.pnpm?.packageExtensions).toBeTypeOf("object");
    expect(pkg.pnpm?.peerDependencyRules).toBeTypeOf("object");
  });

  it("pnpm-lock.yaml records overrides after install (R22)", () => {
    const lock = readFileSync(join(ROOT, "pnpm-lock.yaml"), "utf8");
    expect(lock).toMatch(/^overrides:/m);
    expect(lock).toMatch(/brace-expansion/);
    expect(lock).toMatch(/shell-quote/);
  });

  it("pnpm-workspace.yaml only lists workspace packages (R22)", () => {
    const workspace = parseYaml(readFileSync(join(ROOT, "pnpm-workspace.yaml"), "utf8")) as {
      packages?: string[];
      overrides?: unknown;
    };

    expect(Array.isArray(workspace.packages)).toBe(true);
    expect(workspace.overrides).toBeUndefined();
  });

  it("esco does not declare a direct drizzle-orm dependency (R23)", () => {
    const esco = JSON.parse(readFileSync(join(ROOT, "packages/esco/package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };

    expect(esco.dependencies?.["drizzle-orm"]).toBeUndefined();
    expect(esco.dependencies?.["@motian/db"]).toBe("workspace:*");
  });

  it("root and @motian/db declare the same drizzle-orm major range (R23)", () => {
    const root = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    const db = JSON.parse(readFileSync(join(ROOT, "packages/db/package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };

    expect(root.dependencies?.["drizzle-orm"]).toBe("^0.45.2");
    expect(db.dependencies?.["drizzle-orm"]).toBe("^0.45.2");
  });

  it("biome.json includes packages/*/src for lint gates (R19)", () => {
    const biome = JSON.parse(readFileSync(join(ROOT, "biome.json"), "utf8")) as {
      files?: { includes?: string[] };
    };
    const includes = biome.files?.includes ?? [];
    expect(includes.some((pattern) => pattern.includes("packages/*/src"))).toBe(true);
  });
});
