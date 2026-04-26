export type DesktopMenuAction = "show-status" | "enter-kennel" | "exit-kennel" | "check-updates" | "quit";

export type DesktopMenuState = {
  statusLabel: string;
  templates: string[];
  actions: DesktopMenuAction[];
};

export function buildDesktopMenuState(provider: string): DesktopMenuState {
  return {
    statusLabel: `LLM: ${provider}`,
    templates: ["Bori", "Nabi", "Mochi"],
    actions: ["show-status", "enter-kennel", "exit-kennel", "check-updates", "quit"],
  };
}

export function buildTrayTitle(options: { provider: string; template: string }): string {
  return `🐶 ${options.provider || options.template}`;
}
