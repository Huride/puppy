export function shouldUseInteractiveWindowShape(isPackaged: boolean, platform = process.platform): boolean {
  return !(isPackaged && platform === "darwin");
}

export function shouldUseDynamicInteractiveBounds(isPackaged: boolean, platform = process.platform): boolean {
  return !(isPackaged && platform === "darwin");
}
