import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type RepoLearningTaxonomy =
  | "test-recipe"
  | "convention"
  | "dependency-constraint"
  | "procedure";

export type RepoLearningFact = {
  id: string;
  taxonomy: RepoLearningTaxonomy;
  source: "repo-extractor";
  module: string;
  title: string;
  fact: string;
  sourcePath: string;
  extractedAt: string;
};

type RepoLearningState = {
  lastExtractedSha: string;
  extractedAt: string;
};

export type RepoLearningResult = {
  baseSha: string | null;
  headSha: string;
  processedFiles: string[];
  factCount: number;
  outputPath: string;
  statePath: string;
};

const DEFAULT_STATE_PATH = ".cache/repo-learning/state.json";
const DEFAULT_FACTS_PATH = ".cache/repo-learning/facts.json";

export function extractFactsFromContent(
  path: string,
  content: string,
  extractedAt: string,
): RepoLearningFact[] {
  if (path.endsWith(".test.ts") || path.includes("/tests/") || path.startsWith("tests/")) {
    return extractTestFacts(path, content, extractedAt);
  }

  if (path.endsWith("AGENTS.md") || path.endsWith("CLAUDE.md")) {
    return extractConventionFacts(path, content, extractedAt);
  }

  if (path.endsWith("Cargo.toml")) {
    return extractDependencyFacts(path, content, extractedAt);
  }

  if (isHookScript(path)) {
    return extractProcedureFacts(path, content, extractedAt);
  }

  return [];
}

export function runRepoLearning(options?: {
  repoRoot?: string;
  statePath?: string;
  factsPath?: string;
}): RepoLearningResult {
  const repoRoot = resolve(options?.repoRoot ?? process.cwd());
  const statePath = resolve(repoRoot, options?.statePath ?? DEFAULT_STATE_PATH);
  const factsPath = resolve(repoRoot, options?.factsPath ?? DEFAULT_FACTS_PATH);

  const headSha = runGit(repoRoot, ["rev-parse", "HEAD"]);
  const previousState = readState(statePath);
  const baseSha = previousState?.lastExtractedSha ?? null;

  const candidateFiles = listCandidateFiles(repoRoot, baseSha, headSha);
  const extractedAt = new Date().toISOString();

  const facts = candidateFiles.flatMap((relativePath) => {
    const absolutePath = resolve(repoRoot, relativePath);
    let content = "";
    try {
      content = readFileSync(absolutePath, "utf-8");
    } catch {
      return [];
    }
    return extractFactsFromContent(relativePath, content, extractedAt);
  });

  writeJsonFile(factsPath, facts);
  writeJsonFile(statePath, { lastExtractedSha: headSha, extractedAt } satisfies RepoLearningState);

  return {
    baseSha,
    headSha,
    processedFiles: candidateFiles,
    factCount: facts.length,
    outputPath: factsPath,
    statePath,
  };
}

function extractTestFacts(path: string, content: string, extractedAt: string): RepoLearningFact[] {
  const describes = Array.from(content.matchAll(/describe\(\s*["'`](.+?)["'`]/g), (m) =>
    m[1]?.trim(),
  );
  const tests = Array.from(content.matchAll(/(?:it|test)\(\s*["'`](.+?)["'`]/g), (m) =>
    m[1]?.trim(),
  );
  const module = inferModuleFromTestPath(path);

  const facts: RepoLearningFact[] = [];

  if (describes.length > 0 || tests.length > 0) {
    const scenario = [
      describes.length ? `describe: ${describes.slice(0, 4).join("; ")}` : "",
      tests.length ? `cases: ${tests.slice(0, 6).join("; ")}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    facts.push(
      createFact(
        path,
        module,
        "test-recipe",
        `How to test ${module}`,
        scenario || "Structural test patterns",
        extractedAt,
      ),
    );
  }

  return facts;
}

function extractConventionFacts(
  path: string,
  content: string,
  extractedAt: string,
): RepoLearningFact[] {
  const module = path.replace(/\/AGENTS\.md$|\/CLAUDE\.md$/, "") || "repo";
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- ") || /^\d+\./.test(line))
    .slice(0, 20);

  if (lines.length === 0) return [];

  return [
    createFact(
      path,
      module,
      "convention",
      `Project conventions for ${module}`,
      lines.join(" | "),
      extractedAt,
    ),
  ];
}

function extractDependencyFacts(
  path: string,
  content: string,
  extractedAt: string,
): RepoLearningFact[] {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="));

  const dependencies = lines.filter((line) => /^\w[\w-]*\s*=/.test(line)).slice(0, 30);
  if (dependencies.length === 0) return [];

  return [
    createFact(
      path,
      "cargo",
      "dependency-constraint",
      "Cargo dependency constraints",
      dependencies.join(" | "),
      extractedAt,
    ),
  ];
}

function extractProcedureFacts(
  path: string,
  content: string,
  extractedAt: string,
): RepoLearningFact[] {
  const topLines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);

  if (topLines.length === 0) return [];

  return [
    createFact(
      path,
      "hooks",
      "procedure",
      `How hook ${path} works`,
      topLines.join(" | "),
      extractedAt,
    ),
  ];
}

function createFact(
  sourcePath: string,
  module: string,
  taxonomy: RepoLearningTaxonomy,
  title: string,
  fact: string,
  extractedAt: string,
): RepoLearningFact {
  const id = `${taxonomy}:${sourcePath}`;
  return {
    id,
    taxonomy,
    source: "repo-extractor",
    module,
    title,
    fact,
    sourcePath,
    extractedAt,
  };
}

function isHookScript(path: string): boolean {
  const normalized = path.toLowerCase();
  return (
    normalized.includes(".husky/") ||
    normalized.includes("/hooks/") ||
    normalized.endsWith("pre-commit") ||
    normalized.endsWith("pre-push")
  );
}

function inferModuleFromTestPath(path: string): string {
  if (path.startsWith("tests/")) {
    return path.replace(/^tests\//, "").replace(/\.test\.[^.]+$/, "");
  }

  return path
    .replace(/^src\//, "")
    .replace(/^app\//, "")
    .replace(/\.test\.[^.]+$/, "")
    .replace(/\.[^.]+$/, "");
}

function listCandidateFiles(repoRoot: string, baseSha: string | null, headSha: string): string[] {
  const relevantPattern =
    /(^|\/)(tests\/.*\.test\.ts|AGENTS\.md|CLAUDE\.md|Cargo\.toml|\.husky\/|hooks\/)/;

  if (baseSha) {
    const changed = runGit(repoRoot, ["diff", "--name-only", `${baseSha}..${headSha}`])
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((path) => relevantPattern.test(path));
    return Array.from(new Set(changed));
  }

  const allTracked = runGit(repoRoot, ["ls-files"])
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((path) => relevantPattern.test(path));

  return Array.from(new Set(allTracked));
}

function readState(statePath: string): RepoLearningState | null {
  try {
    const raw = readFileSync(statePath, "utf-8");
    return JSON.parse(raw) as RepoLearningState;
  } catch {
    return null;
  }
}

function writeJsonFile(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

function runGit(repoRoot: string, args: string[]): string {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf-8" }).trim();
}
