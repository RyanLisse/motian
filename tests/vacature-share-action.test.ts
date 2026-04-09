import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]) {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.doUnmock("react");
});

describe("vacature share action", () => {
  it("builds the canonical vacature detail URL without list filters", async () => {
    const { buildVacatureShareUrl } = await import("../components/vacature-share-button");

    expect(buildVacatureShareUrl("vac-123", "https://motian.example")).toBe(
      "https://motian.example/vacatures/vac-123",
    );
  });

  it("falls back to copying the canonical vacature URL when native share is unavailable", async () => {
    const setShareState = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation(((
      callback: Parameters<typeof setTimeout>[0],
    ) => {
      if (typeof callback === "function") callback();
      return 0 as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);

    vi.stubGlobal("window", {
      location: { origin: "https://motian.example" },
      setTimeout,
    });
    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });

    vi.doMock("react", async () => {
      const actual = await vi.importActual<typeof import("react")>("react");
      return {
        ...actual,
        useState: () => ["idle", setShareState] as const,
      };
    });

    const { VacatureShareButton } = await import("../components/vacature-share-button");
    const element = VacatureShareButton({
      jobId: "vac-123",
      jobTitle: "Senior Recruiter",
    });
    const button = Array.isArray(element.props.children)
      ? element.props.children[0]
      : element.props.children;

    await button.props.onClick();

    expect(writeText).toHaveBeenCalledWith("https://motian.example/vacatures/vac-123");
    expect(setShareState).toHaveBeenNthCalledWith(1, "copied");
    expect(setShareState).toHaveBeenNthCalledWith(2, "idle");
    expect(setTimeoutSpy).toHaveBeenCalled();
  });

  it("wires the explicit share button into the vacature detail header", () => {
    const pageSource = readFile("app", "vacatures", "[id]", "page.tsx");
    const componentSource = readFile("components", "vacature-share-button.tsx");

    expect(pageSource).toContain(
      'import { VacatureShareButton } from "@/components/vacature-share-button";',
    );
    expect(pageSource).toContain("<VacatureShareButton jobId={job.id} jobTitle={job.title} />");
    expect(componentSource).toContain("buildVacatureShareUrl(jobId, window.location.origin)");
    expect(componentSource).toContain("Deel vacature");
    expect(componentSource).toContain("Link gekopieerd");
  });
});
