import { describe, expect, it } from "vitest";
import { buildOverlayCommandScript, getOverlayCommandDelays } from "../src/desktop/overlay-command.js";

describe("desktop overlay commands", () => {
  it("retries commands long enough for the renderer to finish loading", () => {
    expect(getOverlayCommandDelays()).toEqual([0, 120, 360, 900]);
  });

  it("builds a browser-side command event fallback", () => {
    expect(buildOverlayCommandScript("enter-kennel")).toContain('command":"enter-kennel"');
    expect(buildOverlayCommandScript("set-template", "Bori")).toContain('value":"Bori"');
  });

  it("escapes command payloads before injecting them into the page", () => {
    expect(buildOverlayCommandScript("set-template", `"</script><script>alert(1)</script>`)).not.toContain("</script>");
  });
});
