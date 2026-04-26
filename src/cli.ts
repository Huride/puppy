import "dotenv/config";
import { watchCommand } from "./session/watcher.js";

async function main(): Promise<void> {
  const [subcommand, separatorOrFirst, ...rest] = process.argv.slice(2);

  if (subcommand !== "watch") {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const command = separatorOrFirst === "--" ? rest : [separatorOrFirst, ...rest].filter(Boolean);
  const exitCode = await watchCommand(command, {
    onEvent: () => undefined,
  });

  process.exitCode = exitCode;
}

function printUsage(): void {
  console.log("Usage: puppy watch -- <command>");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
