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

  it("renders a visual diagnostic panel with issue focus and metric bars", () => {
    expect(overlayHtml).toContain('id="issueTitle"');
    expect(overlayHtml).toContain('id="issueDetail"');
    expect(overlayHtml).toContain('id="contextBar"');
    expect(overlayHtml).toContain('id="tokenBar"');
    expect(overlayHtml).toContain('id="loopBar"');
    expect(overlayHtml).toContain('id="cpuBar"');
    expect(overlayHtml).toContain('id="memoryBar"');
  });

  it("uses a soft borderless dog illustration style", () => {
    expect(overlayHtml).toContain('class="pet-soft-outline"');
    expect(overlayHtml).toContain('class="cheek left-cheek"');
  });

  it("includes a kennel button for minimized companion mode", () => {
    expect(overlayHtml).toContain('id="kennel"');
    expect(overlayHtml).toContain('class="kennel hidden"');
  });

  it("includes desktop app controls inside the overlay", () => {
    expect(overlayHtml).toContain('id="desktopControls"');
    expect(overlayHtml).toContain('id="desktopPanel"');
    expect(overlayHtml).toContain('data-template="Bori"');
    expect(overlayHtml).toContain('data-action="quit"');
  });
});
