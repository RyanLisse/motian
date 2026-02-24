import { handlers as gdprOpsHandlers, tools as gdprOpsTools } from "./gdpr-ops.js";
import { handlers as kandidatenHandlers, tools as kandidatenTools } from "./kandidaten.js";
import { handlers as matchHandlers, tools as matchTools } from "./matches.js";
import { handlers as pipelineHandlers, tools as pipelineTools } from "./pipeline.js";
import { handlers as vacatureHandlers, tools as vacatureTools } from "./vacatures.js";

export const allTools = [
  ...kandidatenTools,
  ...vacatureTools,
  ...matchTools,
  ...pipelineTools,
  ...gdprOpsTools,
];

export const allHandlers: Record<string, (args: unknown) => Promise<unknown>> = {
  ...kandidatenHandlers,
  ...vacatureHandlers,
  ...matchHandlers,
  ...pipelineHandlers,
  ...gdprOpsHandlers,
};
