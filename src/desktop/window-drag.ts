export type Rectangle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Point = {
  x: number;
  y: number;
};

const minimumReachablePixels = 144;

export function calculateMovedBounds(options: { current: Rectangle; delta: Point; workArea: Rectangle }): Rectangle {
  const minX = options.workArea.x - options.current.width + minimumReachablePixels;
  const maxX = options.workArea.x + options.workArea.width - minimumReachablePixels;
  const minY = options.workArea.y;
  const maxY = options.workArea.y + Math.max(0, options.workArea.height - minimumReachablePixels);

  return {
    ...options.current,
    x: clamp(options.current.x + options.delta.x, minX, maxX),
    y: clamp(options.current.y + options.delta.y, minY, maxY),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
