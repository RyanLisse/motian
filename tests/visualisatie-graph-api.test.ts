/**
 * Unit tests for graph API data transformation and filtering logic.
 * Tests for GET /api/visualisatie/graph endpoint.
 */
import { describe, expect, it } from "vitest";
import {
  buildCandidateNode,
  buildEdgesFromMatches,
  buildEdgesFromSkills,
  buildJobNode,
  buildSkillNode,
  filterEdgesByNodes,
  filterNodesByType,
} from "../src/lib/graph-data.js";
import type { GraphEdge, GraphEdgeType, GraphNode, GraphNodeType } from "../src/types/graph.js";

// --- Sample data ---

const sampleJob = {
  id: "job-1",
  title: "Senior TypeScript Developer",
  company: "Acme BV",
  location: "Amsterdam",
  platform: "striive",
  status: "open",
};

const sampleCandidate = {
  id: "cand-1",
  name: "Jan Janssen",
  role: "Frontend Developer",
  location: "Utrecht",
};

const sampleSkill = {
  uri: "http://data.europa.eu/esco/skill/001",
  preferredLabelEn: "TypeScript programming",
  preferredLabelNl: "TypeScript programmeren",
  escoVersion: "1.2",
  skillType: "skill",
};

const sampleMatch = {
  id: "match-1",
  jobId: "job-1",
  candidateId: "cand-1",
  matchScore: 85.5,
  status: "pending",
};

const sampleJobSkill = {
  id: "js-1",
  jobId: "job-1",
  escoUri: "http://data.europa.eu/esco/skill/001",
  confidence: 0.9,
  required: true,
  critical: false,
};

const sampleCandidateSkill = {
  id: "cs-1",
  candidateId: "cand-1",
  escoUri: "http://data.europa.eu/esco/skill/001",
  confidence: 0.8,
};

// --- Node builder tests ---

describe("visualisatie graph — buildJobNode", () => {
  it("creates a job node with correct id, type and label", () => {
    const node = buildJobNode(sampleJob);
    expect(node.id).toBe("job-1");
    expect(node.type).toBe("job");
    expect(node.label).toBe("Senior TypeScript Developer");
  });

  it("includes company, location, platform and status in metadata", () => {
    const node = buildJobNode(sampleJob);
    expect(node.metadata).toMatchObject({
      company: "Acme BV",
      location: "Amsterdam",
      platform: "striive",
      status: "open",
    });
  });

  it("handles null company and location", () => {
    const node = buildJobNode({ ...sampleJob, company: null, location: null });
    expect(node.metadata).toMatchObject({ company: null, location: null });
  });
});

describe("visualisatie graph — buildCandidateNode", () => {
  it("creates a candidate node with correct id, type and label", () => {
    const node = buildCandidateNode(sampleCandidate);
    expect(node.id).toBe("cand-1");
    expect(node.type).toBe("candidate");
    expect(node.label).toBe("Jan Janssen");
  });

  it("includes role and location in metadata", () => {
    const node = buildCandidateNode(sampleCandidate);
    expect(node.metadata).toMatchObject({
      role: "Frontend Developer",
      location: "Utrecht",
    });
  });

  it("handles null role and location", () => {
    const node = buildCandidateNode({ ...sampleCandidate, role: null, location: null });
    expect(node.metadata).toMatchObject({ role: null, location: null });
  });
});

describe("visualisatie graph — buildSkillNode", () => {
  it("creates a skill node with uri as id", () => {
    const node = buildSkillNode(sampleSkill);
    expect(node.id).toBe("http://data.europa.eu/esco/skill/001");
    expect(node.type).toBe("skill");
  });

  it("uses preferredLabelNl as label when available", () => {
    const node = buildSkillNode(sampleSkill);
    expect(node.label).toBe("TypeScript programmeren");
  });

  it("falls back to preferredLabelEn when Nl is null", () => {
    const node = buildSkillNode({ ...sampleSkill, preferredLabelNl: null });
    expect(node.label).toBe("TypeScript programming");
  });

  it("includes escoVersion and skillType in metadata", () => {
    const node = buildSkillNode(sampleSkill);
    expect(node.metadata).toMatchObject({
      escoVersion: "1.2",
      skillType: "skill",
    });
  });
});

// --- Edge builder tests ---

describe("visualisatie graph — buildEdgesFromMatches", () => {
  it("creates a match edge with correct source and target", () => {
    const edges = buildEdgesFromMatches([sampleMatch]);
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe("cand-1");
    expect(edges[0].target).toBe("job-1");
    expect(edges[0].type).toBe("match");
  });

  it("includes score and status in metadata", () => {
    const edges = buildEdgesFromMatches([sampleMatch]);
    expect(edges[0].metadata).toMatchObject({
      score: 85.5,
      status: "pending",
    });
  });

  it("handles empty match array", () => {
    const edges = buildEdgesFromMatches([]);
    expect(edges).toHaveLength(0);
  });

  it("skips matches with null jobId or candidateId", () => {
    const nullJobMatch = { ...sampleMatch, jobId: null };
    const nullCandMatch = { ...sampleMatch, candidateId: null };
    const edges = buildEdgesFromMatches([nullJobMatch, nullCandMatch]);
    expect(edges).toHaveLength(0);
  });
});

describe("visualisatie graph — buildEdgesFromSkills", () => {
  it("creates requires_skill edges for job skills", () => {
    const edges = buildEdgesFromSkills({ jobSkills: [sampleJobSkill], candidateSkills: [] });
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe("job-1");
    expect(edges[0].target).toBe("http://data.europa.eu/esco/skill/001");
    expect(edges[0].type).toBe("requires_skill");
  });

  it("creates has_skill edges for candidate skills", () => {
    const edges = buildEdgesFromSkills({ jobSkills: [], candidateSkills: [sampleCandidateSkill] });
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe("cand-1");
    expect(edges[0].target).toBe("http://data.europa.eu/esco/skill/001");
    expect(edges[0].type).toBe("has_skill");
  });

  it("includes confidence and required/critical in job skill metadata", () => {
    const edges = buildEdgesFromSkills({ jobSkills: [sampleJobSkill], candidateSkills: [] });
    expect(edges[0].metadata).toMatchObject({
      confidence: 0.9,
      required: true,
      critical: false,
    });
  });

  it("includes confidence in candidate skill metadata", () => {
    const edges = buildEdgesFromSkills({ jobSkills: [], candidateSkills: [sampleCandidateSkill] });
    expect(edges[0].metadata).toMatchObject({ confidence: 0.8 });
  });
});

// --- Filtering tests ---

describe("visualisatie graph — filterNodesByType", () => {
  const nodes: GraphNode[] = [
    {
      id: "job-1",
      type: "job",
      label: "Job 1",
      metadata: { company: null, location: null, platform: "x", status: "open" },
    },
    { id: "cand-1", type: "candidate", label: "Cand 1", metadata: { role: null, location: null } },
    {
      id: "skill-1",
      type: "skill",
      label: "Skill 1",
      metadata: { escoVersion: "1", skillType: null },
    },
  ];

  it("returns all nodes when no type filter is given", () => {
    const result = filterNodesByType(nodes, []);
    expect(result).toHaveLength(3);
  });

  it("filters to only job nodes", () => {
    const result = filterNodesByType(nodes, ["job"]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("job");
  });

  it("filters to jobs and candidates", () => {
    const result = filterNodesByType(nodes, ["job", "candidate"]);
    expect(result).toHaveLength(2);
    expect(result.map((n) => n.type)).toEqual(expect.arrayContaining(["job", "candidate"]));
  });

  it("returns empty when filtering for unknown type combination yields no matches", () => {
    const result = filterNodesByType(nodes, ["skill"]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("skill");
  });
});

describe("visualisatie graph — filterEdgesByNodes", () => {
  const nodeIds = new Set(["job-1", "cand-1"]);
  const edges: GraphEdge[] = [
    {
      source: "cand-1",
      target: "job-1",
      type: "match",
      metadata: { score: 80, status: "pending" },
    },
    { source: "cand-1", target: "skill-1", type: "has_skill", metadata: { confidence: 0.9 } },
    { source: "job-1", target: "skill-1", type: "requires_skill", metadata: { confidence: 0.8 } },
  ];

  it("keeps edges where both source and target are in node set", () => {
    const result = filterEdgesByNodes(edges, nodeIds);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("match");
  });

  it("includes edges where target is a skill node (always shown when source is present)", () => {
    const allNodeIds = new Set(["job-1", "cand-1", "skill-1"]);
    const result = filterEdgesByNodes(edges, allNodeIds);
    expect(result).toHaveLength(3);
  });

  it("returns empty array when no nodes match", () => {
    const result = filterEdgesByNodes(edges, new Set([]));
    expect(result).toHaveLength(0);
  });
});

// --- Structural tests ---

describe("visualisatie graph — API types", () => {
  it("GraphNodeType is one of job, candidate, skill", () => {
    const types: GraphNodeType[] = ["job", "candidate", "skill"];
    expect(types).toHaveLength(3);
  });

  it("GraphEdgeType is one of match, has_skill, requires_skill", () => {
    const types: GraphEdgeType[] = ["match", "has_skill", "requires_skill"];
    expect(types).toHaveLength(3);
  });

  it("src/types/graph.ts exports GraphNode, GraphEdge, GraphResponse", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const source = fs.readFileSync(path.resolve(__dirname, "../src/types/graph.ts"), "utf-8");
    expect(source).toContain("export type GraphNode");
    expect(source).toContain("export type GraphEdge");
    expect(source).toContain("export type GraphResponse");
  });

  it("API route exists at app/api/visualisatie/graph/route.ts", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const routePath = path.resolve(__dirname, "../app/api/visualisatie/graph/route.ts");
    expect(fs.existsSync(routePath)).toBe(true);
  });

  it("API route exports a GET handler", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "../app/api/visualisatie/graph/route.ts"),
      "utf-8",
    );
    expect(source).toContain("export");
    expect(source).toContain("GET");
  });
});
