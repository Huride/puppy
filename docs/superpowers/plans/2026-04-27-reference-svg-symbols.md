# Reference SVG Symbols Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current morphing dog SVG with reference-faithful pose-specific SVG symbols for three dogs and three matching dog houses.

**Architecture:** Add `src/overlay/pet-sprites.ts` as the artwork and pose mapping boundary, then update the overlay DOM and app state rendering to use `<use>` references into those symbols. CSS will animate symbol-level movement and small part motions only, avoiding non-uniform dog scaling.

**Tech Stack:** TypeScript, static HTML/SVG, CSS animations, Vitest, existing Electron overlay app.

---

## File Structure

- Create `src/overlay/pet-sprites.ts`: exports template ids, house ids, pose ids, SVG symbol strings, and mapping helpers.
- Modify `src/overlay/index.html`: replace the old inline Bori drawing with a sprite host and visible `<use>` layers.
- Modify `src/overlay/app.ts`: initialize sprites, update pose/template/house `href` values in `setPetState()` and `applyTemplate()`.
- Modify `src/overlay/styles.css`: replace old single-dog part animations with sprite-stage animations and house transition styling.
- Modify `tests/overlay-markup.test.ts`: assert sprite host, symbol names, house names, and no old SVG artifacts.
- Modify `tests/overlay-presenter.test.ts`: assert behavior-to-pose coverage if helper is exported from presenter; otherwise add a new sprite test.
- Create `tests/pet-sprites.test.ts`: validates exported sprite mapping and template/house pairing.

### Task 1: Sprite Mapping Module

**Files:**
- Create: `src/overlay/pet-sprites.ts`
- Create: `tests/pet-sprites.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  dogTemplates,
  getHouseSymbolId,
  getPetPoseForState,
  getPetSymbolId,
  houseTemplates,
  petPoseSymbols,
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
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/pet-sprites.test.ts`

Expected: FAIL because `src/overlay/pet-sprites.ts` does not exist.

- [ ] **Step 3: Implement the module**

Create `src/overlay/pet-sprites.ts` with:

```ts
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

export const petPoseSymbols = dogTemplates.flatMap((template) =>
  petPoseIds.map((pose) => getPetSymbolId(template.id, pose)),
);

export const houseSymbols = houseTemplates.map((template) => `house-${template.id}`);

export function getPetSymbolId(template: PetTemplateId, pose: PetPoseId): string {
  return `dog-${template}-${pose}`;
}

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

export const petSpriteMarkup = "";
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/pet-sprites.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/overlay/pet-sprites.ts tests/pet-sprites.test.ts
git commit -m "Add pet sprite mapping"
```

### Task 2: Reference-Faithful SVG Symbols

**Files:**
- Modify: `src/overlay/pet-sprites.ts`
- Modify: `tests/pet-sprites.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test to `tests/pet-sprites.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/pet-sprites.test.ts`

Expected: FAIL because `petSpriteMarkup` is empty.

- [ ] **Step 3: Add SVG symbol markup**

Replace `export const petSpriteMarkup = "";` in `src/overlay/pet-sprites.ts` with a template string containing:

- `<symbol id="dog-bori-walking" viewBox="0 0 120 90">...</symbol>`
- `<symbol id="dog-bori-sitting" viewBox="0 0 120 90">...</symbol>`
- `<symbol id="dog-bori-tail-wagging" viewBox="0 0 120 90">...</symbol>`
- `<symbol id="dog-bori-barking" viewBox="0 0 120 90">...</symbol>`
- `<symbol id="dog-bori-rushing-bark" viewBox="0 0 120 90">...</symbol>`
- `<symbol id="dog-bori-waiting" viewBox="0 0 120 90">...</symbol>`
- `<symbol id="dog-bori-play-bow" viewBox="0 0 120 90">...</symbol>`
- `<symbol id="dog-bori-roll-over" viewBox="0 0 120 90">...</symbol>`
- `<symbol id="dog-bori-sniffing" viewBox="0 0 120 90">...</symbol>`
- `<symbol id="dog-bori-sleeping" viewBox="0 0 120 90">...</symbol>`

Repeat the same pose ids for `nabi` and `mochi`, changing coat classes and proportions to match beagle and samoyed references. Also add:

- `<symbol id="house-small" viewBox="0 0 180 140">...</symbol>`
- `<symbol id="house-medium" viewBox="0 0 200 155">...</symbol>`
- `<symbol id="house-large" viewBox="0 0 230 170">...</symbol>`

Use these shared class names throughout the SVG:

```html
class="dog-outline"
class="dog-thin-line"
class="coat coat-bori"
class="coat coat-nabi"
class="coat coat-mochi"
class="cream"
class="dark-patch"
class="inner-ear"
class="pixel-speech"
class="house-roof house-roof-orange"
class="house-roof house-roof-blue"
class="house-roof house-roof-brown"
class="house-wall"
class="house-door"
class="house-grass"
```

Keep the markup original but follow the reference proportions:

- Corgi: short legs, long body, upright ears.
- Beagle: medium legs, floppy ears, dark saddle.
- Samoyed: large fluffy body, curled tail, cream-white coat.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/pet-sprites.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/overlay/pet-sprites.ts tests/pet-sprites.test.ts
git commit -m "Add reference SVG sprite symbols"
```

### Task 3: Overlay Markup Integration

**Files:**
- Modify: `src/overlay/index.html`
- Modify: `src/overlay/app.ts`
- Modify: `tests/overlay-markup.test.ts`

- [ ] **Step 1: Write the failing markup test**

Add this to `tests/overlay-markup.test.ts`:

```ts
it("renders sprite-based dog and house layers", () => {
  expect(overlayHtml).toContain('id="petSpriteDefs"');
  expect(overlayHtml).toContain('id="petUse"');
  expect(overlayHtml).toContain('id="houseUse"');
  expect(overlayHtml).toContain('class="pet-stage"');
  expect(overlayHtml).not.toContain('class="pet-soft-outline"');
  expect(overlayHtml).not.toContain('class="sweater"');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/overlay-markup.test.ts`

Expected: FAIL because the old inline SVG is still present.

- [ ] **Step 3: Replace overlay SVG structure**

In `src/overlay/index.html`, replace the current `<svg class="pet-art" ...>` content with:

```html
<svg class="sprite-defs" id="petSpriteDefs" aria-hidden="true"></svg>
<svg class="pet-stage" id="petArt" viewBox="0 0 240 190" role="img" aria-label="Pawtrol dog companion">
  <use class="house-layer hidden" id="houseUse" href="#house-small"></use>
  <use class="pet-layer" id="petUse" href="#dog-bori-walking"></use>
  <g class="motion-lines" aria-hidden="true">
    <path d="M34 60 L16 54" />
    <path d="M33 75 L11 76" />
    <path d="M38 90 L18 101" />
  </g>
</svg>
```

- [ ] **Step 4: Initialize sprite definitions in app code**

In `src/overlay/app.ts`, import:

```ts
import {
  getHouseSymbolId,
  getPetPoseForState,
  getPetSymbolId,
  petSpriteMarkup,
  type PetTemplateId,
} from "./pet-sprites.js";
```

Add required elements:

```ts
const petSpriteDefs = requireElement<SVGSVGElement>("petSpriteDefs");
const petUse = requireElement<SVGUseElement>("petUse");
const houseUse = requireElement<SVGUseElement>("houseUse");
```

Add template state:

```ts
let activeTemplate: PetTemplateId = "bori";
petSpriteDefs.innerHTML = petSpriteMarkup;
```

Update `applyTemplate()` so it sets `activeTemplate`, body `data-template`, house `href`, and current dog `href`.

Update `setPetState()` so it computes:

```ts
const pose = getPetPoseForState(state);
petUse.setAttribute("href", `#${getPetSymbolId(activeTemplate, pose)}`);
houseUse.setAttribute("href", `#${getHouseSymbolId(activeTemplate)}`);
```

- [ ] **Step 5: Run the markup test**

Run: `npm test -- tests/overlay-markup.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/overlay/index.html src/overlay/app.ts tests/overlay-markup.test.ts
git commit -m "Render sprite based pet layers"
```

### Task 4: CSS Animation Replacement

**Files:**
- Modify: `src/overlay/styles.css`
- Modify: `tests/overlay-markup.test.ts`

- [ ] **Step 1: Write the failing CSS test**

Add this to `tests/overlay-markup.test.ts`:

```ts
it("uses sprite-stage animations without dog-distorting scale transforms", () => {
  expect(overlayCss).toContain(".pet-layer");
  expect(overlayCss).toContain(".house-layer");
  expect(overlayCss).toContain("@keyframes sprite-walk");
  expect(overlayCss).toContain("@keyframes sprite-bark");
  expect(overlayCss).toContain("@keyframes sprite-house-in");
  expect(overlayCss).not.toMatch(/\\.body\\s+ellipse/);
  expect(overlayCss).not.toMatch(/\\.head\\s+circle/);
  expect(overlayCss).not.toMatch(/scaleX\\(|scaleY\\(/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/overlay-markup.test.ts`

Expected: FAIL because old SVG part selectors remain.

- [ ] **Step 3: Replace old dog CSS**

Remove CSS tied to old parts:

- `.body ellipse`
- `.head circle`
- `.leg path`
- `.chest`
- `.muzzle`
- `.ear`
- `.cheek`
- `.eye`
- `.nose`
- `.brow`
- `.mouth`
- `.fur`
- `.sweater`
- `.tail path`
- `.front-leg`
- `.hind-leg`
- `.bark-mark`
- old keyframes that depend on those parts.

Add sprite CSS:

```css
.sprite-defs {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}

.pet-stage {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.dog-outline {
  stroke: #17120f;
  stroke-width: 3.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.dog-thin-line {
  fill: none;
  stroke: #17120f;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.coat-bori {
  fill: #d97020;
}

.coat-nabi {
  fill: #c4742f;
}

.coat-mochi {
  fill: #fff2df;
}

.cream {
  fill: #fff1df;
}

.dark-patch {
  fill: #5b3826;
}

.inner-ear {
  fill: #ff9a68;
}

.pet-layer {
  transform-origin: 112px 142px;
}

.house-layer {
  transform-origin: 120px 160px;
}

.house-layer.hidden {
  opacity: 0;
}

.pet.walking .pet-layer {
  animation: sprite-walk 0.9s steps(2, end) infinite;
}

.pet.alert .pet-layer {
  animation: sprite-bark 0.42s steps(2, end) infinite;
}

.pet.happy .pet-layer,
.pet.petting .pet-layer {
  animation: sprite-hop 0.55s ease-in-out infinite;
}

.pet.sniffing .pet-layer {
  animation: sprite-sniff 1s ease-in-out infinite;
}

.pet.sleepy .pet-layer,
.pet.lying .pet-layer {
  animation: sprite-sleep 2.2s ease-in-out infinite;
}

.pet.kennel-entering .pet-layer {
  animation: sprite-house-in 0.92s ease-in forwards;
}

.pet.kennel-exiting .pet-layer {
  animation: sprite-house-out 0.92s ease-out forwards;
}

@keyframes sprite-walk {
  0%,
  100% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(-5px, -1px);
  }
}

@keyframes sprite-bark {
  0%,
  100% {
    transform: translate(0, 0) rotate(0deg);
  }
  50% {
    transform: translate(-3px, -2px) rotate(-2deg);
  }
}

@keyframes sprite-hop {
  0%,
  100% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(0, -5px);
  }
}

@keyframes sprite-sniff {
  0%,
  100% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(-4px, 3px);
  }
}

@keyframes sprite-sleep {
  0%,
  100% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(1px, 1px);
  }
}

@keyframes sprite-house-in {
  0% {
    transform: translate(-92px, 0);
    opacity: 1;
  }
  70% {
    transform: translate(24px, 24px) scale(0.42);
    opacity: 1;
  }
  100% {
    transform: translate(36px, 30px) scale(0.2);
    opacity: 0;
  }
}

@keyframes sprite-house-out {
  0% {
    transform: translate(36px, 30px) scale(0.2);
    opacity: 0;
  }
  25% {
    transform: translate(24px, 24px) scale(0.42);
    opacity: 1;
  }
  100% {
    transform: translate(-92px, 0);
    opacity: 1;
  }
}
```

The `scale()` in house transitions is uniform scale and is allowed because the dog is moving into depth, not being squashed.

- [ ] **Step 4: Run CSS tests**

Run: `npm test -- tests/overlay-markup.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/overlay/styles.css tests/overlay-markup.test.ts
git commit -m "Replace dog animations with sprite stage motion"
```

### Task 5: Template and House Integration Tests

**Files:**
- Modify: `src/overlay/app.ts`
- Modify: `tests/overlay-presenter.test.ts` or create `tests/overlay-sprites-app.test.ts`

- [ ] **Step 1: Write tests for template mapping behavior**

If app DOM testing is not available, keep this in `tests/pet-sprites.test.ts`:

```ts
it("pairs each dog template with the matching reference house", () => {
  const expected = [
    ["bori", "dog-bori-walking", "house-small"],
    ["nabi", "dog-nabi-walking", "house-medium"],
    ["mochi", "dog-mochi-walking", "house-large"],
  ] as const;

  for (const [template, dogSymbol, houseSymbol] of expected) {
    expect(getPetSymbolId(template, "walking")).toBe(dogSymbol);
    expect(getHouseSymbolId(template)).toBe(houseSymbol);
  }
});
```

- [ ] **Step 2: Run targeted sprite tests**

Run: `npm test -- tests/pet-sprites.test.ts tests/overlay-markup.test.ts`

Expected: PASS.

- [ ] **Step 3: Confirm app code updates house visibility during kennel transitions**

Read `src/overlay/app.ts` and ensure:

- `enterKennelMode()` removes `hidden` from `houseUse` or its parent layer before adding `kennel-entering`.
- `exitKennelMode()` keeps the house visible until the exit animation completes.
- active mode keeps the house hidden unless entering/exiting.

- [ ] **Step 4: Commit if any app updates were needed**

```bash
git add src/overlay/app.ts tests/pet-sprites.test.ts
git commit -m "Pair dog templates with reference houses"
```

### Task 6: Full Verification and Release Prep

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Run build**

Run: `npm run build`

Expected: `tsc` passes and overlay files copy into `dist/src/overlay`.

- [ ] **Step 2: Run full tests**

Run: `npm test`

Expected: all Vitest suites pass. If overlay-server tests fail with `listen EPERM` inside sandbox, rerun with elevated permissions.

- [ ] **Step 3: Run app package check**

Run: `npm run app:pack`

Expected: Electron builder packages the macOS app directory without test failures.

- [ ] **Step 4: Run npm pack dry-run**

Run: `npm pack --dry-run`

Expected: tarball lists `dist/src/overlay/app.js`, `dist/src/overlay/pet-sprites.js`, `dist/src/overlay/index.html`, and `dist/src/overlay/styles.css`.

- [ ] **Step 5: Bump package version**

Run: `npm version patch --no-git-tag-version`

Expected: version increments from the current npm latest.

- [ ] **Step 6: Commit release candidate**

```bash
git add package.json package-lock.json
git commit -m "Bump version for reference sprite release"
```

## Self-Review

- Spec coverage: dog templates, house templates, pose mapping, no non-uniform distortion, kennel transitions, and tests are covered.
- Placeholder scan: no placeholder task remains; each task includes exact files and commands.
- Type consistency: `PetTemplateId`, `HouseTemplateId`, and `PetPoseId` are introduced before later tasks use them.
