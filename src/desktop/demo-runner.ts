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

export function extractOverlayUrl(output: string): string | null {
  const match = output.match(/Puppy overlay:\s*(http:\/\/localhost:\d+)/);
  return match?.[1] ?? null;
}

export function buildDemoCommand(): string[] {
  return ["dist/src/cli.js", "watch", "--", "node", "scripts/demo-agent.mjs"];
}

export function buildDemoRuntime(options: DemoRuntimeOptions): DemoRuntime {
  if (!options.isPackaged) {
    return {
      command: "node",
      cwd: options.projectRoot,
      env: {},
    };
  }

  return {
    command: options.execPath,
    cwd: path.join(options.resourcesPath, "app.asar.unpacked"),
    env: {
      ELECTRON_RUN_AS_NODE: "1",
    },
  };
}
