import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import {
  listMessages,
  getMessageById,
  createMessage,
  VALID_DIRECTIONS,
  VALID_CHANNELS,
} from "../../src/services/messages.js";

export function registerMessagesCommand(program: Command) {
  const msgCmd = program
    .command("messages")
    .description("Berichten beheren");

  // ── motian messages list ──
  msgCmd
    .command("list")
    .description("Lijst van berichten weergeven")
    .option("-a, --application-id <applicationId>", "Filteren op sollicitatie ID")
    .option("-d, --direction <direction>", "Filteren op richting (inbound, outbound)")
    .option("-c, --channel <channel>", "Filteren op kanaal (email, phone, platform)")
    .option("-l, --limit <aantal>", "Maximum aantal resultaten", "20")
    .action(async (opts) => {
      const spinner = ora("Berichten ophalen...").start();
      try {
        const limit = Math.min(Number.parseInt(opts.limit, 10) || 20, 100);

        const results = await listMessages({
          applicationId: opts.applicationId,
          direction: opts.direction,
          channel: opts.channel,
          limit,
        });

        spinner.stop();

        if (results.length === 0) {
          console.log(chalk.yellow("Geen berichten gevonden."));
          process.exit(0);
        }

        console.log(
          chalk.bold(`\nBerichten (${results.length} resultaten):\n`),
        );

        const rows = results.map((r) => ({
          ID: r.id.slice(0, 8),
          Richting: r.direction ?? "-",
          Kanaal: r.channel ?? "-",
          Onderwerp: (r.subject ?? "-").slice(0, 40),
          Kandidaat: (r.candidateName ?? "-").slice(0, 20),
          Vacature: (r.jobTitle ?? "-").slice(0, 25),
          Verzonden: r.sentAt ? new Date(r.sentAt).toLocaleDateString("nl-NL") : "-",
        }));

        console.table(rows);
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij ophalen berichten");
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });

  // ── motian messages show <id> ──
  msgCmd
    .command("show <id>")
    .description("Volledige details van een bericht weergeven")
    .action(async (id: string) => {
      const spinner = ora("Bericht ophalen...").start();
      try {
        const msg = await getMessageById(id);

        spinner.stop();

        if (!msg) {
          console.log(chalk.yellow(`Bericht ${id} niet gevonden.`));
          process.exit(0);
        }

        console.log(chalk.bold(`\n${"=".repeat(60)}`));
        console.log(chalk.bold.cyan(`Bericht: ${msg.subject ?? "(geen onderwerp)"}`));
        console.log(chalk.bold(`${"=".repeat(60)}\n`));

        const fields: [string, unknown][] = [
          ["Bericht ID", msg.id],
          ["Sollicitatie ID", msg.applicationId],
          ["Richting", msg.direction],
          ["Kanaal", msg.channel],
          ["Onderwerp", msg.subject ?? "-"],
          ["Kandidaat", msg.candidateName ?? "-"],
          ["Vacature", msg.jobTitle ?? "-"],
          ["Verzonden op", msg.sentAt ? new Date(msg.sentAt).toLocaleString("nl-NL") : "-"],
          ["Aangemaakt op", msg.createdAt ? new Date(msg.createdAt).toLocaleString("nl-NL") : "-"],
        ];

        for (const [label, value] of fields) {
          console.log(`${chalk.gray(label.padEnd(18))} ${value ?? "-"}`);
        }

        if (msg.body) {
          console.log(chalk.bold("\nInhoud:"));
          console.log(msg.body);
        }

        console.log();
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij ophalen bericht");
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });

  // ── motian messages send ──
  msgCmd
    .command("send")
    .description("Nieuw bericht versturen")
    .requiredOption("--application-id <applicationId>", "Sollicitatie ID")
    .option("--direction <direction>", "Richting (inbound, outbound)", "outbound")
    .option("--channel <channel>", "Kanaal (email, phone, platform)", "email")
    .option("--subject <subject>", "Onderwerp")
    .requiredOption("--body <body>", "Berichttekst")
    .action(async (opts) => {
      // Validate direction and channel before calling service
      if (!VALID_DIRECTIONS.includes(opts.direction)) {
        console.error(chalk.red(`Ongeldige richting: ${opts.direction}. Kies uit: ${VALID_DIRECTIONS.join(", ")}`));
        process.exit(1);
      }
      if (!VALID_CHANNELS.includes(opts.channel)) {
        console.error(chalk.red(`Ongeldig kanaal: ${opts.channel}. Kies uit: ${VALID_CHANNELS.join(", ")}`));
        process.exit(1);
      }

      const spinner = ora("Bericht versturen...").start();
      try {
        const result = await createMessage({
          applicationId: opts.applicationId,
          direction: opts.direction,
          channel: opts.channel,
          subject: opts.subject,
          body: opts.body,
        });

        if (!result) {
          spinner.fail(chalk.red("Sollicitatie niet gevonden of is verwijderd."));
          process.exit(1);
        }

        spinner.succeed(chalk.green(`Bericht ${result.id.slice(0, 8)} verstuurd.`));
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij versturen bericht");
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });
}
