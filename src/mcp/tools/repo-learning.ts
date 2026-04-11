import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { runRepoLearning } from "../../services/repo-learning";

const repoLearnSchema = z.object({
  repoRoot: z.string().optional(),
  statePath: z.string().optional(),
  factsPath: z.string().optional(),
});

export const tools = [
  {
    name: "repo_learn",
    description:
      "Extraheert kennis uit de repository (tests, AGENTS/CLAUDE, Cargo.toml, hooks) en slaat facts op.",
    inputSchema: zodToJsonSchema(repoLearnSchema, { $refStrategy: "none" }),
  },
];

export const handlers: Record<string, (args: unknown) => Promise<unknown>> = {
  repo_learn: async (args) => {
    const input = repoLearnSchema.parse(args ?? {});
    return runRepoLearning(input);
  },
};
