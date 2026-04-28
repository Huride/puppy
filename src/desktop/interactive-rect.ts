export type InteractiveRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  popupOpen: boolean;
  pet?: { left: number; top: number; right: number; bottom: number } | null;
} | null;

export function shouldRefreshInteractiveRect(
  previous: InteractiveRect,
  next: InteractiveRect,
  tolerance = 6,
): boolean {
  if (previous === null || next === null) {
    return previous !== next;
  }

  if (previous.popupOpen !== next.popupOpen) {
    return true;
  }

  if (rectDiffers(previous, next, tolerance)) {
    return true;
  }

  if (previous.pet == null || next.pet == null) {
    return previous.pet !== next.pet;
  }

  return rectDiffers(previous.pet, next.pet, tolerance);
}

function rectDiffers(
  previous: { left: number; top: number; right: number; bottom: number },
  next: { left: number; top: number; right: number; bottom: number },
  tolerance: number,
): boolean {
  return (
    Math.abs(previous.left - next.left) > tolerance ||
    Math.abs(previous.top - next.top) > tolerance ||
    Math.abs(previous.right - next.right) > tolerance ||
    Math.abs(previous.bottom - next.bottom) > tolerance
  );
}
