export type OverlayCommand = "enter-kennel" | "exit-kennel" | "set-template" | "petting";

export function getOverlayCommandDelays(): number[] {
  return [0, 120, 360, 900];
}

export function buildOverlayCommandScript(command: OverlayCommand, value?: string): string {
  const detail = JSON.stringify({ command, value }).replace(/</g, "\\u003c");
  return `window.dispatchEvent(new CustomEvent("puppy:command", { detail: ${detail} }));`;
}
