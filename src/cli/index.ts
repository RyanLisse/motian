#!/usr/bin/env node
import "dotenv/config";
import { parseArgs } from "./parse-args";
import { commands } from "./commands";

const { command, args } = parseArgs(process.argv.slice(2));

if (command === "help" || args.help) {
  console.log("Motian CLI - Recruitment Platform\n");
  console.log("Gebruik: pnpm cli <commando> [opties]\n");
  console.log("Commando's:");

  // Group commands by prefix for readability
  let lastGroup = "";
  for (const [name, cmd] of Object.entries(commands)) {
    const group = name.split(":")[0];
    if (group !== lastGroup) {
      if (lastGroup) console.log();
      lastGroup = group;
    }
    console.log(`  ${name.padEnd(28)} ${cmd.description}`);
  }

  console.log("\nGebruik: pnpm cli <commando> --help voor opties van een specifiek commando.");
  process.exit(0);
}

const cmd = commands[command];
if (!cmd) {
  console.error(`Onbekend commando: ${command}`);
  console.error("Gebruik 'pnpm cli help' voor alle commando's.");
  process.exit(1);
}

if (args.help) {
  console.log(`${command}: ${cmd.description}`);
  console.log(`Gebruik: pnpm cli ${command} ${cmd.usage}`);
  process.exit(0);
}

try {
  const result = await cmd.handler(args);
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error("Fout:", err instanceof Error ? err.message : String(err));
  process.exit(1);
}
