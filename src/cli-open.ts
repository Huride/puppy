import { execFile as nodeExecFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(nodeExecFile);

type ExecFile = (file: string, args: string[], options: { timeout: number }) => Promise<unknown>;

export type OpenOverlayUrlOptions = {
  platform?: NodeJS.Platform;
  execFile?: ExecFile;
};

export async function openOverlayUrl(url: string, options: OpenOverlayUrlOptions = {}): Promise<boolean> {
  const platform = options.platform ?? process.platform;
  const execFile = options.execFile ?? execFileAsync;
  const commands = getOpenCommands(platform, url);

  for (const command of commands) {
    try {
      await execFile(command.file, command.args, { timeout: 4_000 });
      return true;
    } catch {
      // Try the next platform opener before falling back to a printed URL.
    }
  }

  return false;
}

function getOpenCommands(platform: NodeJS.Platform, url: string): Array<{ file: string; args: string[] }> {
  if (platform === "darwin") {
    return [
      { file: "/usr/bin/open", args: [url] },
      { file: "open", args: [url] },
    ];
  }

  if (platform === "win32") {
    return [{ file: "cmd", args: ["/c", "start", "", url] }];
  }

  return [{ file: "xdg-open", args: [url] }];
}
