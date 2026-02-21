import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import {
  listInterviews,
  getInterviewById,
  createInterview,
  updateInterview,
} from "../../src/services/interviews.js";

export function registerInterviewsCommand(program: Command) {
  const intCmd = program
    .command("interviews")
    .description("Interviews beheren en inplannen");

  // ── motian interviews list ──
  intCmd
    .command("list")
    .description("Lijst van interviews weergeven")
    .option("-a, --application-id <applicationId>", "Filteren op sollicitatie ID")
    .option("-s, --status <status>", "Filteren op status (scheduled, completed, cancelled)")
    .option("-l, --limit <aantal>", "Maximum aantal resultaten", "20")
    .action(async (opts) => {
      const spinner = ora("Interviews ophalen...").start();
      try {
        const limit = Math.min(Number.parseInt(opts.limit, 10) || 20, 100);

        const results = await listInterviews({
          applicationId: opts.applicationId,
          status: opts.status,
          limit,
        });

        spinner.stop();

        if (results.length === 0) {
          console.log(chalk.yellow("Geen interviews gevonden."));
          process.exit(0);
        }

        console.log(
          chalk.bold(`\nInterviews (${results.length} resultaten):\n`),
        );

        const rows = results.map((r) => ({
          ID: r.id.slice(0, 8),
          Sollicitatie: (r.applicationId ?? "-").slice(0, 12),
          Type: r.type ?? "-",
          Interviewer: (r.interviewer ?? "-").slice(0, 20),
          Gepland: r.scheduledAt?.toLocaleString("nl-NL") ?? "-",
          Status: r.status ?? "-",
          Beoordeling: r.rating != null ? `${r.rating}/5` : "-",
        }));

        console.table(rows);
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij ophalen interviews");
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });

  // ── motian interviews show <id> ──
  intCmd
    .command("show <id>")
    .description("Volledige details van een interview weergeven")
    .action(async (id: string) => {
      const spinner = ora("Interview ophalen...").start();
      try {
        const interview = await getInterviewById(id);

        spinner.stop();

        if (!interview) {
          console.log(chalk.yellow(`Interview ${id} niet gevonden.`));
          process.exit(0);
        }

        console.log(chalk.bold(`\n${"=".repeat(60)}`));
        console.log(chalk.bold.cyan(`Interview: ${interview.type ?? "?"} met ${interview.interviewer ?? "?"}`));
        console.log(chalk.bold(`${"=".repeat(60)}\n`));

        const fields: [string, unknown][] = [
          ["Interview ID", interview.id],
          ["Sollicitatie ID", interview.applicationId],
          ["Type", interview.type ?? "-"],
          ["Interviewer", interview.interviewer ?? "-"],
          ["Gepland op", interview.scheduledAt?.toLocaleString("nl-NL") ?? "-"],
          ["Duur (min)", interview.duration ?? 60],
          ["Locatie", interview.location ?? "-"],
          ["Status", interview.status ?? "-"],
          ["Beoordeling", interview.rating != null ? `${interview.rating}/5` : "-"],
          ["Feedback", interview.feedback ?? "-"],
          ["Aangemaakt op", interview.createdAt?.toLocaleString("nl-NL") ?? "-"],
        ];

        for (const [label, value] of fields) {
          console.log(`${chalk.gray(label.padEnd(18))} ${value ?? "-"}`);
        }

        console.log();
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij ophalen interview");
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });

  // ── motian interviews schedule ──
  intCmd
    .command("schedule")
    .description("Interview inplannen")
    .requiredOption("-a, --application-id <applicationId>", "Sollicitatie ID")
    .requiredOption("--date <date>", "Datum (YYYY-MM-DD)")
    .requiredOption("--time <time>", "Tijd (HH:MM)")
    .requiredOption("--type <type>", "Type (phone, video, onsite, technical)")
    .requiredOption("--interviewer <interviewer>", "Naam van de interviewer")
    .option("--duration <minuten>", "Duur in minuten", "60")
    .option("--location <locatie>", "Locatie (voor onsite)")
    .action(async (opts) => {
      const spinner = ora("Interview inplannen...").start();
      try {
        const scheduledAt = new Date(`${opts.date}T${opts.time}:00`);

        if (Number.isNaN(scheduledAt.getTime())) {
          spinner.fail("Ongeldige datum/tijd. Gebruik --date YYYY-MM-DD --time HH:MM");
          process.exit(1);
        }

        const result = await createInterview({
          applicationId: opts.applicationId,
          scheduledAt,
          type: opts.type,
          interviewer: opts.interviewer,
          duration: Number.parseInt(opts.duration, 10) || 60,
          location: opts.location,
        });

        spinner.succeed(chalk.green(`Interview ${result.id.slice(0, 8)} ingepland op ${scheduledAt.toLocaleString("nl-NL")}`));
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij inplannen interview");
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });

  // ── motian interviews update <id> ──
  intCmd
    .command("update <id>")
    .description("Interview bijwerken (status, feedback, beoordeling)")
    .option("-s, --status <status>", "Nieuwe status (scheduled, completed, cancelled)")
    .option("-f, --feedback <feedback>", "Feedback tekst")
    .option("-r, --rating <rating>", "Beoordeling (1-5)")
    .action(async (id: string, opts) => {
      const spinner = ora("Interview bijwerken...").start();
      try {
        const updates: Record<string, unknown> = {};
        if (opts.status) updates.status = opts.status;
        if (opts.feedback) updates.feedback = opts.feedback;
        if (opts.rating) updates.rating = Number.parseInt(opts.rating, 10);

        if (Object.keys(updates).length === 0) {
          spinner.fail("Geef minimaal --status, --feedback of --rating op.");
          process.exit(1);
        }

        const result = await updateInterview(id, updates as {
          status?: string;
          feedback?: string;
          rating?: number;
        });

        if (!result) {
          spinner.fail(`Interview ${id} niet gevonden.`);
          process.exit(1);
        }

        spinner.succeed(chalk.green(`Interview ${id.slice(0, 8)} bijgewerkt.`));
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij bijwerken interview");
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });
}
