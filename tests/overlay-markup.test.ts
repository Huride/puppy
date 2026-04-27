import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const overlayHtml = readFileSync(path.join(process.cwd(), "src/overlay/index.html"), "utf8");
const overlayCss = readFileSync(path.join(process.cwd(), "src/overlay/styles.css"), "utf8");

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

  it("keeps desktop app controls out of the overlay because they live in the menu bar", () => {
    expect(overlayHtml).not.toContain('id="desktopControls"');
    expect(overlayHtml).not.toContain('id="desktopPanel"');
  });

  it("has visible visual variants for dog templates", () => {
    expect(overlayCss).toContain('body[data-template="bori"]');
    expect(overlayCss).toContain('body[data-template="nabi"]');
    expect(overlayCss).toContain('body[data-template="mochi"]');
  });

  it("includes stationary lying and sitting animation states", () => {
    expect(overlayCss).toContain(".pet.sitting");
    expect(overlayCss).toContain(".pet.lying");
    expect(overlayCss).toContain("@keyframes lie-down");
  });

  it("shows the kennel before Bori walks into it", () => {
    expect(overlayCss).toContain(".kennel.entering");
    expect(overlayCss).toContain(".pet.kennel-entering");
    expect(overlayCss).toContain("position: absolute");
    expect(overlayCss).toContain("@keyframes kennel-walk-in");
    expect(overlayCss).toContain("@keyframes kennel-door-wait");
  });

  it("walks Bori out of the kennel instead of popping out", () => {
    expect(overlayCss).toContain(".kennel.exiting");
    expect(overlayCss).toContain(".pet.kennel-exiting");
    expect(overlayCss).toContain("@keyframes kennel-walk-out");
  });
});
