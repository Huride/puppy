export type DesktopMenuAction =
  | "show-status"
  | "enter-kennel"
  | "exit-kennel"
  | "auth-settings"
  | "check-updates"
  | "quit";

export type DesktopMenuState = {
  statusLabel: string;
  templates: string[];
  actions: DesktopMenuAction[];
};

export function buildDesktopMenuState(provider: string): DesktopMenuState {
  return {
    statusLabel: `LLM: ${provider}`,
    templates: ["Bori", "Nabi", "Mochi"],
    actions: ["show-status", "enter-kennel", "exit-kennel", "auth-settings", "check-updates", "quit"],
  };
}

export function buildTrayTitle(options: { projectName?: string; provider: string; template: string }): string {
  void options;
  return "🐶";
}
