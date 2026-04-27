import { describe, expect, it } from "vitest";
import {
  dogTemplates,
  getHouseSymbolId,
  getPetPoseForState,
  getPetSymbolId,
  houseTemplates,
  houseSymbols,
  petPoseSymbols,
  petSpriteMarkup,
} from "../src/overlay/pet-sprites.js";

describe("pet sprites", () => {
  it("defines three reference dog templates and three matching houses", () => {
    expect(dogTemplates.map((template) => template.id)).toEqual(["bori", "nabi", "mochi"]);
    expect(houseTemplates.map((template) => template.id)).toEqual(["small", "medium", "large"]);
    expect(getHouseSymbolId("bori")).toBe("house-small");
    expect(getHouseSymbolId("nabi")).toBe("house-medium");
    expect(getHouseSymbolId("mochi")).toBe("house-large");
  });

  it("maps every overlay behavior state to a concrete pose symbol", () => {
    expect(getPetPoseForState("walking")).toBe("walking");
    expect(getPetPoseForState("sitting")).toBe("sitting");
    expect(getPetPoseForState("watching")).toBe("waiting");
    expect(getPetPoseForState("happy")).toBe("play-bow");
    expect(getPetPoseForState("alert")).toBe("barking");
    expect(getPetPoseForState("sniffing")).toBe("sniffing");
    expect(getPetPoseForState("stretching")).toBe("play-bow");
    expect(getPetPoseForState("sleepy")).toBe("sleeping");
    expect(getPetPoseForState("lying")).toBe("sleeping");
    expect(getPetPoseForState("petting")).toBe("play-bow");
    expect(getPetPoseForState("kennel")).toBe("sleeping");
  });

  it("builds stable dog symbol ids for each template and pose", () => {
    expect(getPetSymbolId("bori", "walking")).toBe("dog-bori-walking");
    expect(getPetSymbolId("nabi", "sniffing")).toBe("dog-nabi-sniffing");
    expect(getPetSymbolId("mochi", "sleeping")).toBe("dog-mochi-sleeping");
    expect(petPoseSymbols).toContain("dog-bori-walking");
    expect(petPoseSymbols).toContain("dog-nabi-barking");
    expect(petPoseSymbols).toContain("dog-mochi-play-bow");
  });

  it("contains reference-style SVG symbols for dogs and houses", () => {
    expect(petSpriteMarkup).toContain('<symbol id="dog-bori-walking"');
    expect(petSpriteMarkup).toContain('<symbol id="dog-bori-sitting"');
    expect(petSpriteMarkup).toContain('<symbol id="dog-nabi-barking"');
    expect(petSpriteMarkup).toContain('<symbol id="dog-mochi-sleeping"');
    expect(petSpriteMarkup).toContain('<symbol id="house-small"');
    expect(petSpriteMarkup).toContain('<symbol id="house-medium"');
    expect(petSpriteMarkup).toContain('<symbol id="house-large"');
    expect(petSpriteMarkup).toContain('class="dog-outline"');
    expect(petSpriteMarkup).toContain('class="pixel-speech"');
    expect(petSpriteMarkup).toContain('class="house-roof house-roof-orange"');
  });

  it("includes every exported dog pose and house symbol in the markup", () => {
    for (const symbolId of petPoseSymbols) {
      expect(petSpriteMarkup).toContain(`<symbol id="${symbolId}"`);
    }

    for (const symbolId of houseSymbols) {
      expect(petSpriteMarkup).toContain(`<symbol id="${symbolId}"`);
    }
  });
});
