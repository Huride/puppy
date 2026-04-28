import path from "node:path";
import type { PopupSystemActionId } from "../session/types.js";

export type SystemActionId = PopupSystemActionId;

export type SystemActionContext = {
  platform: NodeJS.Platform | string;
  artifactPath?: string | null;
  allowedArtifactRoots?: string[];
};

export type SystemActionCommand =
  | {
      type: "open-application";
      target: string;
    }
  | {
      type: "open-url";
      target: string;
    }
  | {
      type: "reveal-path";
      target: string;
    }
  | {
      type: "show-watch-guide";
      target: string;
      detail: string;
    };

const macBaseActions: SystemActionId[] = [
  "activity-monitor",
  "storage-settings",
  "network-settings",
  "show-watch-guide",
];

export function buildAvailableSystemActions(context: SystemActionContext): SystemActionId[] {
  if (context.platform !== "darwin") {
    return [];
  }

  return context.artifactPath ? [...macBaseActions.slice(0, 3), "open-artifact-path", "show-watch-guide"] : [...macBaseActions];
}

export function buildSystemActionCommand(
  action: SystemActionId,
  context: SystemActionContext,
): SystemActionCommand | null {
  if (!buildAvailableSystemActions(context).includes(action)) {
    return null;
  }

  const allowedArtifactPath = resolveAllowedArtifactPath(context);

  switch (action) {
    case "activity-monitor":
      return {
        type: "open-application",
        target: "Activity Monitor",
      };
    case "storage-settings":
      return {
        type: "open-url",
        target: "x-apple.systempreferences:com.apple.settings.Storage",
      };
    case "network-settings":
      return {
        type: "open-url",
        target: "x-apple.systempreferences:com.apple.Network-Settings.extension",
      };
    case "open-artifact-path":
      return allowedArtifactPath
        ? {
            type: "reveal-path",
            target: allowedArtifactPath,
          }
        : null;
    case "show-watch-guide":
      return {
        type: "show-watch-guide",
        target: "pawtrol watch -- <command>",
        detail: "실제 stdout/stderr를 바로 읽으려면 watch 모드로 다시 실행하세요.",
      };
  }
}

export function resolveAllowedArtifactPath(context: SystemActionContext): string | null {
  if (!context.artifactPath) {
    return null;
  }

  const resolvedArtifactPath = path.resolve(context.artifactPath);
  const roots = context.allowedArtifactRoots?.map((root) => path.resolve(root)).filter((root) => root.length > 0) ?? [];
  if (roots.length === 0) {
    return resolvedArtifactPath;
  }

  return roots.some((root) => isPathWithinRoot(resolvedArtifactPath, root)) ? resolvedArtifactPath : null;
}

function isPathWithinRoot(candidatePath: string, rootPath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
