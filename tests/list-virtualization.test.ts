import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveVirtualListOverscan } from "../components/shared/virtual-list";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]) {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("shared list virtualization", () => {
  it("defaults overscan to a mobile-friendly window while allowing overrides", () => {
    expect(resolveVirtualListOverscan(undefined, true)).toBe(4);
    expect(resolveVirtualListOverscan(undefined, false)).toBe(6);
    expect(resolveVirtualListOverscan(5, true)).toBe(5);
  });

  it("wires kandidaten, vacatures, and chat through the shared VirtualList", () => {
    const virtualList = readFile("components", "shared", "virtual-list.tsx");
    const kandidatenPage = readFile("app", "kandidaten", "page.tsx");
    const candidateResults = readFile("components", "candidate-results-list.tsx");
    const sidebarJobList = readFile("components", "sidebar", "sidebar-job-list.tsx");
    const chatMessages = readFile("components", "chat", "chat-messages.tsx");

    expect(virtualList).toContain("useVirtualizer");
    expect(virtualList).toContain("measureElement");
    expect(virtualList).toContain('scrollElement.style.scrollBehavior = "smooth"');

    expect(kandidatenPage).toContain("CandidateResultsList");
    expect(candidateResults).toContain("MOBILE_VIRTUALIZATION_THRESHOLD = 18");
    expect(candidateResults).toContain('scrollMode="parent"');
    expect(candidateResults).toContain("<VirtualList");

    expect(sidebarJobList).toContain("VirtualList");
    expect(sidebarJobList).not.toContain("MobileVirtualizedJobList");
    expect(sidebarJobList).toContain("VIRTUALIZATION_THRESHOLD = 18");

    expect(chatMessages).toContain("CHAT_HISTORY_VIRTUALIZATION_THRESHOLD = 50");
    expect(chatMessages).toContain("<ChatMessageItem");
    expect(chatMessages).toContain("<VirtualList");
  });
});
