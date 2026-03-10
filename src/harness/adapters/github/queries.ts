export const PROJECT_FIELDS_FRAGMENT = `
fragment ProjectFieldNode on ProjectV2FieldConfiguration {
  __typename
  ... on ProjectV2FieldCommon {
    id
    name
    dataType
  }
  ... on ProjectV2SingleSelectField {
    options {
      id
      name
      color
      description
    }
  }
  ... on ProjectV2IterationField {
    configuration {
      iterations {
        id
        title
        startDate
        duration
      }
    }
  }
}`;

export const PROJECT_ITEM_FIELD_VALUES_FRAGMENT = `
fragment ProjectItemFieldValueNode on ProjectV2ItemFieldValue {
  __typename
  ... on ProjectV2ItemFieldTextValue {
    text
    field {
      ... on ProjectV2FieldCommon {
        id
        name
        dataType
      }
    }
  }
  ... on ProjectV2ItemFieldNumberValue {
    number
    field {
      ... on ProjectV2FieldCommon {
        id
        name
        dataType
      }
    }
  }
  ... on ProjectV2ItemFieldDateValue {
    date
    field {
      ... on ProjectV2FieldCommon {
        id
        name
        dataType
      }
    }
  }
  ... on ProjectV2ItemFieldSingleSelectValue {
    optionId
    name
    field {
      ... on ProjectV2FieldCommon {
        id
        name
        dataType
      }
    }
  }
  ... on ProjectV2ItemFieldIterationValue {
    iterationId
    title
    startDate
    duration
    field {
      ... on ProjectV2FieldCommon {
        id
        name
        dataType
      }
    }
  }
}`;

export const PROJECT_ITEM_FRAGMENT = `
fragment ProjectItemNode on ProjectV2Item {
  id
  databaseId
  isArchived
  type
  createdAt
  updatedAt
  fieldValues(first: 50) {
    nodes {
      ...ProjectItemFieldValueNode
    }
  }
  content {
    __typename
    ... on DraftIssue {
      id
      title
      body
    }
    ... on Issue {
      id
      number
      title
      url
      state
      body
      repository {
        name
        owner {
          login
        }
      }
      assignees(first: 10) {
        nodes {
          login
        }
      }
      labels(first: 20) {
        nodes {
          name
        }
      }
    }
    ... on PullRequest {
      id
      number
      title
      url
      state
      body
      repository {
        name
        owner {
          login
        }
      }
    }
  }
}`;

export const READ_CANDIDATE_ITEMS_QUERY = `
${PROJECT_FIELDS_FRAGMENT}
${PROJECT_ITEM_FIELD_VALUES_FRAGMENT}
${PROJECT_ITEM_FRAGMENT}
query ReadCandidateItems($projectId: ID!, $first: Int!, $after: String) {
  node(id: $projectId) {
    ... on ProjectV2 {
      id
      title
      url
      closed
      fields(first: 50) {
        nodes {
          ...ProjectFieldNode
        }
      }
      items(first: $first, after: $after) {
        pageInfo {
          endCursor
          hasNextPage
        }
        nodes {
          ...ProjectItemNode
        }
      }
    }
  }
}`;

export const READ_PROJECT_ITEM_QUERY = `
${PROJECT_ITEM_FIELD_VALUES_FRAGMENT}
${PROJECT_ITEM_FRAGMENT}
query ReadProjectItem($itemId: ID!) {
  node(id: $itemId) {
    ... on ProjectV2Item {
      ...ProjectItemNode
    }
  }
}`;

export const READ_REPOSITORY_ISSUE_QUERY = `
query ReadRepositoryIssue($owner: String!, $repo: String!, $issueNumber: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $issueNumber) {
      id
      number
      title
      url
      state
      body
      repository {
        name
        owner {
          login
        }
      }
      assignees(first: 10) {
        nodes {
          login
        }
      }
      labels(first: 20) {
        nodes {
          name
        }
      }
    }
  }
}`;

export const ADD_ISSUE_TO_PROJECT_MUTATION = `
mutation AddIssueToProject($projectId: ID!, $contentId: ID!) {
  addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
    item {
      id
    }
  }
}`;

export const UPDATE_PROJECT_ITEM_FIELD_MUTATION = `
mutation UpdateProjectItemField(
  $projectId: ID!
  $itemId: ID!
  $fieldId: ID!
  $value: ProjectV2FieldValue!
) {
  updateProjectV2ItemFieldValue(
    input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: $value }
  ) {
    projectV2Item {
      id
    }
  }
}`;

export const CLEAR_PROJECT_ITEM_FIELD_MUTATION = `
mutation ClearProjectItemField($projectId: ID!, $itemId: ID!, $fieldId: ID!) {
  clearProjectV2ItemFieldValue(
    input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId }
  ) {
    projectV2Item {
      id
    }
  }
}`;
