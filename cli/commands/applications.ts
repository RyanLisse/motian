import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import {
  listApplications,
  getApplicationById,
  createApplication,
  updateApplicationStage,
  getApplicationStats,
} from "../../src/services/applications.js";

export function registerApplicationsCommand(program: Command) {
  const appCmd = program
    .command("applications")
    .description("Sollicitaties beheren");

  // ── motian applications list ──
  appCmd
    .command("list")
    .description("Lijst van sollicitaties weergeven")
    .option("-j, --job-id <jobId>", "Filteren op vacature ID")
    .option("-c, --candidate-id <candidateId>", "Filteren op kandidaat ID")
    .option("-s, --stage <stage>", "Filteren op stage (new, screening, interview, offer, hired, rejected)")
    .option("-l, --limit <aantal>", "Maximum aantal resultaten", "20")
    .action(async (opts) => {
      const spinner = ora("Sollicitaties ophalen...").start();
      try {
        const limit = Math.min(Number.parseInt(opts.limit, 10) || 20, 100);

        const results = await listApplications({
          jobId: opts.jobId,
          candidateId: opts.candidateId,
          stage: opts.stage,
          limit,
        });

        spinner.stop();

        if (results.length === 0) {
          console.log(chalk.yellow("Geen sollicitaties gevonden."));
          process.exit(0);
        }

        console.log(
          chalk.bold(`\nSollicitaties (${results.length} resultaten):\n`),
        );

        const rows = results.map((r) => ({
          ID: r.id.slice(0, 8),
          Vacature: (r.jobTitle ?? r.jobId ?? "-").slice(0, 30),
          Kandidaat: (r.candidateName ?? r.candidateId ?? "-").slice(0, 20),
          Stage: r.stage,
          Bron: r.source ?? "-",
          Aangemaakt: r.createdAt?.toLocaleDateString("nl-NL") ?? "-",
        }));

        console.table(rows);
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij ophalen sollicitaties");
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });

  // ── motian applications show <id> ──
  appCmd
    .command("show <id>")
    .description("Volledige details van een sollicitatie weergeven")
    .action(async (id: string) => {
      const spinner = ora("Sollicitatie ophalen...").start();
      try {
        const app = await getApplicationById(id);

        spinner.stop();

        if (!app) {
          console.log(chalk.yellow(`Sollicitatie ${id} niet gevonden.`));
          process.exit(0);
        }

        console.log(chalk.bold(`\n${"=".repeat(60)}`));
        console.log(chalk.bold.cyan(`Sollicitatie: ${app.candidateName ?? "?"} → ${app.jobTitle ?? "?"}`));
        console.log(chalk.bold(`${"=".repeat(60)}\n`));

        const fields: [string, unknown][] = [
          ["Sollicitatie ID", app.id],
          ["Vacature ID", app.jobId],
          ["Kandidaat ID", app.candidateId],
          ["Match ID", app.matchId ?? "-"],
          ["Stage", app.stage],
          ["Bron", app.source ?? "-"],
          ["Notities", app.notes ?? "-"],
          ["Aangemaakt op", app.createdAt?.toLocaleString("nl-NL") ?? "-"],
          ["Bijgewerkt op", app.updatedAt?.toLocaleString("nl-NL") ?? "-"],
        ];

        for (const [label, value] of fields) {
          console.log(`${chalk.gray(label.padEnd(18))} ${value ?? "-"}`);
        }

        if (app.stageHistory && Array.isArray(app.stageHistory) && app.stageHistory.length > 0) {
          console.log(chalk.bold("\nStage historie:"));
          for (const entry of app.stageHistory) {
            console.log(`  ${chalk.gray(entry.date ?? "-")} ${entry.from} → ${entry.to}${entry.notes ? ` (${entry.notes})` : ""}`);
          }
        }

        console.log();
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij ophalen sollicitatie");
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });

  // ── motian applications add ──
  appCmd
    .command("add")
    .description("Nieuwe sollicitatie aanmaken")
    .requiredOption("--job-id <jobId>", "Vacature ID")
    .requiredOption("--candidate-id <candidateId>", "Kandidaat ID")
    .option("--source <source>", "Bron (match, manual, import)", "manual")
    .option("--notes <notes>", "Recruiter notities")
    .action(async (opts) => {
      const spinner = ora("Sollicitatie aanmaken...").start();
      try {
        const result = await createApplication({
          jobId: opts.jobId,
          candidateId: opts.candidateId,
          source: opts.source,
          notes: opts.notes,
        });

        spinner.succeed(chalk.green(`Sollicitatie ${result.id.slice(0, 8)} aangemaakt.`));
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij aanmaken sollicitatie");
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });

  // ── motian applications stage <id> <stage> ──
  appCmd
    .command("stage <id> <stage>")
    .description("Sollicitatie stage wijzigen (new, screening, interview, offer, hired, rejected)")
    .option("-n, --notes <notes>", "Notities bij de wijziging")
    .action(async (id: string, stage: string, opts) => {
      const spinner = ora("Stage bijwerken...").start();
      try {
        const result = await updateApplicationStage(id, stage, opts.notes);

        if (!result) {
          spinner.fail(`Sollicitatie ${id} niet gevonden.`);
          process.exit(1);
        }

        spinner.succeed(chalk.green(`Sollicitatie ${id.slice(0, 8)} → ${stage}`));
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij bijwerken stage");
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });

  // ── motian applications stats ──
  appCmd
    .command("stats")
    .description("Statistieken per stage")
    .action(async () => {
      const spinner = ora("Statistieken berekenen...").start();
      try {
        const { total, byStage } = await getApplicationStats();

        spinner.stop();

        console.log(chalk.bold.cyan(`\nMotian Sollicitatie Statistieken`));
        console.log(chalk.bold(`Totaal: ${total} sollicitaties\n`));

        console.log(chalk.bold("Per stage:"));
        console.table(
          byStage.map((r) => ({
            Stage: r.stage,
            Aantal: r.count,
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
