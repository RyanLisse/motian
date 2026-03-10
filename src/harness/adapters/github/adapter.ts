import { GitHubApiClient } from "./client";
import {
  mapIssueComment,
  mapPageInfo,
  mapProjectItemNode,
  mapProjectNode,
  type RawProjectFieldNode,
  type RawProjectItemNode,
  type RawRestIssueComment,
} from "./mappers";
import { formatGitHubHarnessRunComment } from "./publication";
import {
  ADD_ISSUE_TO_PROJECT_MUTATION,
  CLEAR_PROJECT_ITEM_FIELD_MUTATION,
  READ_CANDIDATE_ITEMS_QUERY,
  READ_PROJECT_ITEM_QUERY,
  READ_REPOSITORY_ISSUE_QUERY,
  UPDATE_PROJECT_ITEM_FIELD_MUTATION,
} from "./queries";
import type {
  GitHubCandidateItemsPageDto,
  GitHubHarnessRunCommentUpsertInput,
  GitHubIssueCommentCreateInput,
  GitHubIssueCommentDto,
  GitHubIssueCommentUpdateInput,
  GitHubIssueCommentUpsertInput,
  GitHubProjectFieldUpdateValue,
  GitHubProjectIssueLinkInput,
  GitHubProjectItemDto,
  GitHubProjectItemFieldUpdateInput,
  GitHubProjectItemStatusUpdateInput,
  GitHubProjectsAdapter,
  GitHubProjectsAdapterConfig,
  GitHubReadCandidateItemsInput,
} from "./types";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const COMMENT_PAGE_SIZE = 100;

interface ReadCandidateItemsResponse {
  node: {
    closed: boolean;
    fields: { nodes: Array<RawProjectFieldNode | null> };
    id: string;
    items: {
      nodes: Array<RawProjectItemNode | null>;
      pageInfo: {
        endCursor: string | null;
        hasNextPage: boolean;
      };
    };
    title: string;
    url: string;
  } | null;
}

interface ReadProjectItemResponse {
  node: RawProjectItemNode | null;
}

interface ReadRepositoryIssueResponse {
  repository: {
    issue: RawProjectItemNode["content"];
  } | null;
}

interface AddIssueToProjectResponse {
  addProjectV2ItemById: {
    item: {
      id: string;
    } | null;
  };
}

interface UpdateProjectFieldResponse {
  clearProjectV2ItemFieldValue?: {
    projectV2Item: {
      id: string;
    } | null;
  };
  updateProjectV2ItemFieldValue?: {
    projectV2Item: {
      id: string;
    } | null;
  };
}

function clampPageSize(value?: number): number {
  if (!value || Number.isNaN(value)) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.max(1, Math.min(MAX_PAGE_SIZE, Math.trunc(value)));
}

export function serializeProjectFieldValue(
  value: GitHubProjectFieldUpdateValue,
): Record<string, string | number> {
  switch (value.kind) {
    case "date":
      return { date: value.date };
    case "iteration":
      return { iterationId: value.iterationId };
    case "number":
      return { number: value.number };
    case "single_select":
      return { singleSelectOptionId: value.optionId };
    case "text":
      return { text: value.text };
    case "clear":
      throw new Error(
        "Clear updates use clearProjectV2ItemFieldValue and do not serialize a value payload.",
      );
  }
}

export class GitHubProjectsAdapterImpl implements GitHubProjectsAdapter {
  private readonly client: GitHubApiClient;
  private readonly config: GitHubProjectsAdapterConfig;

  constructor(config: GitHubProjectsAdapterConfig) {
    this.config = config;
    this.client = new GitHubApiClient(config);
  }

  async createIssueComment(input: GitHubIssueCommentCreateInput): Promise<GitHubIssueCommentDto> {
    const comment = await this.client.rest<RawRestIssueComment>(
      `/repos/${this.config.owner}/${this.config.repo}/issues/${input.issueNumber}/comments`,
      {
        body: JSON.stringify({ body: input.body }),
        method: "POST",
      },
    );

    return mapIssueComment(comment);
  }

  async getProjectItem(itemId: string): Promise<GitHubProjectItemDto | null> {
    const response = await this.client.graphql<ReadProjectItemResponse>(READ_PROJECT_ITEM_QUERY, {
      itemId,
    });
    return response.node ? mapProjectItemNode(response.node) : null;
  }

  async linkIssueToProject(input: GitHubProjectIssueLinkInput): Promise<GitHubProjectItemDto> {
    const issue = await this.readRepositoryIssue(input.issueNumber);
    const issueId = issue.id;

    if (!issueId) {
      throw new Error(
        `GitHub issue #${input.issueNumber} in ${this.config.owner}/${this.config.repo} could not be resolved to a node id, so it cannot be linked to project ${this.config.projectId}.`,
      );
    }

    const existingItem = await this.findProjectItemByIssueId(issueId);

    if (existingItem) {
      return existingItem;
    }

    const response = await this.client.graphql<AddIssueToProjectResponse>(
      ADD_ISSUE_TO_PROJECT_MUTATION,
      {
        contentId: issueId,
        projectId: this.config.projectId,
      },
    );

    const itemId = response.addProjectV2ItemById.item?.id;
    if (!itemId) {
      throw new Error(
        `GitHub did not return a project item id when linking issue #${input.issueNumber}.`,
      );
    }

    return this.readRequiredProjectItem(itemId);
  }

  async readCandidateItems(
    input: GitHubReadCandidateItemsInput = {},
  ): Promise<GitHubCandidateItemsPageDto> {
    const response = await this.client.graphql<ReadCandidateItemsResponse>(
      READ_CANDIDATE_ITEMS_QUERY,
      {
        after: input.after ?? null,
        first: clampPageSize(input.first),
        projectId: this.config.projectId,
      },
    );

    if (!response.node) {
      throw new Error(`GitHub project ${this.config.projectId} was not found.`);
    }

    const project = mapProjectNode(response.node);
    const items = response.node.items.nodes
      .flatMap((item) => (item ? [mapProjectItemNode(item)] : []))
      .filter((item) => input.includeArchived || !item.isArchived);

    return {
      items,
      pageInfo: mapPageInfo(response.node.items.pageInfo),
      project,
    };
  }

  async updateIssueComment(input: GitHubIssueCommentUpdateInput): Promise<GitHubIssueCommentDto> {
    const comment = await this.client.rest<RawRestIssueComment>(
      `/repos/${this.config.owner}/${this.config.repo}/issues/comments/${input.commentId}`,
      {
        body: JSON.stringify({ body: input.body }),
        method: "PATCH",
      },
    );

    return mapIssueComment(comment);
  }

  async updateProjectItemField(
    input: GitHubProjectItemFieldUpdateInput,
  ): Promise<GitHubProjectItemDto> {
    if (input.value.kind === "clear") {
      await this.client.graphql<UpdateProjectFieldResponse>(CLEAR_PROJECT_ITEM_FIELD_MUTATION, {
        fieldId: input.fieldId,
        itemId: input.itemId,
        projectId: this.config.projectId,
      });
    } else {
      await this.client.graphql<UpdateProjectFieldResponse>(UPDATE_PROJECT_ITEM_FIELD_MUTATION, {
        fieldId: input.fieldId,
        itemId: input.itemId,
        projectId: this.config.projectId,
        value: serializeProjectFieldValue(input.value),
      });
    }

    return this.readRequiredProjectItem(input.itemId);
  }

  async updateProjectItemStatus(
    input: GitHubProjectItemStatusUpdateInput,
  ): Promise<GitHubProjectItemDto> {
    return this.updateProjectItemField({
      fieldId: input.statusFieldId,
      itemId: input.itemId,
      value: { kind: "single_select", optionId: input.optionId },
    });
  }

  async upsertHarnessRunComment(
    input: GitHubHarnessRunCommentUpsertInput,
  ): Promise<GitHubIssueCommentDto> {
    return this.upsertIssueComment({
      body: formatGitHubHarnessRunComment(input),
      issueNumber: input.issueNumber,
      marker: input.marker,
    });
  }

  async upsertIssueComment(input: GitHubIssueCommentUpsertInput): Promise<GitHubIssueCommentDto> {
    const existingComment = await this.findIssueCommentByMarker(input.issueNumber, input.marker);

    if (existingComment) {
      return this.updateIssueComment({
        body: input.body,
        commentId: existingComment.id,
      });
    }

    return this.createIssueComment({
      body: input.body,
      issueNumber: input.issueNumber,
    });
  }

  private async findIssueCommentByMarker(
    issueNumber: number,
    marker: string,
  ): Promise<GitHubIssueCommentDto | null> {
    let page = 1;
    let lastMatch: GitHubIssueCommentDto | null = null;

    while (true) {
      const comments = await this.client.rest<RawRestIssueComment[]>(
        `/repos/${this.config.owner}/${this.config.repo}/issues/${issueNumber}/comments?per_page=${COMMENT_PAGE_SIZE}&page=${page}`,
      );

      if (comments.length === 0) {
        return lastMatch;
      }

      for (const comment of comments) {
        if (comment.body.includes(marker)) {
          lastMatch = mapIssueComment(comment);
        }
      }

      if (comments.length < COMMENT_PAGE_SIZE) {
        return lastMatch;
      }

      page += 1;
    }
  }

  private async findProjectItemByIssueId(issueId: string): Promise<GitHubProjectItemDto | null> {
    if (!issueId) {
      return null;
    }

    let after: string | null = null;

    while (true) {
      const page = await this.readCandidateItems({
        after,
        first: MAX_PAGE_SIZE,
        includeArchived: true,
      });
      const match = page.items.find(
        (item) => item.content?.type === "issue" && item.content.id === issueId,
      );

      if (match) {
        return match;
      }

      if (!page.pageInfo.hasNextPage) {
        return null;
      }

      after = page.pageInfo.endCursor;
    }
  }

  private async readRepositoryIssue(
    issueNumber: number,
  ): Promise<NonNullable<RawProjectItemNode["content"]>> {
    const response = await this.client.graphql<ReadRepositoryIssueResponse>(
      READ_REPOSITORY_ISSUE_QUERY,
      {
        issueNumber,
        owner: this.config.owner,
        repo: this.config.repo,
      },
    );

    const issue = response.repository?.issue;

    if (!issue?.id) {
      throw new Error(
        `GitHub issue #${issueNumber} was not found in ${this.config.owner}/${this.config.repo}.`,
      );
    }

    return issue;
  }

  private async readRequiredProjectItem(itemId: string): Promise<GitHubProjectItemDto> {
    const item = await this.getProjectItem(itemId);

    if (!item) {
      throw new Error(`GitHub project item ${itemId} was not found.`);
    }

    return item;
  }
}

export function createGitHubProjectsAdapter(
  config: GitHubProjectsAdapterConfig,
): GitHubProjectsAdapter {
  return new GitHubProjectsAdapterImpl(config);
}
