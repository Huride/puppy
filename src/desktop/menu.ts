export type DesktopMenuAction = "show-status" | "toggle-window" | "check-updates" | "quit";

export type DesktopMenuState = {
  statusLabel: string;
  templates: string[];
  actions: DesktopMenuAction[];
};

export function buildDesktopMenuState(provider: string): DesktopMenuState {
  return {
    statusLabel: `LLM: ${provider}`,
    templates: ["Bori", "Nabi", "Mochi"],
    actions: ["show-status", "toggle-window", "check-updates", "quit"],
  };
}
