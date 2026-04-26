import { spawn } from "node:child_process";
import readline from "node:readline";
import type { AgentOutputEvent } from "./types.js";

export type WatchCommandOptions = {
  onEvent: (event: AgentOutputEvent) => void;
};

export async function watchCommand(command: string[], options: WatchCommandOptions): Promise<number> {
  if (command.length === 0) {
    throw new Error("No command provided after --");
  }

  const child = spawn(command[0], command.slice(1), {
    stdio: ["inherit", "pipe", "pipe"],
    env: process.env,
  });

  streamLines(child.stdout, "stdout", options.onEvent);
  streamLines(child.stderr, "stderr", options.onEvent);

  return await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 0));
  });
}

function streamLines(
  stream: NodeJS.ReadableStream,
  name: "stdout" | "stderr",
  onEvent: (event: AgentOutputEvent) => void,
): void {
  const reader = readline.createInterface({ input: stream });
  reader.on("line", (line) => {
    onEvent({
      type: "agent_output",
      stream: name,
      line,
      timestamp: Date.now(),
    });
  });
}
