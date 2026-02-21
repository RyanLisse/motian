import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import {
  listMatches,
  getMatchById,
  updateMatchStatus,
  getMatchStats,
} from "../../src/services/matches.js";

export function registerMatchesCommand(program: Command) {
  const matchesCmd = program
    .command("matches")
    .description("Match resultaten beheren en beoordelen");

  // ── motian matches list ──
  matchesCmd
    .command("list")
    .description("Lijst van matches weergeven")
    .option("-j, --job-id <jobId>", "Filteren op opdracht ID")
    .option("-c, --candidate-id <candidateId>", "Filteren op kandidaat ID")
    .option("-s, --status <status>", "Filteren op status (pending, approved, rejected)")
    .option("-l, --limit <aantal>", "Maximum aantal resultaten", "20")
    .action(async (opts) => {
      const spinner = ora("Matches ophalen...").start();
      try {
        const limit = Math.min(Number.parseInt(opts.limit, 10) || 20, 100);

        const results = await listMatches({
          jobId: opts.jobId,
          candidateId: opts.candidateId,
          status: opts.status,
          limit,
        });

        spinner.stop();

        if (results.length === 0) {
          console.log(chalk.yellow("Geen matches gevonden."));
          process.exit(0);
        }

        console.log(
          chalk.bold(`\nMatches (${results.length} resultaten):\n`),
        );

        const rows = results.map((r) => ({
          ID: r.id.slice(0, 8),
          Opdracht: (r.jobTitle ?? "-").slice(0, 30),
          Kandidaat: (r.candidateName ?? "-").slice(0, 20),
          Score: r.overallScore != null ? r.overallScore.toFixed(1) : "-",
          "Vector": r.vectorScore != null ? r.vectorScore.toFixed(2) : "-",
          "LLM": r.llmScore != null ? r.llmScore.toFixed(1) : "-",
          Status: r.status,
        }));

        console.table(rows);
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij ophalen matches");
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });

  // ── motian matches show <id> ──
  matchesCmd
    .command("show <id>")
    .description("Volledige details van een match weergeven")
    .action(async (id: string) => {
      const spinner = ora("Match ophalen...").start();
      try {
        const match = await getMatchById(id);

        spinner.stop();

        if (!match) {
          console.log(chalk.yellow(`Match ${id} niet gevonden.`));
          process.exit(0);
        }

        console.log(chalk.bold(`\n${"=".repeat(60)}`));
        console.log(chalk.bold.cyan(`Match: ${match.candidateName ?? "?"} → ${match.jobTitle ?? "?"}`));
        console.log(chalk.bold(`${"=".repeat(60)}\n`));

        const fields: [string, unknown][] = [
          ["Match ID", match.id],
          ["Opdracht ID", match.jobId],
          ["Kandidaat ID", match.candidateId],
          ["Overall score", match.overallScore != null ? match.overallScore.toFixed(1) : "-"],
          ["Vector score", match.vectorScore != null ? match.vectorScore.toFixed(2) : "-"],
          ["LLM score", match.llmScore != null ? match.llmScore.toFixed(1) : "-"],
          ["Knock-out", match.knockOutPassed != null ? (match.knockOutPassed ? "Geslaagd" : "Niet geslaagd") : "-"],
          ["Status", match.status],
          ["Beoordeeld door", match.reviewedBy],
          ["Beoordeeld op", match.reviewedAt?.toLocaleString("nl-NL") ?? "-"],
          ["Aangemaakt op", match.createdAt?.toLocaleString("nl-NL") ?? "-"],
        ];

        for (const [label, value] of fields) {
          console.log(`${chalk.gray(label.padEnd(18))} ${value ?? "-"}`);
        }

        if (match.matchData && typeof match.matchData === "object" && Object.keys(match.matchData as Record<string, unknown>).length > 0) {
          console.log(chalk.bold("\nAI Analyse:"));
          console.log(JSON.stringify(match.matchData, null, 2));
        }

        console.log();
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij ophalen match");
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });

  // ── motian matches approve <id> ──
  matchesCmd
    .command("approve <id>")
    .description("Match goedkeuren (status → approved)")
    .action(async (id: string) => {
      const spinner = ora("Match goedkeuren...").start();
      try {
        const result = await updateMatchStatus(id, "approved");

        if (!result) {
          spinner.fail(`Match ${id} niet gevonden.`);
          process.exit(1);
        }

        spinner.succeed(chalk.green(`Match ${id.slice(0, 8)} goedgekeurd.`));
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij goedkeuren match");
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });

  // ── motian matches reject <id> ──
  matchesCmd
    .command("reject <id>")
    .description("Match afwijzen (status → rejected)")
    .action(async (id: string) => {
      const spinner = ora("Match afwijzen...").start();
      try {
        const result = await updateMatchStatus(id, "rejected");

        if (!result) {
          spinner.fail(`Match ${id} niet gevonden.`);
          process.exit(1);
        }

        spinner.succeed(chalk.green(`Match ${id.slice(0, 8)} afgewezen.`));
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij afwijzen match");
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });

  // ── motian matches stats ──
  matchesCmd
    .command("stats")
    .description("Statistieken per status")
    .action(async () => {
      const spinner = ora("Statistieken berekenen...").start();
      try {
        const { total, byStatus } = await getMatchStats();

        spinner.stop();

        console.log(chalk.bold.cyan(`\nMotian Match Statistieken`));
        console.log(chalk.bold(`Totaal: ${total} matches\n`));

        console.log(chalk.bold("Per status:"));
        console.table(
          byStatus.map((r) => ({
            Status: r.status,
            Aantal: r.count,
            "Gem. score": r.avgScore ?? "-",
          })),
        );
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij berekenen statistieken");
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });
}
