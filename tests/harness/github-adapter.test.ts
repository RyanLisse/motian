import { describe, expect, it } from "vitest";
import {
  findProjectField,
  formatGitHubHarnessRunComment,
  mapIssueComment,
  mapProjectFieldNode,
  mapProjectItemNode,
  mapProjectItemState,
  serializeProjectFieldValue,
} from "@/src/harness/adapters/github";

describe("GitHub harness adapter mapping", () => {
  it("maps project fields and item state into orchestrator-friendly DTOs", () => {
    const statusField = mapProjectFieldNode({
      __typename: "ProjectV2SingleSelectField",
      dataType: "SINGLE_SELECT",
      id: "PVTSSF_status",
      name: "Status",
      options: [
        {
          color: "BLUE",
          description: "Work is active",
          id: "opt_in_progress",
          name: "In Progress",
        },
      ],
    });

    expect(statusField).not.toBeNull();

    expect(statusField).toEqual({
      dataType: "SINGLE_SELECT",
      id: "PVTSSF_status",
      iterations: [],
      name: "Status",
      options: [
        {
          color: "BLUE",
          description: "Work is active",
          id: "opt_in_progress",
          name: "In Progress",
        },
      ],
    });

    const item = mapProjectItemNode({
      content: {
        __typename: "Issue",
        assignees: { nodes: [{ login: "agent-1" }] },
        body: "Task details",
        id: "I_kwDOExampleIssue",
        labels: { nodes: [{ name: "orchestrator" }] },
        number: 42,
        repository: {
          name: "motian",
          owner: { login: "RyanLisse" },
        },
        state: "OPEN",
        title: "Ship harness adapter",
        url: "https://github.com/RyanLisse/motian/issues/42",
      },
      createdAt: "2026-03-10T12:00:00Z",
      databaseId: 501,
      fieldValues: {
        nodes: [
          {
            __typename: "ProjectV2ItemFieldSingleSelectValue",
            field: { dataType: "SINGLE_SELECT", id: "PVTSSF_status", name: "Status" },
            name: "In Progress",
            optionId: "opt_in_progress",
          },
          {
            __typename: "ProjectV2ItemFieldTextValue",
            field: { dataType: "TEXT", id: "PVTFT_owner", name: "Owner" },
            text: "orchestrator",
          },
        ],
      },
      id: "PVTI_lAHOA",
      isArchived: false,
      type: "ISSUE",
      updatedAt: "2026-03-10T12:30:00Z",
    });

    expect(item.content).toEqual({
      assignees: ["agent-1"],
      body: "Task details",
      id: "I_kwDOExampleIssue",
      labels: ["orchestrator"],
      number: 42,
      repositoryName: "motian",
      repositoryOwner: "RyanLisse",
      state: "OPEN",
      title: "Ship harness adapter",
      type: "issue",
      url: "https://github.com/RyanLisse/motian/issues/42",
    });

    expect(mapProjectItemState(item, { fieldName: "status" })).toEqual({
      fieldId: "PVTSSF_status",
      fieldName: "Status",
      kind: "single_select",
      optionId: "opt_in_progress",
      optionName: "In Progress",
      value: "In Progress",
    });

    expect(
      findProjectField(statusField ? [statusField] : [], { fieldId: "PVTSSF_status" }),
    ).toEqual(statusField);
  });
});

describe("GitHub harness adapter serialization", () => {
  it("serializes GraphQL field updates without policy logic", () => {
    expect(serializeProjectFieldValue({ kind: "single_select", optionId: "opt_done" })).toEqual({
      singleSelectOptionId: "opt_done",
    });
    expect(serializeProjectFieldValue({ kind: "text", text: "queued by orchestrator" })).toEqual({
      text: "queued by orchestrator",
    });
    expect(serializeProjectFieldValue({ kind: "number", number: 3 })).toEqual({ number: 3 });
    expect(serializeProjectFieldValue({ date: "2026-03-10", kind: "date" })).toEqual({
      date: "2026-03-10",
    });
    expect(serializeProjectFieldValue({ iterationId: "iteration_123", kind: "iteration" })).toEqual(
      {
        iterationId: "iteration_123",
      },
    );
    expect(() => serializeProjectFieldValue({ kind: "clear" })).toThrow(
      /clearProjectV2ItemFieldValue/,
    );
  });

  it("maps issue comments from the REST surface", () => {
    expect(
      mapIssueComment({
        body: "<!-- orchestrator:sync -->\nUpdated state",
        created_at: "2026-03-10T12:00:00Z",
        html_url: "https://github.com/RyanLisse/motian/issues/42#issuecomment-1",
        id: 1,
        node_id: "IC_kwDOExample",
        updated_at: "2026-03-10T12:05:00Z",
        user: { login: "motian-bot" },
      }),
    ).toEqual({
      authorLogin: "motian-bot",
      body: "<!-- orchestrator:sync -->\nUpdated state",
      createdAt: "2026-03-10T12:00:00Z",
      id: 1,
      nodeId: "IC_kwDOExample",
      updatedAt: "2026-03-10T12:05:00Z",
      url: "https://github.com/RyanLisse/motian/issues/42#issuecomment-1",
    });
  });

  it("formats manifest-backed run publication comments from harness concepts", () => {
    const comment = formatGitHubHarnessRunComment({
      includeExternalContext: true,
      includeNormalizedResult: true,
      marker: "<!-- orchestrator:run-status -->",
      run: {
        artifacts: [
          {
            description: "Run lifecycle and execution manifest",
            kind: "manifest",
            path: "/tmp/manifest.json",
            relativePath: ".harness/runs/run-123/manifest.json",
            url: "https://example.com/artifacts/manifest.json",
          },
          {
            description: "Captured process stdout",
            kind: "stdout",
            path: "/tmp/stdout.log",
            relativePath: ".harness/runs/run-123/logs/stdout.log",
          },
        ],
        createdAt: "2026-03-10T12:00:00Z",
        dispatch: "harness:smoke",
        externalContext: {
          issueNumber: 42,
          projectItemId: "PVTI_123",
        },
        finishedAt: "2026-03-10T12:02:00Z",
        manifestPath: ".harness/runs/run-123/manifest.json",
        manifestUrl: "https://example.com/artifacts/manifest.json",
        normalizedResult: {
          summary: "3 tests passed",
        },
        result: {
          commandLine: "pnpm harness:smoke",
          durationMs: 120000,
          exitCode: 0,
          finishedAt: "2026-03-10T12:02:00Z",
          outcome: "succeeded",
          startedAt: "2026-03-10T12:00:00Z",
          stderrPath: ".harness/runs/run-123/logs/stderr.log",
          stderrTail: "",
          stdoutPath: ".harness/runs/run-123/logs/stdout.log",
          stdoutTail: "all green",
          timedOut: false,
        },
        resumeToken: "run-123",
        runId: "run-123",
        startedAt: "2026-03-10T12:00:00Z",
        status: "succeeded",
        updatedAt: "2026-03-10T12:02:00Z",
      },
      summary: "Automated harness execution completed.",
      title: "Harness Run Status",
    });

    expect(comment).toContain("<!-- orchestrator:run-status -->");
    expect(comment).toContain("| Run ID | `run-123` |");
    expect(comment).toContain("| Status | `succeeded` |");
    expect(comment).toContain("| Manifest | [link](https://example.com/artifacts/manifest.json) |");
    expect(comment).toContain(
      "- [manifest](https://example.com/artifacts/manifest.json) — Run lifecycle and execution manifest",
    );
    expect(comment).toContain(
      "- `.harness/runs/run-123/logs/stdout.log` — Captured process stdout",
    );
    expect(comment).toContain("### Normalized Result");
    expect(comment).toContain('"summary": "3 tests passed"');
    expect(comment).toContain("- issueNumber: `42`");
    expect(comment).toContain("- projectItemId: `PVTI_123`");
  });
});
