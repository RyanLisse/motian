/**
 * Graph data transformation utilities for the 3D visualization.
 * Pure functions for building nodes and edges from database records.
 */

import type {
  CandidateNodeMetadata,
  GraphEdge,
  GraphEdgeType,
  GraphNode,
  GraphNodeType,
  JobNodeMetadata,
  SkillEdgeMetadata,
  SkillNodeMetadata,
} from "@/src/types/graph";

// --- Raw DB types (minimal shape needed) ---

export type RawJob = {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  platform: string;
  status: string;
};

export type RawCandidate = {
  id: string;
  name: string;
  role: string | null;
  location: string | null;
};

export type RawEscoSkill = {
  uri: string;
  preferredLabelEn: string;
  preferredLabelNl: string | null;
  escoVersion: string;
  skillType: string | null;
};

export type RawMatch = {
  id: string;
  jobId: string | null;
  candidateId: string | null;
  matchScore: number;
  status: string;
};

export type RawJobSkill = {
  id: string;
  jobId: string;
  escoUri: string;
  confidence: number | null;
  required: boolean;
  critical: boolean;
};

export type RawCandidateSkill = {
  id: string;
  candidateId: string;
  escoUri: string;
  confidence: number | null;
};

// --- Node builders ---

export function buildJobNode(job: RawJob): GraphNode {
  return {
    id: job.id,
    type: "job" as GraphNodeType,
    label: job.title,
    metadata: {
      company: job.company,
      location: job.location,
      platform: job.platform,
      status: job.status,
    } satisfies JobNodeMetadata,
  };
}

export function buildCandidateNode(candidate: RawCandidate): GraphNode {
  return {
    id: candidate.id,
    type: "candidate" as GraphNodeType,
    label: candidate.name,
    metadata: {
      role: candidate.role,
      location: candidate.location,
    } satisfies CandidateNodeMetadata,
  };
}

export function buildSkillNode(skill: RawEscoSkill): GraphNode {
  return {
    id: skill.uri,
    type: "skill" as GraphNodeType,
    label: skill.preferredLabelNl ?? skill.preferredLabelEn,
    metadata: {
      escoVersion: skill.escoVersion,
      skillType: skill.skillType,
    } satisfies SkillNodeMetadata,
  };
}

// --- Edge builders ---

export function buildEdgesFromMatches(matches: RawMatch[]): GraphEdge[] {
  const edges: GraphEdge[] = [];
  for (const match of matches) {
    if (!match.jobId || !match.candidateId) continue;
    edges.push({
      source: match.candidateId,
      target: match.jobId,
      type: "match" as GraphEdgeType,
      metadata: {
        score: match.matchScore,
        status: match.status,
      },
    });
  }
  return edges;
}

export function buildEdgesFromSkills({
  jobSkills,
  candidateSkills,
}: {
  jobSkills: RawJobSkill[];
  candidateSkills: RawCandidateSkill[];
}): GraphEdge[] {
  const edges: GraphEdge[] = [];

  for (const js of jobSkills) {
    edges.push({
      source: js.jobId,
      target: js.escoUri,
      type: "requires_skill" as GraphEdgeType,
      metadata: {
        confidence: js.confidence,
        required: js.required,
        critical: js.critical,
      } satisfies SkillEdgeMetadata,
    });
  }

  for (const cs of candidateSkills) {
    edges.push({
      source: cs.candidateId,
      target: cs.escoUri,
      type: "has_skill" as GraphEdgeType,
      metadata: {
        confidence: cs.confidence,
      } satisfies SkillEdgeMetadata,
    });
  }

  return edges;
}

// --- Filtering utilities ---

/**
 * Filter nodes by type. Returns all nodes when types is empty.
 */
export function filterNodesByType(nodes: GraphNode[], types: GraphNodeType[]): GraphNode[] {
  if (types.length === 0) return nodes;
  return nodes.filter((n) => types.includes(n.type));
}

/**
 * Filter edges to only include those where both source and target are in nodeIds.
 */
export function filterEdgesByNodes(edges: GraphEdge[], nodeIds: Set<string>): GraphEdge[] {
  return edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
}
