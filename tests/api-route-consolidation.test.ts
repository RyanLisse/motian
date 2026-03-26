import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");

function readRoute(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf-8");
}

describe("API route consolidation — vacatures canonical, opdrachten re-exports", () => {
  const reExportRoutes = [
    {
      opdrachten: "app/api/opdrachten/route.ts",
      vacatures: "app/api/vacatures/route.ts",
      expectedExports: ["GET"],
    },
    {
      opdrachten: "app/api/opdrachten/[id]/route.ts",
      vacatures: "app/api/vacatures/[id]/route.ts",
      expectedExports: ["GET", "PATCH", "DELETE"],
    },
    {
      opdrachten: "app/api/opdrachten/[id]/koppel/route.ts",
      vacatures: "app/api/vacatures/[id]/koppel/route.ts",
      expectedExports: ["POST"],
    },
    {
      opdrachten: "app/api/opdrachten/[id]/match-kandidaten/route.ts",
      vacatures: "app/api/vacatures/[id]/match-kandidaten/route.ts",
      expectedExports: ["POST"],
    },
    {
      opdrachten: "app/api/opdrachten/[id]/raw/route.ts",
      vacatures: "app/api/vacatures/[id]/raw/route.ts",
      expectedExports: ["GET"],
    },
    {
      opdrachten: "app/api/opdrachten/zoeken/route.ts",
      vacatures: "app/api/vacatures/zoeken/route.ts",
      expectedExports: ["GET"],
    },
  ];

  for (const { opdrachten, vacatures, expectedExports } of reExportRoutes) {
    describe(opdrachten, () => {
      it("is a thin re-export (no business logic)", () => {
        const content = readRoute(opdrachten);

        // Should be short — just re-exports
        const lines = content
          .split("\n")
          .filter((line) => line.trim().length > 0);
        expect(lines.length).toBeLessThanOrEqual(3);

        // Should re-export from vacatures equivalent
        expect(content).toContain("@/app/api/vacatures/");
        expect(content).toContain("export");
      });

      it(`re-exports ${expectedExports.join(", ")}`, () => {
        const content = readRoute(opdrachten);
        for (const method of expectedExports) {
          expect(content).toContain(method);
        }
      });
    });

    describe(vacatures, () => {
      it("contains the actual route logic (not a re-export)", () => {
        const content = readRoute(vacatures);

        // Should NOT be a re-export from opdrachten
        expect(content).not.toContain("@/app/api/opdrachten/");

        // Should contain actual handler logic (imports, withApiHandler, etc.)
        const lines = content
          .split("\n")
          .filter((line) => line.trim().length > 0);
        expect(lines.length).toBeGreaterThan(5);
      });
    });
  }
});
