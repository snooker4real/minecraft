import { describe, expect, it } from 'vitest';
import { collectChunkFaces } from './meshLogic';

const BLOCK = { AIR: 0, STONE: 1, WATER: 2, LEAVES: 3 };
const FACES = [
  { dir: [1, 0, 0], corners: [[1,0,0],[1,1,0],[1,0,1],[1,1,1]], face: 'side' },
  { dir: [-1, 0, 0], corners: [[0,0,1],[0,1,1],[0,0,0],[0,1,0]], face: 'side' },
  { dir: [0, 1, 0], corners: [[0,1,1],[1,1,1],[0,1,0],[1,1,0]], face: 'top' },
  { dir: [0, -1, 0], corners: [[0,0,0],[1,0,0],[0,0,1],[1,0,1]], face: 'bot' },
  { dir: [0, 0, 1], corners: [[1,0,1],[1,1,1],[0,0,1],[0,1,1]], face: 'side' },
  { dir: [0, 0, -1], corners: [[0,0,0],[0,1,0],[1,0,0],[1,1,0]], face: 'side' },
];
const CHUNK_SIZE = 4, WORLD_HEIGHT = 4;
const tex = { side: 's', top: 't', bot: 'b' };

// Petit monde : blocks = { 'x,y,z': type } dans le chunk (0,0)
const makeEnv = blocks => {
  const chunkIdx = (lx, ly, lz) => (lx * WORLD_HEIGHT + ly) * CHUNK_SIZE + lz;
  const chunk = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
  for (const [k, t] of Object.entries(blocks)) { const [x, y, z] = k.split(',').map(Number); chunk[chunkIdx(x, y, z)] = t; }
  const at = (x, y, z) => blocks[`${x},${y},${z}`] ?? BLOCK.AIR;
  const env = {
    CHUNK_SIZE, WORLD_HEIGHT, BLOCK, FACES, QUAD_UVS: [0, 0, 0, 1, 1, 0, 1, 1], chunkIdx,
    BLOCK_DEFS: { 1: { transparent: false }, 2: { transparent: true }, 3: { transparent: true } },
    TEXTURES: { 1: tex, 2: tex, 3: tex },
    isAirAt: (x, y, z) => at(x, y, z) === BLOCK.AIR,
    isOpaqueAt: (x, y, z) => { const b = at(x, y, z); return b !== BLOCK.AIR && b !== BLOCK.WATER && b !== BLOCK.LEAVES; },
  };
  return { chunk, env };
};
const quads = data => Object.values(data).reduce((n, d) => n + d.indices.length / 6, 0);

describe('collectChunkFaces', () => {
  it('un bloc isolé montre ses 6 faces', () => {
    const { chunk, env } = makeEnv({ '1,1,1': BLOCK.STONE });
    expect(quads(collectChunkFaces(chunk, 0, 0, env))).toBe(6);
  });

  it('deux blocs voisins cachent leur face commune : 10 faces', () => {
    const { chunk, env } = makeEnv({ '1,1,1': BLOCK.STONE, '2,1,1': BLOCK.STONE });
    expect(quads(collectChunkFaces(chunk, 0, 0, env))).toBe(10);
  });

  it('l’eau et les feuilles ne se montrent que face à l’air, pas face à la pierre', () => {
    const { chunk, env } = makeEnv({ '1,1,1': BLOCK.STONE, '2,1,1': BLOCK.WATER });
    const data = collectChunkFaces(chunk, 0, 0, env);
    const water = data['2_side'], waterTop = data['2_top'];
    // 6 faces d'eau moins la face collée à la pierre
    expect((water?.indices.length ?? 0) / 6 + (waterTop?.indices.length ?? 0) / 6 + (data['2_bot']?.indices.length ?? 0) / 6).toBe(5);
  });

  it('un chunk vide ne produit rien ; chaque quad a 4 sommets, normales et uv cohérents', () => {
    expect(collectChunkFaces(makeEnv({}).chunk, 0, 0, makeEnv({}).env)).toEqual({});
    const { chunk, env } = makeEnv({ '0,0,0': BLOCK.STONE });
    const d = collectChunkFaces(chunk, 0, 0, env)['1_top'];
    expect(d.positions).toHaveLength(12);
    expect(d.normals).toEqual([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
    expect(d.uvs).toHaveLength(8);
    expect(d.indices).toEqual([0, 1, 2, 1, 3, 2]);
  });

  it('les positions tiennent compte de la position du chunk', () => {
    const { chunk, env } = makeEnv({ '0,0,0': BLOCK.STONE });
    const d = collectChunkFaces(chunk, 2, 3, env)['1_top'];
    expect(d.positions.slice(0, 3)).toEqual([2 * CHUNK_SIZE, 1, 3 * CHUNK_SIZE + 1]);
  });
});
