#!/usr/bin/env node
import { config } from "dotenv";
config({ path: ".env.local" });

import { createRequire } from "node:module";
import { Command } from "commander";
import { registerJobsCommand } from "./commands/jobs.js";
import { registerScraperCommand } from "./commands/scrapers.js";
import { registerCandidatesCommand } from "./commands/candidates.js";
import { registerMatchesCommand } from "./commands/matches.js";
import { registerApplicationsCommand } from "./commands/applications.js";
import { registerInterviewsCommand } from "./commands/interviews.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

const program = new Command();

program
  .name("motian")
  .description("Motian recruitment CLI — AI-gestuurde recruitment operations")
  .version(pkg.version);

registerJobsCommand(program);
registerScraperCommand(program);
registerCandidatesCommand(program);
registerMatchesCommand(program);
registerApplicationsCommand(program);
registerInterviewsCommand(program);

program.parse();
