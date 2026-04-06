import {
  handlers as advancedMatchingHandlers,
  tools as advancedMatchingTools,
} from "./advanced-matching";
import { handlers as analyticsHandlers, tools as analyticsTools } from "./analytics";
import {
  handlers as batchOperationsHandlers,
  tools as batchOperationsTools,
} from "./batch-operations";
import { handlers as channelOfferHandlers, tools as channelOfferTools } from "./channel-offer";
import { handlers as chatSessionsHandlers, tools as chatSessionsTools } from "./chat-sessions";
import * as githubTools from "./github";
import { handlers as cvOpsHandlers, tools as cvOpsTools } from "./cv-operations";
import { handlers as escoSkillsHandlers, tools as escoSkillsTools } from "./esco-skills";
import { handlers as gdprOpsHandlers, tools as gdprOpsTools } from "./gdpr-ops";
import { handlers as instellingenHandlers, tools as instellingenTools } from "./instellingen";
import { handlers as kandidatenHandlers, tools as kandidatenTools } from "./kandidaten";
import { handlers as matchHandlers, tools as matchTools } from "./matches";
import { handlers as pipelineHandlers, tools as pipelineTools } from "./pipeline";
import { handlers as platformsHandlers, tools as platformsTools } from "./platforms";
import {
  handlers as salesforceFeedHandlers,
  tools as salesforceFeedTools,
} from "./salesforce-feed";
import {
  handlers as screeningCallsHandlers,
  tools as screeningCallsTools,
} from "./screening-calls";
import { handlers as vacatureHandlers, tools as vacatureTools } from "./vacatures";
import { handlers as workspaceHandlers, tools as workspaceTools } from "./workspace";

export const allTools = [
  ...kandidatenTools,
  ...vacatureTools,
  ...matchTools,
  ...pipelineTools,
  ...platformsTools,
  ...salesforceFeedTools,
  ...gdprOpsTools,
  ...analyticsTools,
  ...advancedMatchingTools,
  ...chatSessionsTools,
  ...screeningCallsTools,
  ...instellingenTools,
  ...workspaceTools,
  ...escoSkillsTools,
  ...batchOperationsTools,
  ...cvOpsTools,
  ...channelOfferTools,
  // GitHub tools (for PR creation, repo management, self-knowledge)
  {
    name: "listRepos",
    description: "List GitHub repositories for user or organization",
    parameters: { type: "object", properties: { owner: { type: "string" }, visibility: { type: "string" }, sort: { type: "string" }, limit: { type: "number" } } },
  },
  {
    name: "getRepoInfo",
    description: "Get detailed information about a GitHub repository",
    parameters: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" } }, required: ["owner", "repo"] },
  },
  {
    name: "listPullRequests",
    description: "List pull requests in a repository",
    parameters: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, state: { type: "string" }, limit: { type: "number" } }, required: ["owner", "repo"] },
  },
  {
    name: "getPullRequest",
    description: "Get detailed information about a specific pull request",
    parameters: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, pullNumber: { type: "number" } }, required: ["owner", "repo", "pullNumber"] },
  },
  {
    name: "createPullRequest",
    description: "Create a new pull request from chat",
    parameters: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, title: { type: "string" }, body: { type: "string" }, branch: { type: "string" }, baseBranch: { type: "string" }, draft: { type: "boolean" } }, required: ["owner", "repo", "title", "body", "branch"] },
  },
  {
    name: "mergePullRequest",
    description: "Merge a pull request",
    parameters: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, pullNumber: { type: "number" }, commitTitle: { type: "string" }, squash: { type: "boolean" } }, required: ["owner", "repo", "pullNumber"] },
  },
  {
    name: "listIssues",
    description: "List issues in a repository",
    parameters: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, state: { type: "string" }, limit: { type: "number" } }, required: ["owner", "repo"] },
  },
  {
    name: "createIssue",
    description: "Create a new issue in a repository",
    parameters: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, title: { type: "string" }, body: { type: "string" }, labels: { type: "array", items: { type: "string" } } }, required: ["owner", "repo", "title", "body"] },
  },
  {
    name: "getWorkflowRuns",
    description: "Get recent GitHub Actions workflow runs",
    parameters: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, limit: { type: "number" } }, required: ["owner", "repo"] },
  },
  {
    name: "getMotianProjectStatus",
    description: "Get comprehensive project status for recruitment discussions",
    parameters: { type: "object", properties: { detailed: { type: "boolean" } } },
  },
];

export const allHandlers: Record<string, (args: unknown) => Promise<unknown>> = {
  ...kandidatenHandlers,
  ...vacatureHandlers,
  ...matchHandlers,
  ...pipelineHandlers,
  ...platformsHandlers,
  ...salesforceFeedHandlers,
  ...gdprOpsHandlers,
  ...analyticsHandlers,
  ...advancedMatchingHandlers,
  ...chatSessionsHandlers,
  ...screeningCallsHandlers,
  ...instellingenHandlers,
  ...workspaceHandlers,
  ...escoSkillsHandlers,
  ...batchOperationsHandlers,
  ...cvOpsHandlers,
  ...channelOfferHandlers,
  // GitHub tool handlers
  listRepos: githubTools.listRepos.execute,
  getRepoInfo: githubTools.getRepoInfo.execute,
  listPullRequests: githubTools.listPullRequests.execute,
  getPullRequest: githubTools.getPullRequest.execute,
  createPullRequest: githubTools.createPullRequest.execute,
  mergePullRequest: githubTools.mergePullRequest.execute,
  listIssues: githubTools.listIssues.execute,
  createIssue: githubTools.createIssue.execute,
  getWorkflowRuns: githubTools.getWorkflowRuns.execute,
  getMotianProjectStatus: githubTools.getMotianProjectStatus.execute,
};
