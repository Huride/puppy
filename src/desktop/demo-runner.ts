import path from "node:path";

export type DemoRuntimeOptions = {
  isPackaged: boolean;
  projectRoot: string;
  resourcesPath: string;
  execPath: string;
};

export type DemoRuntime = {
  command: string;
  cwd: string;
  env: Record<string, string>;
};

type OverlayCommandMode = "demo" | "companion";

export function extractOverlayUrl(output: string): string | null {
  const match = output.match(/(?:Pawtrol|Puppy) overlay:\s*(http:\/\/localhost:\d+)/);
  return match?.[1] ?? null;
}

export function buildDemoCommand(mode: OverlayCommandMode = "demo"): string[] {
  if (mode === "companion") {
    return ["dist/src/cli.js", "companion-server"];
  }

  return ["dist/src/cli.js", "watch", "--", "node", "scripts/demo-agent.mjs"];
}

export function shouldRunDemoSession(isPackaged: boolean, env: Record<string, string | undefined> = process.env): boolean {
  if (env.PAWTROL_DESKTOP_COMPANION === "1" || env.PAWTROL_DEMO === "0") {
    return false;
  }

  if (env.PAWTROL_DEMO === "1") {
    return true;
  }

  return !isPackaged;
}

export function buildDemoRuntime(options: DemoRuntimeOptions, mode: OverlayCommandMode = "demo"): DemoRuntime {
  const sessionEnv = mode === "demo" ? { PAWTROL_DEMO: "1" } : { PAWTROL_DEMO: "0" };

  if (!options.isPackaged) {
    return {
      command: "node",
      cwd: options.projectRoot,
      env: sessionEnv,
    };
  }

  return {
    command: options.execPath,
    cwd: path.join(options.resourcesPath, "app.asar.unpacked"),
    env: {
      ELECTRON_RUN_AS_NODE: "1",
      ...sessionEnv,
    },
  };
}
