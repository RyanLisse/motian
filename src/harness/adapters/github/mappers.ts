import type {
  GitHubIssueCommentDto,
  GitHubPageInfoDto,
  GitHubProjectDto,
  GitHubProjectFieldDto,
  GitHubProjectFieldSelector,
  GitHubProjectFieldValueDto,
  GitHubProjectItemContentDto,
  GitHubProjectItemDto,
} from "./types";

interface RawFieldCommon {
  dataType?: string | null;
  id?: string | null;
  name?: string | null;
}

export interface RawProjectFieldNode extends RawFieldCommon {
  __typename: string;
  configuration?: {
    iterations?: Array<{
      duration: number;
      id: string;
      startDate: string;
      title: string;
    } | null> | null;
  } | null;
  options?: Array<{
    color?: string | null;
    description?: string | null;
    id: string;
    name: string;
  } | null> | null;
}

export interface RawProjectFieldValueNode {
  __typename: string;
  date?: string | null;
  duration?: number | null;
  field?: RawFieldCommon | null;
  iterationId?: string | null;
  name?: string | null;
  number?: number | null;
  optionId?: string | null;
  startDate?: string | null;
  text?: string | null;
  title?: string | null;
}

interface RawRepositoryRef {
  name: string;
  owner: {
    login: string;
  };
}

interface RawIssueLikeContent {
  body?: string | null;
  id?: string | null;
  number?: number | null;
  repository?: RawRepositoryRef | null;
  state?: string | null;
  title?: string | null;
  url?: string | null;
}

export interface RawProjectItemNode {
  content?:
    | ({ __typename: string } & RawIssueLikeContent & {
          assignees?: { nodes?: Array<{ login: string } | null> | null } | null;
          labels?: { nodes?: Array<{ name: string } | null> | null } | null;
        })
    | null;
  createdAt: string;
  databaseId?: number | null;
  fieldValues?: { nodes?: Array<RawProjectFieldValueNode | null> | null } | null;
  id: string;
  isArchived: boolean;
  type: string;
  updatedAt: string;
}

export interface RawRestIssueComment {
  body: string;
  created_at: string;
  html_url: string;
  id: number;
  node_id: string;
  updated_at: string;
  user?: {
    login?: string | null;
  } | null;
}

function normalizeFieldDataType(dataType?: string | null): GitHubProjectFieldDto["dataType"] {
  switch (dataType) {
    case "DATE":
    case "ITERATION":
    case "NUMBER":
    case "SINGLE_SELECT":
    case "TEXT":
      return dataType;
    default:
      return "UNKNOWN";
  }
}

function mapProjectItemContent(
  content: RawProjectItemNode["content"],
): GitHubProjectItemContentDto | null {
  if (!content) {
    return null;
  }

  switch (content.__typename) {
    case "DraftIssue":
      return {
        body: content.body ?? null,
        id: content.id ?? "",
        title: content.title ?? "",
        type: "draft_issue",
      };
    case "Issue":
      return {
        assignees:
          content.assignees?.nodes?.flatMap((node) => (node?.login ? [node.login] : [])) ?? [],
        body: content.body ?? null,
        id: content.id ?? "",
        labels: content.labels?.nodes?.flatMap((node) => (node?.name ? [node.name] : [])) ?? [],
        number: content.number ?? 0,
        repositoryName: content.repository?.name ?? "",
        repositoryOwner: content.repository?.owner.login ?? "",
        state: content.state ?? "UNKNOWN",
        title: content.title ?? "",
        type: "issue",
        url: content.url ?? "",
      };
    case "PullRequest":
      return {
        body: content.body ?? null,
        id: content.id ?? "",
        number: content.number ?? 0,
        repositoryName: content.repository?.name ?? "",
        repositoryOwner: content.repository?.owner.login ?? "",
        state: content.state ?? "UNKNOWN",
        title: content.title ?? "",
        type: "pull_request",
        url: content.url ?? "",
      };
    default:
      return {
        id: content.id ?? null,
        type: "unknown",
      };
  }
}

export function mapProjectFieldNode(
  node: RawProjectFieldNode | null | undefined,
): GitHubProjectFieldDto | null {
  if (!node?.id || !node.name) {
    return null;
  }

  return {
    dataType: normalizeFieldDataType(node.dataType),
    id: node.id,
    iterations:
      node.configuration?.iterations?.flatMap((iteration) =>
        iteration
          ? [
              {
                duration: iteration.duration,
                id: iteration.id,
                startDate: iteration.startDate,
                title: iteration.title,
              },
            ]
          : [],
      ) ?? [],
    name: node.name,
    options:
      node.options?.flatMap((option) =>
        option
          ? [
              {
                color: option.color ?? null,
                description: option.description ?? null,
                id: option.id,
                name: option.name,
              },
            ]
          : [],
      ) ?? [],
  };
}

export function mapProjectFieldValueNode(
  node: RawProjectFieldValueNode | null | undefined,
): GitHubProjectFieldValueDto | null {
  if (!node) {
    return null;
  }

  const fieldId = node.field?.id ?? null;
  const fieldName = node.field?.name ?? null;

  switch (node.__typename) {
    case "ProjectV2ItemFieldDateValue":
      return fieldId && fieldName
        ? { fieldId, fieldName, kind: "date", value: node.date ?? null }
        : null;
    case "ProjectV2ItemFieldIterationValue":
      return fieldId && fieldName
        ? {
            fieldId,
            fieldName,
            iterationId: node.iterationId ?? null,
            kind: "iteration",
            startDate: node.startDate ?? null,
            title: node.title ?? null,
            value: node.title ?? null,
          }
        : null;
    case "ProjectV2ItemFieldNumberValue":
      return fieldId && fieldName
        ? { fieldId, fieldName, kind: "number", value: node.number ?? null }
        : null;
    case "ProjectV2ItemFieldSingleSelectValue":
      return fieldId && fieldName
        ? {
            fieldId,
            fieldName,
            kind: "single_select",
            optionId: node.optionId ?? null,
            optionName: node.name ?? null,
            value: node.name ?? null,
          }
        : null;
    case "ProjectV2ItemFieldTextValue":
      return fieldId && fieldName
        ? { fieldId, fieldName, kind: "text", value: node.text ?? null }
        : null;
    default:
      return {
        fieldId,
        fieldName,
        kind: "unknown",
        typename: node.__typename,
        value: null,
      };
  }
}

export function mapProjectItemNode(node: RawProjectItemNode): GitHubProjectItemDto {
  return {
    content: mapProjectItemContent(node.content ?? null),
    createdAt: node.createdAt,
    databaseId: node.databaseId ?? null,
    fieldValues:
      node.fieldValues?.nodes?.flatMap((fieldValue) => {
        const mapped = mapProjectFieldValueNode(fieldValue);
        return mapped ? [mapped] : [];
      }) ?? [],
    id: node.id,
    isArchived: node.isArchived,
    type: node.type,
    updatedAt: node.updatedAt,
  };
}

export function mapProjectNode(node: {
  closed: boolean;
  fields?: { nodes?: Array<RawProjectFieldNode | null> | null } | null;
  id: string;
  title: string;
  url: string;
}): GitHubProjectDto {
  return {
    closed: node.closed,
    fields:
      node.fields?.nodes?.flatMap((field) => {
        const mapped = mapProjectFieldNode(field);
        return mapped ? [mapped] : [];
      }) ?? [],
    id: node.id,
    title: node.title,
    url: node.url,
  };
}

export function mapPageInfo(pageInfo: {
  endCursor?: string | null;
  hasNextPage: boolean;
}): GitHubPageInfoDto {
  return {
    endCursor: pageInfo.endCursor ?? null,
    hasNextPage: pageInfo.hasNextPage,
  };
}

export function mapIssueComment(comment: RawRestIssueComment): GitHubIssueCommentDto {
  return {
    authorLogin: comment.user?.login ?? null,
    body: comment.body,
    createdAt: comment.created_at,
    id: comment.id,
    nodeId: comment.node_id,
    updatedAt: comment.updated_at,
    url: comment.html_url,
  };
}

export function findProjectField(
  fields: GitHubProjectFieldDto[],
  selector: GitHubProjectFieldSelector,
): GitHubProjectFieldDto | null {
  if (selector.fieldId) {
    return fields.find((field) => field.id === selector.fieldId) ?? null;
  }

  if (selector.fieldName) {
    const normalizedName = selector.fieldName.trim().toLowerCase();
    return fields.find((field) => field.name.trim().toLowerCase() === normalizedName) ?? null;
  }

  return null;
}

export function mapProjectItemState(
  item: GitHubProjectItemDto,
  selector: GitHubProjectFieldSelector,
): GitHubProjectFieldValueDto | null {
  if (selector.fieldId) {
    return item.fieldValues.find((fieldValue) => fieldValue.fieldId === selector.fieldId) ?? null;
  }

  if (selector.fieldName) {
    const normalizedName = selector.fieldName.trim().toLowerCase();
    return (
      item.fieldValues.find(
        (fieldValue) => fieldValue.fieldName.trim().toLowerCase() === normalizedName,
      ) ?? null
    );
  }

  return null;
}
