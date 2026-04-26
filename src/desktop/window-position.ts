export type BottomRightBoundsOptions = {
  width: number;
  height: number;
  windowWidth: number;
  windowHeight: number;
  margin: number;
};

export type WindowBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function calculateBottomRightBounds(options: BottomRightBoundsOptions): WindowBounds {
  return {
    x: Math.max(options.margin, options.width - options.windowWidth - options.margin),
    y: Math.max(options.margin, options.height - options.windowHeight - options.margin),
    width: options.windowWidth,
    height: options.windowHeight,
  };
}
