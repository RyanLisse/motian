/**
 * Shared TypeScript types for the 3D graph visualization feature.
 * Used by both the API endpoint and frontend components.
 */

// Node types in the graph
export type GraphNodeType = "job" | "candidate" | "skill";

// Edge types in the graph
export type GraphEdgeType = "match" | "has_skill" | "requires_skill";

// Metadata for job nodes
export type JobNodeMetadata = {
  company: string | null;
  location: string | null;
  platform: string;
  status: string;
};

// Metadata for candidate nodes
export type CandidateNodeMetadata = {
  role: string | null;
  location: string | null;
};

// Metadata for skill nodes
export type SkillNodeMetadata = {
  escoVersion: string;
  skillType: string | null;
};

// Metadata for match edges
export type MatchEdgeMetadata = {
  score: number;
  status: string;
};

// Metadata for skill edges
export type SkillEdgeMetadata = {
  confidence: number | null;
  required?: boolean;
  critical?: boolean;
};

// A node in the graph
export type GraphNode = {
  id: string;
  type: GraphNodeType;
  label: string;
  metadata: JobNodeMetadata | CandidateNodeMetadata | SkillNodeMetadata;
};

// An edge in the graph
export type GraphEdge = {
  source: string;
  target: string;
  type: GraphEdgeType;
  metadata: MatchEdgeMetadata | SkillEdgeMetadata;
};

// Full API response type
export type GraphResponse = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  hasMore: boolean;
};

// Query parameters for the graph endpoint
export type GraphQueryParams = {
  types?: GraphNodeType[];
  limit?: number;
};
