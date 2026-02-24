export type ParsedArgs = Record<string, string | boolean>;

export function parseArgs(argv: string[]): { command: string; args: ParsedArgs } {
  const command = argv[0] ?? "help";
  const args: ParsedArgs = {};
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return { command, args };
}
