import { describe, expect, it } from "vitest";
import {
  dogTemplates,
  getHouseImageSrc,
  getHouseTemplateId,
  getPetImageSrc,
  getPetPoseForState,
  houseTemplates,
  houseImageAssets,
  petImageAssets,
  petPoseIds,
} from "../src/overlay/pet-sprites.js";

describe("pet sprites", () => {
  it("defines three reference dog templates and three matching houses", () => {
    expect(dogTemplates.map((template) => template.id)).toEqual(["bori", "nabi", "mochi"]);
    expect(houseTemplates.map((template) => template.id)).toEqual(["small", "medium", "large"]);
    expect(getHouseTemplateId("bori")).toBe("small");
    expect(getHouseTemplateId("nabi")).toBe("medium");
    expect(getHouseTemplateId("mochi")).toBe("large");
  });

  it("maps every overlay behavior state to a concrete pose symbol", () => {
    expect(getPetPoseForState("walking")).toBe("walking");
    expect(getPetPoseForState("sitting")).toBe("sitting");
    expect(getPetPoseForState("watching")).toBe("waiting");
    expect(getPetPoseForState("happy")).toBe("tail-wagging");
    expect(getPetPoseForState("alert")).toBe("barking");
    expect(getPetPoseForState("alert", { status: "intervene" })).toBe("rushing-bark");
    expect(getPetPoseForState("sniffing")).toBe("sniffing");
    expect(getPetPoseForState("stretching")).toBe("play-bow");
    expect(getPetPoseForState("sleepy")).toBe("sleeping");
    expect(getPetPoseForState("lying")).toBe("sleeping");
    expect(getPetPoseForState("petting")).toBe("roll-over");
    expect(getPetPoseForState("kennel")).toBe("sleeping");
  });

  it("builds stable raster asset paths for every pose and matching houses", () => {
    expect(getPetImageSrc("bori", "walking")).toBe("./assets/bori-walking.png");
    expect(getPetImageSrc("nabi", "sniffing")).toBe("./assets/nabi-sniffing.png");
    expect(getPetImageSrc("mochi", "sleeping")).toBe("./assets/mochi-sleeping.png");
    expect(getHouseImageSrc("bori")).toBe("./assets/house-small.png");
    expect(getHouseImageSrc("nabi")).toBe("./assets/house-medium.png");
    expect(getHouseImageSrc("mochi")).toBe("./assets/house-large.png");
  });

  it("exports an image asset for every dog pose and house", () => {
    for (const pose of petPoseIds) {
      expect(petImageAssets).toContain(`assets/bori-${pose}.png`);
      expect(petImageAssets).toContain(`assets/nabi-${pose}.png`);
      expect(petImageAssets).toContain(`assets/mochi-${pose}.png`);
    }

    expect(houseImageAssets).toEqual(["assets/house-small.png", "assets/house-medium.png", "assets/house-large.png"]);
  });
});
