import { mkdir as defaultMkdir, readFile as defaultReadFile, writeFile as defaultWriteFile } from "node:fs/promises";
import path from "node:path";
import { resolveAgentArtifactHomes, type AgentArtifactHome, type AgentArtifactHomes } from "./agent-artifact-home.js";

const START_MARKER = "# >>> Pawtrol artifact hook >>>";
const END_MARKER = "# <<< Pawtrol artifact hook <<<";

export type AgentArtifactProvisionStatus = "installed" | "skipped" | "partial";

export type AgentArtifactProvisionResult = {
  status: AgentArtifactProvisionStatus;
  artifactDir: string;
  configPath: string;
  detail?: string;
};

export type AgentArtifactProvisionSummary = {
  codex: AgentArtifactProvisionResult;
  claude: AgentArtifactProvisionResult;
  gemini: AgentArtifactProvisionResult;
};

export type ProvisionAgentArtifactsOptions = {
  homeDir: string;
  env?: Record<string, string | undefined>;
  readFile?: (filePath: string, encoding: BufferEncoding) => Promise<string>;
  writeFile?: (filePath: string, content: string, encoding: BufferEncoding) => Promise<void>;
  mkdir?: (dirPath: string, options?: { recursive?: boolean }) => Promise<void>;
};

export async function provisionAgentArtifacts(options: ProvisionAgentArtifactsOptions): Promise<AgentArtifactProvisionSummary> {
  const homes = resolveAgentArtifactHomes(options);
  return {
    codex: await provisionOneAgent("codex", homes.codex, options),
    claude: await provisionOneAgent("claude", homes.claude, options),
    gemini: await provisionOneAgent("gemini", homes.gemini, options),
  };
}

async function provisionOneAgent(
  agent: keyof AgentArtifactHomes,
  home: AgentArtifactHome,
  options: ProvisionAgentArtifactsOptions,
): Promise<AgentArtifactProvisionResult> {
  const readFile = options.readFile ?? defaultReadFile;
  const writeFile = options.writeFile ?? defaultWriteFile;
  const mkdir = options.mkdir ?? defaultMkdir;
  const configPath = path.join(home.configRoot, "pawtrol-artifacts.conf");

  try {
    await mkdir(home.pawtrolRoot, { recursive: true });
    await mkdir(home.configRoot, { recursive: true });

    const currentContent = await readConfigFile(configPath, readFile);
    const nextBlock = buildHookBlock(agent);
    const updatedContent = upsertManagedBlock(currentContent, nextBlock);

    if (updatedContent === currentContent) {
      return {
        status: "skipped",
        artifactDir: home.pawtrolRoot,
        configPath,
      };
    }

    await writeFile(configPath, updatedContent, "utf8");
    return {
      status: "installed",
      artifactDir: home.pawtrolRoot,
      configPath,
    };
  } catch (error) {
    return {
      status: "partial",
      artifactDir: home.pawtrolRoot,
      configPath,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function readConfigFile(
  configPath: string,
  readFile: (filePath: string, encoding: BufferEncoding) => Promise<string>,
): Promise<string> {
  try {
    return await readFile(configPath, "utf8");
  } catch (error) {
    const code = error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : undefined;
    if (code === "ENOENT") {
      return "";
    }

    throw error;
  }
}

function buildHookBlock(agent: keyof AgentArtifactHomes): string {
  return [START_MARKER, `artifact_dir=${path.posix.join("~", ".pawtrol", "agents", agent)}`, END_MARKER].join("\n");
}

function upsertManagedBlock(content: string, block: string): string {
  const normalized = content.replace(/\r\n/g, "\n");
  const trimmed = normalized.replace(/\n+$/, "");
  const existingBlock = readManagedBlock(trimmed);
  if (existingBlock === block) {
    return normalized;
  }

  if (existingBlock !== null) {
    const start = trimmed.indexOf(START_MARKER);
    const end = trimmed.indexOf(END_MARKER, start);
    const before = trimmed.slice(0, start).replace(/\n+$/, "");
    const after = trimmed.slice(end + END_MARKER.length).replace(/^\n+/, "");
    return joinSections(before, block, after);
  }

  if (!trimmed) {
    return `${block}\n`;
  }

  return `${trimmed}\n${block}\n`;
}

function readManagedBlock(content: string): string | null {
  const start = content.indexOf(START_MARKER);
  if (start === -1) {
    return null;
  }

  const end = content.indexOf(END_MARKER, start);
  if (end === -1) {
    return null;
  }

  return content.slice(start, end + END_MARKER.length);
}

function joinSections(...sections: string[]): string {
  return `${sections.filter((section) => section.length > 0).join("\n")}\n`;
}
