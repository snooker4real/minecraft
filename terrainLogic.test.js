import { describe, expect, it } from 'vitest';
import { makeTerrain } from './terrainLogic';

const BLOCK = { AIR: 0, STONE: 1, DIRT: 2, GRASS: 3, SAND: 4, SNOW: 5, WATER: 6, WOOD: 7, LEAVES: 8, COAL: 9, IRON_ORE: 10, GOLD_ORE: 11, DIAMOND_ORE: 12 };
const BIOME = { PLAINS: 0, FOREST: 1, DESERT: 2, MOUNTAIN: 3, TUNDRA: 4 };
const SEA_LEVEL = 6, WORLD_HEIGHT = 24;
const T = makeTerrain({ BLOCK, BIOME, SEA_LEVEL });

// Transcription de l'ancienne boucle de _genColumn (world.js), gardée comme référence
function reference(wx, wz, biome, sy) {
  const { treeHash, shouldPlaceTree } = T;
  const col = [];
  for (let y = 0; y < WORLD_HEIGHT; y++) {
    let b = BLOCK.AIR;
    if (y === 0) b = BLOCK.STONE;
    else if (y < sy - 4) {
      const h = treeHash(wx*3.1 + y, wz*2.7 + y), h2 = treeHash(wx*5.3 + y*1.7, wz*4.1 + y*2.3);
      if (h < 0.06) b = BLOCK.COAL;
      else if (h < 0.1 && h2 < 0.45) b = BLOCK.IRON_ORE;
      else if (y < sy-8 && h < 0.13 && h2 < 0.35) b = BLOCK.GOLD_ORE;
      else if (y < 5 && h < 0.14 && h2 < 0.25) b = BLOCK.DIAMOND_ORE;
      else b = BLOCK.STONE;
    } else if (y < sy - 1) b = BLOCK.DIRT;
    else if (y === sy - 1) {
      b = biome === BIOME.DESERT ? BLOCK.SAND
        : (biome === BIOME.TUNDRA || (biome === BIOME.MOUNTAIN && sy > SEA_LEVEL + 10)) ? BLOCK.STONE : BLOCK.DIRT;
    } else if (y === sy) {
      if (sy <= SEA_LEVEL) b = BLOCK.SAND;
      else if (biome === BIOME.DESERT) b = BLOCK.SAND;
      else if (biome === BIOME.TUNDRA) b = BLOCK.SNOW;
      else if (biome === BIOME.MOUNTAIN) b = sy > SEA_LEVEL + 14 ? BLOCK.SNOW : BLOCK.GRASS;
      else b = BLOCK.GRASS;
    } else if (y === sy + 1 && sy > SEA_LEVEL && !shouldPlaceTree(biome, sy, wx, wz)) {
      const h = treeHash(wx*9.3 + 777, wz*6.7 + 333);
      if (h < 0.01) b = BLOCK.IRON_ORE; else if (h < 0.015) b = BLOCK.GOLD_ORE; else if (h < 0.018) b = BLOCK.DIAMOND_ORE;
    } else if (y > sy && y <= SEA_LEVEL) b = BLOCK.WATER;
    col.push(b);
  }
  return col;
}

describe('columnBlock', () => {
  it('donne exactement les mêmes colonnes que l’ancien code, pour tous les biomes et hauteurs', () => {
    for (const biome of Object.values(BIOME))
      for (let sy = 2; sy <= 22; sy++)
        for (let wx = -20; wx < 20; wx += 3)
          for (let wz = -20; wz < 20; wz += 5) {
            const col = Array.from({ length: WORLD_HEIGHT }, (_, y) => T.columnBlock(y, sy, biome, wx, wz));
            expect(col).toEqual(reference(wx, wz, biome, sy));
          }
  });

  it('bedrock au fond, herbe en plaine, sable sous le niveau de la mer, eau au-dessus', () => {
    expect(T.columnBlock(0, 10, BIOME.PLAINS, 1, 1)).toBe(BLOCK.STONE);
    expect(T.columnBlock(10, 10, BIOME.PLAINS, 1, 1)).toBe(BLOCK.GRASS);
    expect(T.columnBlock(5, 5, BIOME.PLAINS, 1, 1)).toBe(BLOCK.SAND);
    expect(T.columnBlock(6, 5, BIOME.PLAINS, 1, 1)).toBe(BLOCK.WATER);
    expect(T.columnBlock(15, 5, BIOME.PLAINS, 1, 1)).toBe(BLOCK.AIR);
  });
});

describe('treeBlocks', () => {
  it.each([[BIOME.PLAINS], [BIOME.MOUNTAIN]])('biome %i : un tronc de bois vertical depuis le sol, couronne de feuilles au-dessus', biome => {
    const blocks = T.treeBlocks(10, 8, 10, biome);
    const wood = blocks.filter(b => b.block === BLOCK.WOOD);
    expect(wood.length).toBeGreaterThanOrEqual(4);
    expect(wood.every(b => b.x === 10 && b.z === 10)).toBe(true);
    expect(wood[0].y).toBe(8);
    const topWood = Math.max(...wood.map(b => b.y));
    expect(blocks.some(b => b.block === BLOCK.LEAVES && b.y > topWood - 3)).toBe(true);
  });

  it('est déterministe', () => {
    expect(T.treeBlocks(3, 9, 4, BIOME.FOREST)).toEqual(T.treeBlocks(3, 9, 4, BIOME.FOREST));
  });
});

describe('shouldPlaceTree', () => {
  it('jamais sous le niveau de la mer ni dans le désert', () => {
    for (let i = 0; i < 200; i++) {
      expect(T.shouldPlaceTree(BIOME.FOREST, SEA_LEVEL, i, i * 7)).toBe(false);
      expect(T.shouldPlaceTree(BIOME.DESERT, 12, i, i * 7)).toBe(false);
    }
  });
  it('plus dense en forêt qu’en plaine', () => {
    const count = biome => Array.from({ length: 5000 }, (_, i) => T.shouldPlaceTree(biome, 12, i * 1.3, i * 0.7)).filter(Boolean).length;
    expect(count(BIOME.FOREST)).toBeGreaterThan(count(BIOME.PLAINS));
  });
});
