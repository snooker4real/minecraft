// ============================================================
//  Terrain logic — pure block selection (no THREE, no chunks)
//  Depend: constants injected (BLOCK, BIOME, SEA_LEVEL)
//  Expose: makeTerrain
// ============================================================

function makeTerrain({ BLOCK, BIOME, SEA_LEVEL }) {
  const treeHash = (wx, wz) => { const s = Math.sin(wx*127.1 + wz*311.7) * 43758.5453; return s - Math.floor(s); };

  function shouldPlaceTree(biome, surfaceY, wx, wz) {
    if (surfaceY <= SEA_LEVEL) return false;
    const density = [0.025, 0.095, 0, 0.03, 0.012][biome] ?? 0.03;
    return density > 0 && treeHash(wx, wz) < density;
  }

  // Sous la couche de terre : pierre, avec filons selon la profondeur
  function deepBlock(y, sy, wx, wz) {
    const h  = treeHash(wx*3.1 + y,     wz*2.7 + y);
    const h2 = treeHash(wx*5.3 + y*1.7, wz*4.1 + y*2.3);
    if (h < 0.06)                                      return BLOCK.COAL;
    if (h < 0.1 && h2 < 0.45)                          return BLOCK.IRON_ORE;
    if (y < sy-8 && h < 0.13 && h2 < 0.35)             return BLOCK.GOLD_ORE;
    if (y < 5    && h < 0.14 && h2 < 0.25)             return BLOCK.DIAMOND_ORE;
    return BLOCK.STONE;
  }

  // Le bloc juste sous la surface
  function subsurfaceBlock(biome, sy) {
    if (biome === BIOME.DESERT) return BLOCK.SAND;
    if (biome === BIOME.TUNDRA || (biome === BIOME.MOUNTAIN && sy > SEA_LEVEL + 10)) return BLOCK.STONE;
    return BLOCK.DIRT;
  }

  function surfaceBlock(biome, sy) {
    if (sy <= SEA_LEVEL || biome === BIOME.DESERT) return BLOCK.SAND;
    if (biome === BIOME.TUNDRA) return BLOCK.SNOW;
    if (biome === BIOME.MOUNTAIN) return sy > SEA_LEVEL + 14 ? BLOCK.SNOW : BLOCK.GRASS;
    return BLOCK.GRASS;
  }

  // Minerai affleurant juste au-dessus du sol (rare)
  function outcropBlock(wx, wz) {
    const h = treeHash(wx*9.3 + 777, wz*6.7 + 333);
    if (h < 0.01)  return BLOCK.IRON_ORE;
    if (h < 0.015) return BLOCK.GOLD_ORE;
    if (h < 0.018) return BLOCK.DIAMOND_ORE;
    return BLOCK.AIR;
  }

  function columnBlock(y, sy, biome, wx, wz) {
    if (y === 0)       return BLOCK.STONE;
    if (y < sy - 4)    return deepBlock(y, sy, wx, wz);
    if (y < sy - 1)    return BLOCK.DIRT;
    if (y === sy - 1)  return subsurfaceBlock(biome, sy);
    if (y === sy)      return surfaceBlock(biome, sy);
    if (y === sy + 1 && sy > SEA_LEVEL && !shouldPlaceTree(biome, sy, wx, wz)) return outcropBlock(wx, wz);
    if (y <= SEA_LEVEL) return BLOCK.WATER;
    return BLOCK.AIR;
  }

  // Blocs d'un arbre planté en (wx, sy, wz) : [{x, y, z, block}]
  function treeBlocks(wx, sy, wz, biome) {
    const out = [];
    const put = (x, y, z, block) => out.push({ x, y, z, block });
    if (biome === BIOME.MOUNTAIN || biome === BIOME.TUNDRA) {
      const h = 5 + Math.floor(treeHash(wx + 0.5, wz + 0.7) * 4);
      for (let i = 0; i < h; i++) put(wx, sy + i, wz, BLOCK.WOOD);
      for (let dy = -2; dy <= 0; dy++) {
        const r = dy <= -2 ? 2 : dy === -1 ? 1 : 0;
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) === r && Math.abs(dz) === r) continue;
          put(wx + dx, sy + h + dy, wz + dz, BLOCK.LEAVES);
        }
      }
      put(wx, sy + h, wz, BLOCK.LEAVES);
    } else {
      const h = 4 + Math.floor(treeHash(wx + 0.3, wz + 0.9) * 3);
      for (let i = 0; i < h; i++) put(wx, sy + i, wz, BLOCK.WOOD);
      const top = sy + h;
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = -1; dy <= 1; dy++) {
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
        put(wx + dx, top + dy, wz + dz, BLOCK.LEAVES);
      }
      put(wx, top + 1, wz, BLOCK.LEAVES);
      [-1, 1].forEach(d => { put(wx + d, top + 1, wz, BLOCK.LEAVES); put(wx, top + 1, wz + d, BLOCK.LEAVES); });
    }
    return out;
  }

  return { treeHash, shouldPlaceTree, columnBlock, treeBlocks };
}

if (typeof module !== 'undefined') module.exports = { makeTerrain };
