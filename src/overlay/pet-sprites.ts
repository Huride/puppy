import type { PetBehaviorState } from "../session/types.js";

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

export function getPetSymbolId(template: PetTemplateId, pose: PetPoseId): string {
  return `dog-${template}-${pose}`;
}

export const petPoseSymbols = dogTemplates.flatMap((template) =>
  petPoseIds.map((pose) => getPetSymbolId(template.id, pose)),
);

export const houseSymbols = houseTemplates.map((template) => `house-${template.id}`);

export function getHouseSymbolId(template: PetTemplateId): string {
  const dog = dogTemplates.find((entry) => entry.id === template);
  return `house-${dog?.house ?? "small"}`;
}

export function getPetPoseForState(state: PetBehaviorState): PetPoseId {
  if (state === "alert") return "barking";
  if (state === "happy" || state === "petting" || state === "stretching") return "play-bow";
  if (state === "sniffing") return "sniffing";
  if (state === "sleepy" || state === "lying" || state === "kennel") return "sleeping";
  if (state === "sitting") return "sitting";
  if (state === "watching") return "waiting";
  return "walking";
}

type DogArt = {
  coatClass: "coat-bori" | "coat-nabi" | "coat-mochi";
  body: { x: number; y: number; width: number; height: number; rx: number };
  head: { x: number; y: number; width: number; height: number; rx: number };
  leg: { y: number; height: number };
  ear: "upright" | "floppy" | "round";
  tail: "short" | "straight" | "curled";
};

const dogArt: Record<PetTemplateId, DogArt> = {
  bori: {
    coatClass: "coat-bori",
    body: { x: 28, y: 40, width: 52, height: 24, rx: 8 },
    head: { x: 72, y: 28, width: 26, height: 24, rx: 7 },
    leg: { y: 58, height: 16 },
    ear: "upright",
    tail: "short",
  },
  nabi: {
    coatClass: "coat-nabi",
    body: { x: 24, y: 36, width: 58, height: 29, rx: 10 },
    head: { x: 72, y: 27, width: 28, height: 26, rx: 8 },
    leg: { y: 59, height: 19 },
    ear: "floppy",
    tail: "straight",
  },
  mochi: {
    coatClass: "coat-mochi",
    body: { x: 20, y: 32, width: 65, height: 34, rx: 14 },
    head: { x: 72, y: 24, width: 32, height: 30, rx: 12 },
    leg: { y: 59, height: 20 },
    ear: "round",
    tail: "curled",
  },
};

function earMarkup(art: DogArt): string {
  if (art.ear === "floppy") {
    return `
      <path class="dog-outline dark-patch" d="M76 30h-8v20h9l5-13z"/>
      <path class="dog-thin-line inner-ear" d="M73 34v12"/>`;
  }

  if (art.ear === "round") {
    return `
      <path class="dog-outline cream" d="M76 26h-9v11h10z"/>
      <path class="dog-outline cream" d="M94 26h9v12h-11z"/>`;
  }

  return `
    <path class="dog-outline coat ${art.coatClass}" d="M76 28l-5-15 14 10z"/>
    <path class="dog-outline coat ${art.coatClass}" d="M92 28l8-14 5 17z"/>
    <path class="dog-thin-line inner-ear" d="M78 24l-2-6"/>
    <path class="dog-thin-line inner-ear" d="M96 24l4-6"/>`;
}

function tailMarkup(art: DogArt, pose: PetPoseId): string {
  const wag = pose === "tail-wagging" || pose === "play-bow";

  if (art.tail === "curled") {
    return `
      <path class="dog-outline coat ${art.coatClass}" d="M22 40c-16-8-10-25 6-22 13 3 10 19-2 16-5-1-7-5-4-9"/>`;
  }

  if (art.tail === "straight") {
    return `
      <path class="dog-outline coat ${art.coatClass}" d="${wag ? "M27 41l-17-14 4-7 20 13z" : "M27 43L8 38l2-8 22 5z"}"/>`;
  }

  return `
    <path class="dog-outline coat ${art.coatClass}" d="${wag ? "M31 45l-15-13 5-6 16 13z" : "M31 48H16v-8h17z"}"/>`;
}

function standingLegsMarkup(art: DogArt, pose: PetPoseId): string {
  const leftLift = pose === "walking" || pose === "rushing-bark";
  const frontBend = pose === "sniffing";
  const rearY = art.leg.y;
  const frontY = frontBend ? art.leg.y + 3 : art.leg.y;

  return `
    <path class="dog-outline coat ${art.coatClass}" d="M36 ${rearY}h9v${art.leg.height}h-12v-${leftLift ? 9 : art.leg.height}z"/>
    <path class="dog-outline coat ${art.coatClass}" d="M62 ${frontY}h9v${art.leg.height}h-12v-${leftLift ? art.leg.height : 10}z"/>
    <path class="dog-outline coat ${art.coatClass}" d="M49 ${rearY}h8v${art.leg.height - 2}h-11v-${leftLift ? art.leg.height - 2 : 8}z"/>
    <path class="dog-outline cream" d="M74 ${frontY}h8v${art.leg.height - 1}h-11v-${frontBend ? 10 : art.leg.height - 1}z"/>`;
}

function faceMarkup(pose: PetPoseId): string {
  const eye = pose === "sleeping" || pose === "roll-over" ? "M84 39h7" : "M86 38h3v3h-3z";
  const mouth = pose === "barking" || pose === "rushing-bark" ? "M96 44h10v5H96z" : "M96 45h7";

  return `
    <path class="dog-outline cream" d="M88 40h17v12H89z"/>
    <path class="dog-thin-line" d="${eye}"/>
    <path class="dog-thin-line" d="${mouth}"/>
    <path class="dog-outline" d="M101 41h4v4h-4z"/>`;
}

function speechMarkup(pose: PetPoseId): string {
  if (pose !== "barking" && pose !== "rushing-bark") return "";

  return `
    <g class="pixel-speech">
      <path d="M102 14h9v7h-9z"/>
      <path d="M114 8h6v13h-6z"/>
      <path d="M96 20h5v5h-5z"/>
    </g>`;
}

function dogSymbolMarkup(template: PetTemplateId, pose: PetPoseId): string {
  const art = dogArt[template];
  const bodyY = pose === "play-bow" || pose === "sniffing" ? art.body.y + 7 : art.body.y;
  const headY =
    pose === "sniffing" ? art.head.y + 16 : pose === "play-bow" ? art.head.y + 11 : art.head.y;
  const headX = pose === "sniffing" ? art.head.x + 7 : art.head.x;

  if (pose === "sitting" || pose === "waiting") {
    return `
  <symbol id="${getPetSymbolId(template, pose)}" viewBox="0 0 120 90">
    <g class="dog-outline">
      <path class="dog-outline coat ${art.coatClass}" d="M39 43h38l10 23-8 13H38l-9-13z"/>
      <path class="dog-outline cream" d="M48 51h25l6 22H42z"/>
      <path class="dog-outline coat ${art.coatClass}" d="M31 61h12v17H29z"/>
      <path class="dog-outline cream" d="M75 61h13v17H73z"/>
      ${tailMarkup(art, pose)}
      ${earMarkup(art)}
      <rect class="dog-outline coat ${art.coatClass}" x="72" y="27" width="${art.head.width}" height="${art.head.height}" rx="${art.head.rx}"/>
      ${template === "nabi" ? '<path class="dog-outline dark-patch" d="M34 42h31v14H38z"/>' : ""}
      ${faceMarkup(pose)}
    </g>
  </symbol>`;
  }

  if (pose === "sleeping" || pose === "roll-over") {
    return `
  <symbol id="${getPetSymbolId(template, pose)}" viewBox="0 0 120 90">
    <g class="dog-outline">
      <path class="dog-outline coat ${art.coatClass}" d="M24 52h60c10 0 17 6 17 14s-6 13-18 13H25c-10 0-17-5-17-13s6-14 16-14z"/>
      <path class="dog-outline cream" d="M56 58h33v14H54z"/>
      ${template === "nabi" ? '<path class="dog-outline dark-patch" d="M24 52h35v13H22z"/>' : ""}
      ${tailMarkup(art, pose)}
      <path class="dog-outline coat ${art.coatClass}" d="M73 38h27v23H74z"/>
      ${earMarkup(art)}
      ${faceMarkup(pose)}
      <path class="dog-thin-line" d="M19 78h85"/>
    </g>
  </symbol>`;
  }

  return `
  <symbol id="${getPetSymbolId(template, pose)}" viewBox="0 0 120 90">
    <g class="dog-outline">
      ${tailMarkup(art, pose)}
      <rect class="dog-outline coat ${art.coatClass}" x="${art.body.x}" y="${bodyY}" width="${art.body.width}" height="${art.body.height}" rx="${art.body.rx}"/>
      ${template === "nabi" ? `<path class="dog-outline dark-patch" d="M${art.body.x + 5} ${bodyY}h32v14H${art.body.x + 8}z"/>` : ""}
      ${template === "mochi" ? `<path class="dog-thin-line cream" d="M${art.body.x + 9} ${bodyY + 7}h45M${art.body.x + 13} ${bodyY + 16}h39"/>` : ""}
      ${standingLegsMarkup(art, pose)}
      ${earMarkup(art)}
      <rect class="dog-outline coat ${art.coatClass}" x="${headX}" y="${headY}" width="${art.head.width}" height="${art.head.height}" rx="${art.head.rx}"/>
      ${faceMarkup(pose)}
      ${speechMarkup(pose)}
    </g>
  </symbol>`;
}

function houseSymbolMarkup(template: HouseTemplateId): string {
  const config = {
    small: { view: "0 0 180 140", wall: "40 55 100 64", roof: "M28 62l62-46 62 46z", roofClass: "house-roof-orange", door: "76 78 28 41", grass: "20 119h140" },
    medium: { view: "0 0 200 155", wall: "42 60 116 73", roof: "M28 69l72-52 72 52z", roofClass: "house-roof-blue", door: "82 86 34 47", grass: "18 133h164" },
    large: { view: "0 0 230 170", wall: "45 66 140 82", roof: "M26 77l89-61 89 61z", roofClass: "house-roof-brown", door: "95 96 40 52", grass: "16 148h198" },
  }[template];

  return `
  <symbol id="house-${template}" viewBox="${config.view}">
    <path class="house-grass" d="M${config.grass}" />
    <rect class="dog-outline house-wall" x="${config.wall.split(" ")[0]}" y="${config.wall.split(" ")[1]}" width="${config.wall.split(" ")[2]}" height="${config.wall.split(" ")[3]}" rx="4"/>
    <path class="house-roof ${config.roofClass}" d="${config.roof}"/>
    <rect class="dog-outline house-door" x="${config.door.split(" ")[0]}" y="${config.door.split(" ")[1]}" width="${config.door.split(" ")[2]}" height="${config.door.split(" ")[3]}" rx="10"/>
    <path class="dog-thin-line" d="M${config.door.split(" ")[0]} ${Number(config.door.split(" ")[1]) + 18}h${config.door.split(" ")[2]}"/>
  </symbol>`;
}

export const petSpriteMarkup = `
<defs>
${dogTemplates
  .flatMap((template) => petPoseIds.map((pose) => dogSymbolMarkup(template.id, pose)))
  .join("")}
${houseTemplates.map((template) => houseSymbolMarkup(template.id)).join("")}
</defs>`;
