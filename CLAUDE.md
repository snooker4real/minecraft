# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Game

No build step required. Open `index.html` directly in a browser. For local development, use any static file server:

```bash
npx serve .
# or
python3 -m http.server 8080
```

There are no tests, no linter, and no npm scripts configured.

## Architecture

This is a browser-based 3D Minecraft clone using **Three.js r128** (loaded from CDN). It uses plain `<script>` tags — no ES modules, no bundler. All files share a single global scope.

**Script load order (defined in `index.html`) is critical:**
1. `three.min.js` (CDN) — Three.js global `THREE`
2. `utils/constants.js` — game constants, `BLOCK`, `BLOCK_DEFS`, `TOOL`, `TOOL_DEFS`, `HOTBAR`, `BLOCK_HARDNESS`
3. `utils/textures.js` — procedural texture generation, exposes `TEXTURES` map and `buildTextures()`
4. `world.js` — chunk storage, terrain generation (Perlin noise), mesh building; exposes `getBlock`, `setBlock`, `buildWorldMesh`, `worldGroup`, `highlightMesh`
5. `player.js` — player state object, physics/collision (`checkCollision`), `initPlayer()`
6. `controls.js` — keyboard/mouse/pointer lock, block break/place logic, gamepad support; exposes `keys`, `locked`, `hotbarIndex`, `initControls()`
7. `mobs.js` — player health system, mob entities/AI; exposes `initMobs()`, `updateMobs(dt)`, `hurtPlayer()`
8. `game.js` — Three.js scene setup, HUD rendering, main `animate()` loop; calls all `init*()` functions and starts the loop

## Key Design Patterns

- **Global state**: All modules communicate via globals. `camera`, `scene`, `renderer` are defined in `game.js` but used in other modules (e.g. `player.js` references `camera` and `world` defined elsewhere).
- **World storage**: The world is chunk-based (`CHUNK_SIZE = 16`). Each chunk is a flat `Uint8Array` indexed by `(lx * WORLD_HEIGHT + ly) * CHUNK_SIZE + lz`. Chunks are generated lazily on access.
- **Block IDs**: `BLOCK.AIR = 0`, blocks 1–10, tools start at 100 (pickaxes 100–105, swords 200–205). The `isTool()`, `isPickaxe()`, `isSword()` helpers in `constants.js` classify hotbar items by ID range.
- **Textures**: All textures are procedurally generated at runtime via Canvas 2D API — no image assets. `buildTextures()` populates the `TEXTURES` map keyed by block ID, each entry has `{ top, bot, side }` Three.js textures.
- **UI language**: The UI is in French (menu labels, HUD text, block names in `BLOCK_DEFS`).
