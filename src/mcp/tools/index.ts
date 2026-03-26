import {
  handlers as advancedMatchingHandlers,
  tools as advancedMatchingTools,
} from "./advanced-matching";
import { handlers as analyticsHandlers, tools as analyticsTools } from "./analytics";
import { handlers as gdprOpsHandlers, tools as gdprOpsTools } from "./gdpr-ops";
import { handlers as kandidatenHandlers, tools as kandidatenTools } from "./kandidaten";
import { handlers as matchHandlers, tools as matchTools } from "./matches";
import { handlers as pipelineHandlers, tools as pipelineTools } from "./pipeline";
import { handlers as platformsHandlers, tools as platformsTools } from "./platforms";
import {
  handlers as salesforceFeedHandlers,
  tools as salesforceFeedTools,
} from "./salesforce-feed";
import { handlers as vacatureHandlers, tools as vacatureTools } from "./vacatures";

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
};
