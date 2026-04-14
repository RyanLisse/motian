import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function read(relativePath: string) {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("databronnen route alias", () => {
  it("revalidates the databronnen path from MCP platform mutations", () => {
    const source = read("src/mcp/tools/platforms.ts");

    expect(source).toContain('revalidatePath("/databronnen")');
  });

  it("serves the scraper UI under app/scraper", () => {
    const scraperPage = path.join(ROOT, "app/scraper/page.tsx");
    const source = readFileSync(scraperPage, "utf8");

    expect(source).toBeTruthy();
  });
});
