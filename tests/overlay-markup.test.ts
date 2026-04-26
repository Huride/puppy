import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const overlayHtml = readFileSync(path.join(process.cwd(), "src/overlay/index.html"), "utf8");

describe("overlay markup", () => {
  it("starts with the status bubble hidden", () => {
    expect(overlayHtml).toContain('class="bubble hidden"');
  });

  it("keeps the popup before the dog so the status panel opens above it", () => {
    expect(overlayHtml.indexOf('id="popup"')).toBeLessThan(overlayHtml.indexOf('id="pet"'));
  });
});
