import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveBffUpstreamOrigin } from "@/src/lib/bff";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("resolveBffUpstreamOrigin", () => {
  const original = process.env.INTERNAL_SERVER_URL;

  afterEach(() => {
    if (original === undefined) {
      process.env.INTERNAL_SERVER_URL = undefined;
      Reflect.deleteProperty(process.env, "INTERNAL_SERVER_URL");
    } else {
      process.env.INTERNAL_SERVER_URL = original;
    }
  });

  it("keeps the inbound origin on Vercel, where it is already local", () => {
    Reflect.deleteProperty(process.env, "INTERNAL_SERVER_URL");
    expect(resolveBffUpstreamOrigin("https://motian.vercel.app")).toBe(
      "https://motian.vercel.app",
    );
  });

  it("uses the loopback when configured, so the hop stays inside the container", () => {
    process.env.INTERNAL_SERVER_URL = "http://127.0.0.1:3000";
    expect(resolveBffUpstreamOrigin("https://motian.example.com")).toBe(
      "http://127.0.0.1:3000",
    );
  });

  it("normalises to an origin, dropping any path on the configured value", () => {
    process.env.INTERNAL_SERVER_URL = "http://127.0.0.1:3000/some/path";
    expect(resolveBffUpstreamOrigin("https://motian.example.com")).toBe(
      "http://127.0.0.1:3000",
    );
  });

  it.each([["   "], ["not a url"], ["://broken"]])(
    "falls back to the inbound origin for the unusable value %j",
    (value) => {
      process.env.INTERNAL_SERVER_URL = value;
      // A malformed deployment variable must degrade, not take the BFF down.
      expect(resolveBffUpstreamOrigin("https://motian.example.com")).toBe(
        "https://motian.example.com",
      );
    },
  );
});

describe("container build", () => {
  const dockerfile = read("Dockerfile");
  /** Dockerfile instructions with comments stripped. */
  const instructions = dockerfile
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");

  it("builds Next in standalone mode", () => {
    expect(read("next.config.ts")).toContain('output: "standalone"');
    expect(dockerfile).toContain("/app/.next/standalone");
    expect(dockerfile).toContain('CMD ["node", "server.js"]');
  });

  it("never needs a secret to build", () => {
    // The schema check is re-run at boot; it must not force DATABASE_URL into
    // the build context. Only ARG/ENV lines matter — the comments explain why.
    expect(instructions).toContain("SKIP_ENV_VALIDATION=1");
    expect(instructions).not.toContain("SENTRY_AUTH_TOKEN");
    expect(instructions).not.toContain("DATABASE_URL");
    expect(instructions).not.toContain("API_SECRET");
  });

  it("declares only non-secret NEXT_PUBLIC build args", () => {
    const args = [...instructions.matchAll(/^ARG (\w+)/gmu)].map(
      (match) => match[1],
    );
    expect(args.length).toBeGreaterThan(0);
    for (const arg of args) {
      expect(arg.startsWith("NEXT_PUBLIC_")).toBe(true);
    }
  });

  it("runs as a non-root user", () => {
    expect(dockerfile).toContain("USER nextjs");
  });

  it("exposes /api/health as a public proxy path for HEALTHCHECK", () => {
    expect(read("proxy.ts")).toContain('"/api/health"');
  });

  it("probes liveness, not the database", () => {
    const healthcheck = instructions
      .split("\n")
      .filter((line) => line.includes("HEALTHCHECK") || line.includes("CMD wget"))
      .join("\n");

    expect(healthcheck).toContain("HEALTHCHECK");
    expect(healthcheck).toContain("/api/health");
    // /api/gezondheid runs two Neon queries; a blip there must not restart us.
    expect(healthcheck).not.toContain("/api/gezondheid");
    // A cold Next boot must not be counted as a failure.
    expect(healthcheck).toContain("start-period");
  });

  it("keeps secrets and node_modules out of the build context", () => {
    const dockerignore = read(".dockerignore");
    expect(dockerignore).toContain(".env");
    expect(dockerignore).toContain("node_modules");
    expect(dockerignore).toContain(".git");
  });
});
