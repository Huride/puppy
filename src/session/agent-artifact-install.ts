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
  const blocks = readManagedBlocks(trimmed);
  if (blocks.length === 1 && blocks[0] === block) {
    return normalized;
  }

  if (blocks.length > 0) {
    const withoutBlocks = stripManagedBlocks(trimmed);
    if (!withoutBlocks) {
      return `${block}\n`;
    }
    return `${withoutBlocks}\n${block}\n`;
  }

  if (!trimmed) {
    return `${block}\n`;
  }

  return `${trimmed}\n${block}\n`;
}

function readManagedBlocks(content: string): string[] {
  return Array.from(content.matchAll(new RegExp(`${escapeRegExp(START_MARKER)}[\\s\\S]*?${escapeRegExp(END_MARKER)}`, "g"))).map(
    (match) => match[0],
  );
}

function stripManagedBlocks(content: string): string {
  return content
    .replace(new RegExp(`\\n*${escapeRegExp(START_MARKER)}[\\s\\S]*?${escapeRegExp(END_MARKER)}\\n*`, "g"), "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+|\n+$/g, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
