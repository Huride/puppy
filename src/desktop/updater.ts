export function shouldCheckForUpdates(isPackaged: boolean, hasUpdateConfig = true): boolean {
  return isPackaged && hasUpdateConfig;
}

export async function checkForUpdatesWhenPackaged(
  isPackaged: boolean,
  checkForUpdates: () => Promise<unknown>,
  logWarning: (message: string, error: unknown) => void = console.warn,
  hasUpdateConfig = true,
): Promise<boolean> {
  if (!shouldCheckForUpdates(isPackaged, hasUpdateConfig)) {
    return false;
  }

  try {
    await checkForUpdates();
    return true;
  } catch (error) {
    logWarning("Pawtrol auto-update check failed", error);
    return false;
  }
}
