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
    expect(overlayHtml).toContain('id="sessionMeta"');
    expect(overlayHtml).toContain('id="contextBar"');
    expect(overlayHtml).toContain('id="tokenBar"');
    expect(overlayHtml).toContain('id="loopBar"');
    expect(overlayHtml).toContain('id="cpuBar"');
    expect(overlayHtml).toContain('id="memoryBar"');
  });

  it("renders raster pet and house sprite layers", () => {
    expect(overlayHtml).toContain(
      '<span class="pet-stage" id="petArt" role="img" aria-label="Pawtrol dog companion">',
    );
    expect(overlayHtml).toContain('id="houseFrame" src="./assets/house-small.png"');
    expect(overlayHtml).toContain('id="petFrame" src="./assets/bori-walking.png"');
    expect(overlayHtml).toContain('id="petHit"');
    expect(overlayHtml).toContain('id="heartBurst"');
    expect(overlayHtml).toContain("💗");
    expect(overlayHtml).toContain('id="kennelHouseFrame" src="./assets/house-small.png"');
    expect(overlayHtml).toContain('class="kennel-zzz"');
  });

  it("removes old inline dog illustration artifacts", () => {
    expect(overlayHtml).not.toContain('class="pet-soft-outline"');
    expect(overlayHtml).not.toContain('class="sweater"');
    expect(overlayHtml).not.toContain('class="cheek left-cheek"');
    expect(overlayCss).not.toContain(".pet-art");
    expect(overlayCss).not.toContain(".sweater");
  });

  it("does not draw a grey backing or shadow behind Bori", () => {
    expect(overlayHtml).not.toContain("softFurShadow");
    expect(overlayHtml).not.toContain('class="pet-shadow"');
    expect(overlayCss).not.toContain("drop-shadow");
  });

  it("removes floating shadows from bubble, popup, and kennel panels", () => {
    expect(overlayCss.match(/box-shadow: none/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps pose animation transforms from squashing Bori", () => {
    expect(overlayCss).not.toMatch(/scale[XY]\(/);
    expect(overlayCss.match(/@keyframes (sit-settle|lie-down|sleepy-body|stretch-body)[\s\S]*?}/g)?.join("\n")).not.toMatch(
      /scale[XY]\(/,
    );
  });

  it("styles sprite layers and keeps pose keyframes for whole-sprite animation", () => {
    expect(overlayCss).toContain(".pet-stage");
    expect(overlayCss).toContain(".pet-hit");
    expect(overlayCss).toContain(".pet {\n  order: 4;\n  position: relative;");
    expect(overlayCss).toContain("background: transparent;");
    expect(overlayCss).toContain(".kennel-stage");
    expect(overlayCss).toContain("width: min(590px");
    expect(overlayCss).toContain("object-fit: contain");
    expect(overlayCss).toContain("object-position: center bottom");
    expect(overlayCss).toContain(".session-meta");
    expect(overlayCss).toContain(".pet-layer");
    expect(overlayCss).toContain(".house-layer");
    expect(overlayCss).toContain("@keyframes walk-body");
    expect(overlayCss).toContain("@keyframes sit-settle");
    expect(overlayCss).toContain("@keyframes lie-down");
    expect(overlayCss).toContain("@keyframes sprite-alert");
    expect(overlayCss).toContain("@keyframes sprite-wag");
    expect(overlayCss).toContain("@keyframes heart-float");
    expect(overlayCss).toContain("@keyframes kennel-zzz");
  });

  it("includes a kennel button for minimized companion mode", () => {
    expect(overlayHtml).toContain('id="kennel"');
    expect(overlayHtml).toContain('class="kennel hidden"');
  });

  it("keeps desktop app controls out of the overlay because they live in the menu bar", () => {
    expect(overlayHtml).not.toContain('id="desktopControls"');
    expect(overlayHtml).not.toContain('id="desktopPanel"');
  });

  it("starts on the default Bori walking image", () => {
    expect(overlayHtml).toContain('id="petFrame" src="./assets/bori-walking.png"');
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
