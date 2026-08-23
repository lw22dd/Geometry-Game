---
name: canvas-collision-infer
description: Use when inferring collision geometry from Canvas 2D drawing code or syncing visual entities with AABB colliders.
---

# Canvas Collision Inference

Infer a practical collision shape from Canvas 2D rendering code, then write or review the collider. This is guidance, not a script: derive geometry from code, but treat gameplay tolerance as an explicit design choice.

## Workflow

1. Locate the entity factory and its draw function.
2. Confirm the `Position` origin: center, bottom-left, or another anchor.
3. Convert screen-space expressions back to world units; ignore camera transforms such as `sx`, `sy`, and pixel scale.
4. Extract primitive bounds from `fillRect`, `strokeRect`, `arc`, `moveTo`, and `lineTo`.
5. Compute the visual AABB from min/max world coordinates.
6. Choose a collision policy from the entity role.
7. Convert the chosen bounds into `w`, `h`, `ox`, and `oy`.
8. Verify the result against approach, edge, and anchor cases.

## Primitive Rules

- Rectangle: use the drawn `x`, `y`, `w`, and `h` when it is a solid platform or wall.
- Circle: use `2 * radius` for a tight AABB; enlarge only when collection or trigger feel requires it.
- Polygon: collect every world-space vertex and take `minX`, `maxX`, `minY`, and `maxY`.
- Rotated shape: use its world-space AABB unless the engine supports oriented or polygon colliders.
- Multiple draw calls: use the union of all gameplay-relevant primitives; ignore glow, shadow, and decoration.

## Collider Conversion

For visual bounds `(x, y, width, height)` and an entity position `(px, py)`:

```ts
const w = width;
const h = height;
const ox = x + width / 2 - px;
const oy = y + height / 2 - py;
world.add(entity, Collider, { w, h, ox, oy, solid });
```

Interpret `x` and `y` as the world-space bottom-left bounds used by this project. If the project uses a different origin, derive offsets from the actual anchor instead of assuming zero.

## Role Policy

- Solid platforms and walls: tight bounds; collision should match the visible blocking surface.
- Hazards: use a gameplay-safe inset when the visual shape has empty or decorative area; do not make the hitbox larger without a reason.
- Collectibles, checkpoints, and goals: use a generous trigger when the game intends forgiving activation.
- Player: use a stable gameplay collider independent of animation deformation.
- Decoration: no collider unless the design explicitly makes it interactive.

Do not infer gameplay intent from geometry alone. If the desired tolerance is unclear, report the tight AABB and one explicit shrink/expand alternative instead of silently guessing.

## Canvas Pitfalls

- Remove `sx`/`sy` and pixel-scale factors before calculating world dimensions.
- Check whether `Position` is a center, base, or corner anchor.
- Treat animation offsets such as bobbing as visual-only unless collision is meant to follow them.
- Rotation, clipping, stroke width, shadow blur, and glow do not automatically define collision bounds.
- A visual triangle or circle is still an AABB in an AABB-only engine; do not claim precise polygon or circle collision.
- For a rotated or concave shape, state that the AABB is an approximation and recommend a polygon collider only if the engine is extended.

## Output Contract

When asked to infer a collider, return:

1. The detected primitive and world-space bounds.
2. The assumed `Position` anchor.
3. The selected role policy and why.
4. The exact `Collider` values (`w`, `h`, `ox`, `oy`, `solid`).
5. Any ambiguity, visual-vs-gameplay tradeoff, and a verification case.

Prefer the smallest correct change. Keep rendering and collision data separate unless the project explicitly introduces a shared shape component.