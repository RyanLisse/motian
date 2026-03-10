import type {
  HarnessArtifact,
  HarnessProcessResult,
  HarnessRunManifest,
  HarnessRunStatus,
} from "@/src/harness/contracts/run";

export type GitHubProjectFieldDataType =
  | "DATE"
  | "ITERATION"
  | "NUMBER"
  | "SINGLE_SELECT"
  | "TEXT"
  | "UNKNOWN";

export interface GitHubPageInfoDto {
  endCursor: string | null;
  hasNextPage: boolean;
}

export interface GitHubProjectFieldOptionDto {
  color: string | null;
  description: string | null;
  id: string;
  name: string;
}

export interface GitHubProjectIterationDto {
  duration: number;
  id: string;
  startDate: string;
  title: string;
}

export interface GitHubProjectFieldDto {
  dataType: GitHubProjectFieldDataType;
  id: string;
  iterations: GitHubProjectIterationDto[];
  name: string;
  options: GitHubProjectFieldOptionDto[];
}

export type GitHubProjectFieldValueDto =
  | {
      fieldId: string;
      fieldName: string;
      kind: "date";
      value: string | null;
    }
  | {
      fieldId: string;
      fieldName: string;
      kind: "iteration";
      iterationId: string | null;
      startDate: string | null;
      title: string | null;
      value: string | null;
    }
  | {
      fieldId: string;
      fieldName: string;
      kind: "number";
      value: number | null;
    }
  | {
      fieldId: string;
      fieldName: string;
      kind: "single_select";
      optionId: string | null;
      optionName: string | null;
      value: string | null;
    }
  | {
      fieldId: string;
      fieldName: string;
      kind: "text";
      value: string | null;
    }
  | {
      fieldId: string | null;
      fieldName: string | null;
      kind: "unknown";
      typename: string;
      value: null;
    };

export interface GitHubProjectFieldSelector {
  fieldId?: string;
  fieldName?: string;
}

export interface GitHubIssueRefDto {
  assignees: string[];
  body: string | null;
  id: string;
  labels: string[];
  number: number;
  repositoryName: string;
  repositoryOwner: string;
  state: string;
  title: string;
  url: string;
}

export interface GitHubDraftIssueRefDto {
  body: string | null;
  id: string;
  title: string;
}

export interface GitHubPullRequestRefDto {
  body: string | null;
  id: string;
  number: number;
  repositoryName: string;
  repositoryOwner: string;
  state: string;
  title: string;
  url: string;
}

export type GitHubProjectItemContentDto =
  | ({ type: "draft_issue" } & GitHubDraftIssueRefDto)
  | ({ type: "issue" } & GitHubIssueRefDto)
  | ({ type: "pull_request" } & GitHubPullRequestRefDto)
  | { id: string | null; type: "unknown" };

export interface GitHubProjectItemDto {
  content: GitHubProjectItemContentDto | null;
  createdAt: string;
  databaseId: number | null;
  fieldValues: GitHubProjectFieldValueDto[];
  id: string;
  isArchived: boolean;
  type: string;
  updatedAt: string;
}

export interface GitHubProjectDto {
  closed: boolean;
  fields: GitHubProjectFieldDto[];
  id: string;
  title: string;
  url: string;
}

export interface GitHubCandidateItemsPageDto {
  items: GitHubProjectItemDto[];
  pageInfo: GitHubPageInfoDto;
  project: GitHubProjectDto;
}

export interface GitHubIssueCommentDto {
  authorLogin: string | null;
  body: string;
  createdAt: string;
  id: number;
  nodeId: string;
  updatedAt: string;
  url: string;
}

export type GitHubHarnessArtifactReference = Pick<
  HarnessArtifact,
  "description" | "kind" | "path" | "relativePath" | "sizeBytes"
> & {
  url?: string;
};

// `signal` and `pid` are intentionally omitted because GitHub comments should not expose
// ephemeral, machine-local process identifiers that are not stable across reruns.
export type GitHubHarnessProcessReference = Pick<
  HarnessProcessResult,
  | "commandLine"
  | "durationMs"
  | "exitCode"
  | "finishedAt"
  | "outcome"
  | "startedAt"
  | "stderrPath"
  | "stderrTail"
  | "stdoutPath"
  | "stdoutTail"
  | "timedOut"
>;

export type GitHubHarnessNormalizedResult =
  | boolean
  | number
  | string
  | null
  | { [key: string]: GitHubHarnessNormalizedResult }
  | GitHubHarnessNormalizedResult[];

export interface GitHubHarnessRunReference {
  artifacts?: GitHubHarnessArtifactReference[];
  createdAt: HarnessRunManifest["createdAt"];
  dispatch: HarnessRunManifest["dispatch"];
  externalContext?: HarnessRunManifest["externalContext"];
  finishedAt?: HarnessRunManifest["finishedAt"];
  manifestPath?: HarnessRunManifest["integration"]["manifestPath"];
  manifestUrl?: string;
  normalizedResult?: GitHubHarnessNormalizedResult;
  result?: GitHubHarnessProcessReference;
  resumeToken?: HarnessRunManifest["integration"]["resumeToken"];
  runId: HarnessRunManifest["runId"];
  startedAt?: HarnessRunManifest["startedAt"];
  status: HarnessRunStatus;
  updatedAt: HarnessRunManifest["updatedAt"];
}

export interface GitHubHarnessRunCommentInput {
  includeExternalContext?: boolean;
  includeNormalizedResult?: boolean;
  marker: string;
  run: GitHubHarnessRunReference;
  summary?: string;
  title?: string;
}

export interface GitHubHarnessRunCommentUpsertInput extends GitHubHarnessRunCommentInput {
  issueNumber: number;
}

export interface GitHubReadCandidateItemsInput {
  after?: string | null;
  first?: number;
  includeArchived?: boolean;
}

export interface GitHubProjectItemStatusUpdateInput {
  itemId: string;
  optionId: string;
  statusFieldId: string;
}

export type GitHubProjectFieldUpdateValue =
  | { kind: "clear" }
  | { date: string; kind: "date" }
  | { iterationId: string; kind: "iteration" }
  | { kind: "number"; number: number }
  | { kind: "single_select"; optionId: string }
  | { kind: "text"; text: string };

export interface GitHubProjectItemFieldUpdateInput {
  fieldId: string;
  itemId: string;
  value: GitHubProjectFieldUpdateValue;
}

export interface GitHubProjectIssueLinkInput {
  issueNumber: number;
}

export interface GitHubIssueCommentCreateInput {
  body: string;
  issueNumber: number;
}

export interface GitHubIssueCommentUpdateInput {
  body: string;
  commentId: number;
}

export interface GitHubIssueCommentUpsertInput {
  body: string;
  issueNumber: number;
  marker: string;
}

export interface GitHubProjectsAdapterConfig {
  apiBaseUrl?: string;
  fetch?: typeof fetch;
  projectId: string;
  repo: string;
  token: string;
  userAgent?: string;
  owner: string;
}

export interface GitHubProjectsAdapter {
  createIssueComment(input: GitHubIssueCommentCreateInput): Promise<GitHubIssueCommentDto>;
  getProjectItem(itemId: string): Promise<GitHubProjectItemDto | null>;
  linkIssueToProject(input: GitHubProjectIssueLinkInput): Promise<GitHubProjectItemDto>;
  readCandidateItems(input?: GitHubReadCandidateItemsInput): Promise<GitHubCandidateItemsPageDto>;
  updateIssueComment(input: GitHubIssueCommentUpdateInput): Promise<GitHubIssueCommentDto>;
  updateProjectItemField(input: GitHubProjectItemFieldUpdateInput): Promise<GitHubProjectItemDto>;
  updateProjectItemStatus(input: GitHubProjectItemStatusUpdateInput): Promise<GitHubProjectItemDto>;
  upsertHarnessRunComment(
    input: GitHubHarnessRunCommentUpsertInput,
  ): Promise<GitHubIssueCommentDto>;
  upsertIssueComment(input: GitHubIssueCommentUpsertInput): Promise<GitHubIssueCommentDto>;
}
