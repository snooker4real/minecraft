// ============================================================
//  Mesh logic — visible faces of a chunk (pure, no THREE)
//  Expose: collectChunkFaces
// ============================================================

// Regroupe les faces visibles du chunk par (bloc, face) : positions, normales, uv, indices.
// env : { CHUNK_SIZE, WORLD_HEIGHT, BLOCK, BLOCK_DEFS, TEXTURES, FACES, QUAD_UVS, chunkIdx, isAirAt, isOpaqueAt }
function collectChunkFaces(chunk, cx, cz, env) {
  const { CHUNK_SIZE, WORLD_HEIGHT, BLOCK, BLOCK_DEFS, TEXTURES, FACES, QUAD_UVS, chunkIdx, isAirAt, isOpaqueAt } = env;
  const geomData = {};
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let ly = 0; ly < WORLD_HEIGHT; ly++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const bt = chunk[chunkIdx(lx, ly, lz)];
        if (bt === BLOCK.AIR) continue;
        const def = BLOCK_DEFS[bt], texSet = TEXTURES[bt];
        if (!def || !texSet) continue;
        const wx = cx*CHUNK_SIZE + lx, wz = cz*CHUNK_SIZE + lz;
        for (const f of FACES) {
          const nx = wx + f.dir[0], ny = ly + f.dir[1], nz = wz + f.dir[2];
          const show = (bt === BLOCK.WATER || bt === BLOCK.LEAVES) ? isAirAt(nx, ny, nz) : !isOpaqueAt(nx, ny, nz);
          if (!show) continue;
          const gk = bt + '_' + f.face;
          if (!geomData[gk]) geomData[gk] = { positions: [], indices: [], normals: [], uvs: [], texture: texSet[f.face], transparent: def.transparent };
          addQuad(geomData[gk], f, wx, ly, wz, QUAD_UVS);
        }
      }
    }
  }
  return geomData;
}

function addQuad(e, f, wx, ly, wz, QUAD_UVS) {
  const vi = e.positions.length / 3;
  const [nd0, nd1, nd2] = f.dir;
  for (let ci = 0; ci < 4; ci++) {
    const [cx2, cy, cz2] = f.corners[ci];
    e.positions.push(wx + cx2, ly + cy, wz + cz2);
    e.normals.push(nd0, nd1, nd2);
    e.uvs.push(QUAD_UVS[ci*2], QUAD_UVS[ci*2 + 1]);
  }
  e.indices.push(vi, vi + 1, vi + 2, vi + 1, vi + 3, vi + 2);
}

if (typeof module !== 'undefined') module.exports = { collectChunkFaces };
