export type WindowShapeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function buildWindowShape(
  interactiveRect: { left: number; top: number; right: number; bottom: number } | null,
  fallback: { width: number; height: number },
): WindowShapeRect[] {
  if (!interactiveRect) {
    return [{ x: 0, y: 0, width: Math.max(1, Math.round(fallback.width)), height: Math.max(1, Math.round(fallback.height)) }];
  }

  const width = Math.max(1, Math.round(interactiveRect.right - interactiveRect.left));
  const height = Math.max(1, Math.round(interactiveRect.bottom - interactiveRect.top));

  return [
    {
      x: Math.max(0, Math.round(interactiveRect.left)),
      y: Math.max(0, Math.round(interactiveRect.top)),
      width,
      height,
    },
  ];
}
