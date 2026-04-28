import type { PetBehaviorState, SessionStatus } from "../session/types.js";

export type PetTemplateId = "bori" | "nabi" | "mochi";
export type HouseTemplateId = "small" | "medium" | "large";
export type PetPoseId =
  | "walking"
  | "sitting"
  | "tail-wagging"
  | "barking"
  | "rushing-bark"
  | "waiting"
  | "play-bow"
  | "roll-over"
  | "sniffing"
  | "sleeping";

export const dogTemplates: Array<{ id: PetTemplateId; label: string; house: HouseTemplateId }> = [
  { id: "bori", label: "Bori", house: "small" },
  { id: "nabi", label: "Nabi", house: "medium" },
  { id: "mochi", label: "Mochi", house: "large" },
];

export const houseTemplates: Array<{ id: HouseTemplateId; label: string }> = [
  { id: "small", label: "Small" },
  { id: "medium", label: "Medium" },
  { id: "large", label: "Large" },
];

export const petPoseIds: PetPoseId[] = [
  "walking",
  "sitting",
  "tail-wagging",
  "barking",
  "rushing-bark",
  "waiting",
  "play-bow",
  "roll-over",
  "sniffing",
  "sleeping",
];

export const petImageAssets = dogTemplates.flatMap((template) =>
  petPoseIds.map((pose) => `assets/${template.id}-${pose}.png`),
);
export const houseImageAssets = houseTemplates.map((template) => `assets/house-${template.id}.png`);

export function getHouseTemplateId(template: PetTemplateId): HouseTemplateId {
  const dog = dogTemplates.find((entry) => entry.id === template);
  return dog?.house ?? "small";
}

export function getPetImageSrc(template: PetTemplateId, pose: PetPoseId): string {
  return `./assets/${template}-${pose}.png`;
}

export function getHouseImageSrc(template: PetTemplateId): string {
  return `./assets/house-${getHouseTemplateId(template)}.png`;
}

export function getPetPoseForState(
  state: PetBehaviorState,
  context: { status?: SessionStatus; turn?: number } = {},
): PetPoseId {
  if (state === "alert") return context.status === "intervene" ? "rushing-bark" : "barking";
  if (state === "happy") return "tail-wagging";
  if (state === "petting") return "roll-over";
  if (state === "stretching") return "play-bow";
  if (state === "sniffing") return "sniffing";
  if (state === "sleepy" || state === "lying" || state === "kennel") return "sleeping";
  if (state === "sitting") return "sitting";
  if (state === "watching") return "waiting";
  return "walking";
}

export function resolvePetPoseForTemplate(template: PetTemplateId, pose: PetPoseId): PetPoseId {
  if (template === "bori" && pose === "sniffing") {
    return "waiting";
  }

  return pose;
}
