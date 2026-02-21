#!/usr/bin/env node
import { config } from "dotenv";
config({ path: ".env.local" });

import { createRequire } from "node:module";
import { Command } from "commander";
import { registerJobsCommand } from "./commands/jobs.js";
import { registerScraperCommand } from "./commands/scrapers.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

const program = new Command();

program
  .name("motian")
  .description("Motian recruitment CLI — AI-gestuurde recruitment operations")
  .version(pkg.version);

registerJobsCommand(program);
registerScraperCommand(program);

program.parse();
