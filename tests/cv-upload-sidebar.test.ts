import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("CV upload sidebar", () => {
  it("exports CvUploadSidebar component", () => {
    const source = readFile("components/cv-upload-sidebar.tsx");
    expect(source).toContain("export function CvUploadSidebar");
  });

  it("uses Sheet from components/ui/sheet", () => {
    const source = readFile("components/cv-upload-sidebar.tsx");
    expect(source).toContain("Sheet");
    expect(source).toContain("SheetContent");
  });

  it("has drag-and-drop handlers", () => {
    const source = readFile("components/cv-upload-sidebar.tsx");
    expect(source).toContain("onDragOver");
    expect(source).toContain("onDrop");
  });

  it("calls /api/cv-upload endpoint", () => {
    const source = readFile("components/cv-upload-sidebar.tsx");
    expect(source).toContain("/api/cv-upload");
  });

  it("has Dutch UI strings", () => {
    const source = readFile("components/cv-upload-sidebar.tsx");
    expect(source).toContain("Sleep een CV hierheen");
    expect(source).toContain("Opslaan");
  });

  it("handles deduplication", () => {
    const source = readFile("components/cv-upload-sidebar.tsx");
    expect(source).toContain("Samenvoegen");
    expect(source).toContain("Nieuw aanmaken");
  });
});

describe("Layout integration", () => {
  it("layout.tsx includes ChatWidget as global widget", () => {
    const source = readFile("app/layout.tsx");
    expect(source).toContain("ChatWidget");
  });
});
