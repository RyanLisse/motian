import fs from "node:fs";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
type TypeScriptModule = typeof import("typescript");

function readSource(...segments: string[]) {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

async function parseSource(...segments: string[]) {
  const ts = await import("typescript");
  const filePath = path.join(ROOT, ...segments);
  const sourceText = readSource(...segments);

  return {
    filePath,
    sourceFile: ts.createSourceFile(
      filePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    ),
    ts,
  };
}

function walk(
  ts: TypeScriptModule,
  node: import("typescript").Node,
  visit: (node: import("typescript").Node) => void,
) {
  visit(node);
  ts.forEachChild(node, (child) => walk(ts, child, visit));
}

function hasImportDeclaration(
  ts: TypeScriptModule,
  sourceFile: Awaited<ReturnType<typeof parseSource>>["sourceFile"],
  moduleSpecifier: string,
) {
  let found = false;

  walk(ts, sourceFile, (node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteralLike(node.moduleSpecifier) &&
      node.moduleSpecifier.text === moduleSpecifier
    ) {
      found = true;
    }
  });

  return found;
}

function hasDynamicImport(
  ts: TypeScriptModule,
  sourceFile: Awaited<ReturnType<typeof parseSource>>["sourceFile"],
  moduleSpecifier: string,
) {
  let found = false;

  walk(ts, sourceFile, (node) => {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      node.arguments[0].text === moduleSpecifier
    ) {
      found = true;
    }
  });

  return found;
}

function hasJsxExpressionAttribute(
  ts: TypeScriptModule,
  sourceFile: Awaited<ReturnType<typeof parseSource>>["sourceFile"],
  tagName: string,
  attributeName: string,
  expressionText: string,
) {
  let found = false;

  walk(ts, sourceFile, (node) => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(sourceFile) === tagName
    ) {
      for (const attribute of node.attributes.properties) {
        if (
          ts.isJsxAttribute(attribute) &&
          attribute.name.text === attributeName &&
          attribute.initializer &&
          ts.isJsxExpression(attribute.initializer) &&
          attribute.initializer.expression?.getText(sourceFile) === expressionText
        ) {
          found = true;
        }
      }
    }
  });

  return found;
}

function hasJsxStringAttribute(
  ts: TypeScriptModule,
  sourceFile: Awaited<ReturnType<typeof parseSource>>["sourceFile"],
  tagName: string,
  attributeName: string,
  value: string,
) {
  let found = false;

  walk(ts, sourceFile, (node) => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(sourceFile) === tagName
    ) {
      for (const attribute of node.attributes.properties) {
        if (
          ts.isJsxAttribute(attribute) &&
          attribute.name.text === attributeName &&
          attribute.initializer &&
          ts.isStringLiteral(attribute.initializer) &&
          attribute.initializer.text === value
        ) {
          found = true;
        }
      }
    }
  });

  return found;
}

function hasJsxWrapper(
  ts: TypeScriptModule,
  sourceFile: Awaited<ReturnType<typeof parseSource>>["sourceFile"],
  wrapperName: string,
  childName: string,
) {
  let found = false;

  walk(ts, sourceFile, (node) => {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(sourceFile) === wrapperName) {
      for (const child of node.children) {
        if (
          (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) &&
          child.tagName.getText(sourceFile) === childName
        ) {
          found = true;
        }
      }
    }
  });

  return found;
}

function countCatchChains(
  ts: TypeScriptModule,
  sourceFile: Awaited<ReturnType<typeof parseSource>>["sourceFile"],
) {
  let count = 0;

  walk(ts, sourceFile, (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "catch"
    ) {
      count += 1;
    }
  });

  return count;
}

describe("shell performance loading", () => {
  it("routes shell overlays through lazy loader boundaries", async () => {
    const routeShell = await parseSource("components", "route-shell-overlays.tsx");
    const commandLoader = await parseSource("components", "command-palette-loader.tsx");
    const chatLoader = await parseSource("components", "chat", "chat-widget-loader.tsx");

    expect(
      hasImportDeclaration(
        routeShell.ts,
        routeShell.sourceFile,
        "@/components/command-palette-loader",
      ),
    ).toBe(true);
    expect(
      hasImportDeclaration(
        routeShell.ts,
        routeShell.sourceFile,
        "@/components/chat/chat-widget-loader",
      ),
    ).toBe(true);
    expect(
      hasDynamicImport(routeShell.ts, routeShell.sourceFile, "@/components/command-palette"),
    ).toBe(false);
    expect(
      hasDynamicImport(routeShell.ts, routeShell.sourceFile, "@/components/chat/chat-widget"),
    ).toBe(false);

    expect(
      hasDynamicImport(commandLoader.ts, commandLoader.sourceFile, "@/components/command-palette"),
    ).toBe(true);
    expect(
      hasJsxExpressionAttribute(
        commandLoader.ts,
        commandLoader.sourceFile,
        "CommandPalette",
        "initialOpen",
        "openOnLoad",
      ),
    ).toBe(true);

    expect(
      hasDynamicImport(chatLoader.ts, chatLoader.sourceFile, "@/components/chat/chat-widget"),
    ).toBe(true);
    expect(
      hasJsxExpressionAttribute(
        chatLoader.ts,
        chatLoader.sourceFile,
        "ChatWidget",
        "defaultOpen",
        "openOnLoad",
      ),
    ).toBe(true);
    expect(
      hasJsxWrapper(chatLoader.ts, chatLoader.sourceFile, "ChatContextProvider", "ChatWidget"),
    ).toBe(true);
    expect(
      hasJsxStringAttribute(
        chatLoader.ts,
        chatLoader.sourceFile,
        "button",
        "aria-label",
        "Chatwidget openen",
      ),
    ).toBe(true);
    expect(
      hasJsxStringAttribute(
        chatLoader.ts,
        chatLoader.sourceFile,
        "button",
        "title",
        "Chatwidget openen (⌘J)",
      ),
    ).toBe(true);
  });

  it("lazy-loads telemetry sinks inside the web vitals reporter", async () => {
    const reporter = await parseSource("src", "components", "web-vitals-reporter.tsx");

    expect(hasImportDeclaration(reporter.ts, reporter.sourceFile, "posthog-js")).toBe(false);
    expect(hasImportDeclaration(reporter.ts, reporter.sourceFile, "@sentry/nextjs")).toBe(false);
    expect(hasDynamicImport(reporter.ts, reporter.sourceFile, "posthog-js")).toBe(true);
    expect(hasDynamicImport(reporter.ts, reporter.sourceFile, "@sentry/nextjs")).toBe(true);
    expect(countCatchChains(reporter.ts, reporter.sourceFile)).toBeGreaterThanOrEqual(6);
  });

  it("keeps heavy charting surfaces behind dynamic imports on overview and candidate detail pages", async () => {
    const overview = await parseSource("app", "overzicht", "page.tsx");
    const candidateDetail = await parseSource("app", "kandidaten", "[id]", "page.tsx");

    expect(
      hasDynamicImport(overview.ts, overview.sourceFile, "@/components/overview/kpi-trend-chart"),
    ).toBe(true);
    expect(
      hasDynamicImport(
        candidateDetail.ts,
        candidateDetail.sourceFile,
        "@/components/candidate-profile/match-scores-chart",
      ),
    ).toBe(true);
    expect(
      hasDynamicImport(candidateDetail.ts, candidateDetail.sourceFile, "@/components/skills-radar"),
    ).toBe(true);
  });
});
