# Reference SVG Symbols Design

## Goal

Replace the current single morphing Bori SVG with a reference-faithful SVG sprite system based on the provided dog and dog-house images.

## Visual Direction

The new artwork should preserve the feel of the references:

- Pixel-art inspired black outlines, simple filled shapes, and clear silhouettes.
- Three dog templates:
  - `bori`: small Welsh corgi, orange coat, cream chest/muzzle, upright ears, short tail.
  - `nabi`: medium beagle, orange/brown coat, dark ears/back, cream muzzle/chest.
  - `mochi`: large samoyed, cream-white coat, fluffy tail, rounder body.
- Three dog houses:
  - Small orange-roof house for Bori.
  - Medium blue-roof house for Nabi.
  - Large brown-roof house for Mochi.

The implementation should be original SVG artwork inspired by the references, not embedded bitmap images.

## Behavior Model

Use pose-specific SVG symbols instead of deforming one dog drawing. Each behavior state maps to a distinct silhouette:

- `walking`: side walking pose.
- `sitting`: front sitting pose.
- `watching`: waiting/sitting pose.
- `happy`: play-bow or excited pose.
- `alert`: barking pose with a speech/bark mark.
- `sniffing`: head-down sniffing pose.
- `stretching`: play-bow/stretch pose.
- `sleepy` and `lying`: sleeping/lying pose.
- `petting`: happy/excited pose with tail motion.
- `kennel-entering` and `kennel-exiting`: walking pose moving through the dog-house door.

Animations should be clear but restrained. Avoid non-uniform scale transforms such as `scaleX()` or `scaleY()` on dog poses because they caused visual distortion. Use symbol swaps, small `translate()` movements, short rotations, opacity, and tail/head part animations where needed.

## Architecture

Create a focused overlay sprite module in `src/overlay/pet-sprites.ts`. It will export:

- Dog template ids and house ids.
- Pose ids.
- SVG symbol markup for the three dog templates and three house templates.
- A mapping from `PetBehaviorState` to pose ids.

The overlay markup should contain a sprite host (`<svg class="sprite-defs">`) and a visible pet stage using `<use>` references. The application code should update `data-template`, `data-pose`, and `href` values when the pet state changes.

## Interaction Requirements

Existing interaction behavior stays in place:

- Body hitbox sends Bori to the house.
- Non-body area drags the desktop window.
- Petting and hover reactions remain.
- Menu bar kennel actions still trigger enter/exit transitions.

House transitions should show the selected dog walking into and out of the matching house. The house must appear before the dog enters and remain visible while in kennel mode.

## Testing Requirements

Automated tests should verify:

- The overlay includes sprite definitions and uses symbol references rather than the old single Bori SVG groups.
- All three dog templates and all three house templates exist.
- Each supported behavior state maps to a pose.
- The CSS does not use dog-distorting non-uniform scale transforms for pose animation.
- Template changes select the matching dog and house assets.

Manual or browser verification should include:

- Bori/corgi pose silhouettes look close to the provided reference sheet.
- Dog houses match the three reference sizes/colors.
- Entering/exiting the house reads as walking into/out of the door.
- No grey backing or bitmap background appears behind the dog.
