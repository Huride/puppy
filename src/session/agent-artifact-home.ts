import path from "node:path";

export type AgentArtifactHome = {
  configRoot: string;
  pawtrolRoot: string;
};

export type AgentArtifactHomes = {
  codex: AgentArtifactHome;
  claude: AgentArtifactHome;
  gemini: AgentArtifactHome;
};

export function resolveAgentArtifactHomes(options: {
  homeDir: string;
  env?: Record<string, string | undefined>;
}): AgentArtifactHomes {
  const pawtrolAgentsRoot = path.join(options.homeDir, ".pawtrol", "agents");
  const geminiConfigRoot =
    options.env?.ANTIGRAVITY_HOME ??
    options.env?.GEMINI_HOME ??
    path.join(options.homeDir, ".gemini");

  return {
    codex: {
      configRoot: path.join(options.homeDir, ".codex"),
      pawtrolRoot: path.join(pawtrolAgentsRoot, "codex"),
    },
    claude: {
      configRoot: path.join(options.homeDir, ".claude"),
      pawtrolRoot: path.join(pawtrolAgentsRoot, "claude"),
    },
    gemini: {
      configRoot: geminiConfigRoot,
      pawtrolRoot: path.join(pawtrolAgentsRoot, "gemini"),
    },
  };
}
