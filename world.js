// ============================================================
//  World — chunk-based infinite terrain, biomes & mesh building
//  Depend: utils/constants.js, utils/textures.js, THREE
//  Expose: getBlock, setBlock, buildWorldMesh, buildBlockMesh,
//          updateLoadedChunks, resetWorld, getSurfaceY,
//          serializeChunks, deserializeChunks, SPAWN_X, SPAWN_Z
// ============================================================

const CHUNK_SIZE = 16;
const SPAWN_X    = 8;
const SPAWN_Z    = 8;

const chunks          = new Map();
const chunkMeshGroups = new Map();
const pendingBlocks   = new Map();

function chunkKey(cx, cz) { return cx + ',' + cz; }
function chunkIdx(lx, ly, lz) { return (lx * WORLD_HEIGHT + ly) * CHUNK_SIZE + lz; }

function getBlock(wx, wy, wz) {
  if (wy < 0)             return BLOCK.STONE;
  if (wy >= WORLD_HEIGHT) return BLOCK.AIR;
  const cx = Math.floor(wx / CHUNK_SIZE);
  const cz = Math.floor(wz / CHUNK_SIZE);
  const ch = chunks.get(chunkKey(cx, cz));
  if (!ch) return BLOCK.AIR;
  const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  return ch[chunkIdx(lx, wy, lz)];
}

function setBlock(wx, wy, wz, v) {
  if (wy < 0 || wy >= WORLD_HEIGHT) return;
  const cx  = Math.floor(wx / CHUNK_SIZE);
  const cz  = Math.floor(wz / CHUNK_SIZE);
  const key = chunkKey(cx, cz);
  if (!chunks.has(key)) {
    const arr = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
    chunks.set(key, arr);
    generateChunk(cx, cz, arr);
  }
  const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  chunks.get(key)[chunkIdx(lx, wy, lz)] = v;
}

function getOrCreateChunk(cx, cz) {
  const key = chunkKey(cx, cz);
  if (!chunks.has(key)) {
    const arr = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
    chunks.set(key, arr);
    generateChunk(cx, cz, arr);
  }
  return chunks.get(key);
}

// ============================================================
//  Perlin noise
// ============================================================
function fade(t)  { return t*t*t*(t*(t*6-15)+10); }
function lerp(a,b,t) { return a+t*(b-a); }
function grad(h,x,y) { const v=h&3; return v===0?x+y:v===1?-x+y:v===2?x-y:-x-y; }

const perm = new Uint8Array(512);

function initPerm() {
  const p = [];
  for (let i=0;i<256;i++) p[i]=i;
  for (let i=255;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [p[i],p[j]]=[p[j],p[i]]; }
  for (let i=0;i<512;i++) perm[i]=p[i&255];
}
initPerm();

function noise2D(x,y) {
  const X=Math.floor(x)&255, Y=Math.floor(y)&255;
  x-=Math.floor(x); y-=Math.floor(y);
  const u=fade(x),v=fade(y), a=perm[X]+Y, b=perm[X+1]+Y;
  return lerp(lerp(grad(perm[a],x,y),grad(perm[b],x-1,y),u),
              lerp(grad(perm[a+1],x,y-1),grad(perm[b+1],x-1,y-1),u),v);
}

function fbm(x,y,octaves=4) {
  let v=0,a=0.5,f=1,max=0;
  for (let i=0;i<octaves;i++) { v+=a*noise2D(x*f,y*f); max+=a; a*=0.5; f*=2; }
  return v/max;
}

// ============================================================
//  Biomes
// ============================================================
const BIOME = { PLAINS:0, FOREST:1, DESERT:2, MOUNTAIN:3, TUNDRA:4 };

function getBiome(wx,wz) {
  const te=(fbm(wx*0.006+500, wz*0.006+500, 3)+1)/2;
  const hu=(fbm(wx*0.006+1200,wz*0.006+1200,3)+1)/2;
  const el=(fbm(wx*0.03,      wz*0.03,      2)+1)/2;
  if (el>0.72)             return BIOME.MOUNTAIN;
  if (te>0.65 && hu<0.4)   return BIOME.DESERT;
  if (te<0.28)             return BIOME.TUNDRA;
  if (te>0.42 && hu>0.58)  return BIOME.FOREST;
  return BIOME.PLAINS;
}

function getSurfaceHeight(wx,wz,biome) {
  const n=(fbm(wx*0.05,wz*0.05)+1)/2;
  if (biome===BIOME.DESERT)   return Math.floor(SEA_LEVEL+1+n*5);
  if (biome===BIOME.TUNDRA)   return Math.floor(SEA_LEVEL+n*7);
  if (biome===BIOME.MOUNTAIN) {
    const mn=(fbm(wx*0.038,wz*0.038,6)+1)/2;
    return Math.min(WORLD_HEIGHT-2, Math.floor(SEA_LEVEL+mn*(WORLD_HEIGHT-SEA_LEVEL-2)));
  }
  if (biome===BIOME.FOREST)   return Math.floor(SEA_LEVEL+2+n*(WORLD_HEIGHT-SEA_LEVEL-6));
  return Math.floor(SEA_LEVEL+n*(WORLD_HEIGHT-SEA_LEVEL-4));
}

const { treeHash, shouldPlaceTree, columnBlock, treeBlocks } = makeTerrain({ BLOCK, BIOME, SEA_LEVEL });

// ============================================================
//  Chunk generation
// ============================================================
// Génère une seule colonne (wx,wz) dans le chunk. Partagé par generateChunk et le générateur incrémental.
function _genColumn(chunk,cx,cz,lx,lz,trees) {
  const wx=cx*CHUNK_SIZE+lx, wz=cz*CHUNK_SIZE+lz;
  const biome=getBiome(wx,wz), sy=getSurfaceHeight(wx,wz,biome);
  for (let y=0;y<WORLD_HEIGHT;y++) chunk[chunkIdx(lx,y,lz)]=columnBlock(y,sy,biome,wx,wz);
  if (shouldPlaceTree(biome,sy,wx,wz)) trees.push({wx,wz,sy:sy+1,biome});
}

function generateChunk(cx,cz,chunk) {
  const key=chunkKey(cx,cz);
  if (pendingBlocks.has(key)) {
    for (const {lx,ly,lz,block} of pendingBlocks.get(key))
      if (chunk[chunkIdx(lx,ly,lz)]===BLOCK.AIR) chunk[chunkIdx(lx,ly,lz)]=block;
    pendingBlocks.delete(key);
  }
  const trees=[];
  for (let lx=0;lx<CHUNK_SIZE;lx++)
    for (let lz=0;lz<CHUNK_SIZE;lz++)
      _genColumn(chunk,cx,cz,lx,lz,trees);
  for (const t of trees) plantTree(chunk,cx,cz,t.wx,t.wz,t.sy,t.biome);
}

function plantTree(chunk,cx,cz,wx,wz,sy,biome) {
  for (const {x,y,z,block} of treeBlocks(wx,sy,wz,biome)) {
    if (y<0||y>=WORLD_HEIGHT) continue;
    const bcx=Math.floor(x/CHUNK_SIZE), bcz=Math.floor(z/CHUNK_SIZE);
    const lx=((x%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE;
    const lz=((z%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE;
    if (bcx===cx&&bcz===cz) {
      if (chunk[chunkIdx(lx,y,lz)]===BLOCK.AIR) chunk[chunkIdx(lx,y,lz)]=block;
    } else {
      const k=chunkKey(bcx,bcz);
      if (!pendingBlocks.has(k)) pendingBlocks.set(k,[]);
      pendingBlocks.get(k).push({lx,ly:y,lz,block});
    }
  }
}

// ============================================================
//  Surface helper
// ============================================================
function getSurfaceY(bx,bz) {
  bx=Math.floor(bx); bz=Math.floor(bz);
  getOrCreateChunk(Math.floor(bx/CHUNK_SIZE), Math.floor(bz/CHUNK_SIZE));
  for (let y=WORLD_HEIGHT-1;y>=0;y--) {
    const b=getBlock(bx,y,bz);
    if (b!==BLOCK.AIR&&b!==BLOCK.WATER) return y+1;
  }
  return SEA_LEVEL;
}

// ============================================================
//  Mesh building
// ============================================================
const FACES = [
  {dir:[1,0,0], corners:[[1,0,0],[1,1,0],[1,0,1],[1,1,1]], face:'side'},
  {dir:[-1,0,0],corners:[[0,0,1],[0,1,1],[0,0,0],[0,1,0]], face:'side'},
  {dir:[0,1,0], corners:[[0,1,1],[1,1,1],[0,1,0],[1,1,0]], face:'top'},
  {dir:[0,-1,0],corners:[[0,0,0],[1,0,0],[0,0,1],[1,0,1]], face:'bot'},
  {dir:[0,0,1], corners:[[1,0,1],[1,1,1],[0,0,1],[0,1,1]], face:'side'},
  {dir:[0,0,-1],corners:[[0,0,0],[0,1,0],[1,0,0],[1,1,0]], face:'side'},
];
const QUAD_UVS=[0,0,0,1,1,0,1,1];

function isOpaqueAt(wx,wy,wz) { const b=getBlock(wx,wy,wz); return b!==BLOCK.AIR&&b!==BLOCK.WATER&&b!==BLOCK.LEAVES; }
function isAirAt(wx,wy,wz)    { return getBlock(wx,wy,wz)===BLOCK.AIR; }

const materialCache={};
function getMaterial(texture,transparent) {
  const key=texture.uuid+'_'+transparent;
  if (!materialCache[key]) {
    materialCache[key]=new THREE.MeshLambertMaterial({
      map:texture, transparent:!!transparent,
      opacity:transparent?0.75:1, alphaTest:transparent?0.1:0,
      side:transparent?THREE.DoubleSide:THREE.FrontSide,
    });
  }
  return materialCache[key];
}

function disposeChunkMesh(key) {
  const old=chunkMeshGroups.get(key);
  if (!old) return;
  worldGroup.remove(old);
  old.children.forEach(c=>{if(c.geometry)c.geometry.dispose();});
  chunkMeshGroups.delete(key);
}

function meshGroupFrom(geomData) {
  const group=new THREE.Group();
  for (const gk in geomData) {
    const d=geomData[gk], geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(d.positions,3));
    geo.setAttribute('normal',  new THREE.Float32BufferAttribute(d.normals,  3));
    geo.setAttribute('uv',      new THREE.Float32BufferAttribute(d.uvs,      2));
    geo.setIndex(d.indices);
    const mesh=new THREE.Mesh(geo,getMaterial(d.texture,d.transparent));
    mesh.castShadow=!d.transparent; mesh.receiveShadow=!d.transparent;
    group.add(mesh);
  }
  return group;
}

function buildChunkMesh(cx,cz) {
  const key=chunkKey(cx,cz);
  const chunk=chunks.get(key);
  if (!chunk) return;
  disposeChunkMesh(key);
  const group=meshGroupFrom(collectChunkFaces(chunk,cx,cz,{CHUNK_SIZE,WORLD_HEIGHT,BLOCK,BLOCK_DEFS,TEXTURES,FACES,QUAD_UVS,chunkIdx,isAirAt,isOpaqueAt}));
  chunkMeshGroups.set(key,group);
  worldGroup.add(group);
}

function buildWorldMesh() {
  for (const [key] of chunkMeshGroups) {
    const [cx,cz]=key.split(',').map(Number);
    buildChunkMesh(cx,cz);
  }
}

function buildBlockMesh(wx,wz) {
  const cx=Math.floor(wx/CHUNK_SIZE), cz=Math.floor(wz/CHUNK_SIZE);
  buildChunkMesh(cx,cz);
  const lx=((wx%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE;
  const lz=((wz%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE;
  if (lx===0            &&chunkMeshGroups.has(chunkKey(cx-1,cz))) buildChunkMesh(cx-1,cz);
  if (lx===CHUNK_SIZE-1 &&chunkMeshGroups.has(chunkKey(cx+1,cz))) buildChunkMesh(cx+1,cz);
  if (lz===0            &&chunkMeshGroups.has(chunkKey(cx,cz-1))) buildChunkMesh(cx,cz-1);
  if (lz===CHUNK_SIZE-1 &&chunkMeshGroups.has(chunkKey(cx,cz+1))) buildChunkMesh(cx,cz+1);
}

// ---- File de génération asynchrone (non-bloquant, génération incrémentale) ----
// Phase 1 : _genColumn() × 2 rangées / frame  → CHUNK_SIZE/2 frames pour générer
// Phase 2 : buildChunkMesh() en une passe (1 frame)
const _buildQueue = [];
const _meshQueue  = []; // chunks avec données, en attente de mesh
const _queuedKeys = new Set();
let _genState = null;  // { cx, cz, arr, trees, lx } — génération incrémentale

function _enqueueChunk(cx, cz) {
  const key = chunkKey(cx, cz);
  if (!_queuedKeys.has(key)) {
    _queuedKeys.add(key);
    _buildQueue.push([cx, cz]);
  }
}

// Appelée une fois par frame depuis animate().
// Génération INCRÉMENTALE : 2 rangées (rows) par frame → pas de freeze.
function processNextChunk() {
  // P1 : continuer une génération incrémentale en cours
  if (_genState) {
    const { cx, cz, arr, trees } = _genState;
    const end = Math.min(_genState.lx + 2, CHUNK_SIZE); // 2 rangées / frame
    for (let lx = _genState.lx; lx < end; lx++)
      for (let lz = 0; lz < CHUNK_SIZE; lz++)
        _genColumn(arr, cx, cz, lx, lz, trees);
    _genState.lx = end;
    if (_genState.lx >= CHUNK_SIZE) {
      // Chunk complet : planter les arbres puis appliquer les blocs en attente
      for (const t of trees) plantTree(arr, cx, cz, t.wx, t.wz, t.sy, t.biome);
      const key = chunkKey(cx, cz);
      if (pendingBlocks.has(key)) {
        for (const {lx,ly,lz,block} of pendingBlocks.get(key))
          if (arr[chunkIdx(lx,ly,lz)]===BLOCK.AIR) arr[chunkIdx(lx,ly,lz)]=block;
        pendingBlocks.delete(key);
      }
      _meshQueue.push([cx, cz]);
      _genState = null;
    }
    return;
  }
  // P2 : construire le mesh d'un chunk prêt
  if (_meshQueue.length > 0) {
    const [cx, cz] = _meshQueue.shift();
    buildChunkMesh(cx, cz);
    return;
  }
  // P3 : démarrer la génération incrémentale du prochain chunk en file
  if (_buildQueue.length > 0) {
    const [cx, cz] = _buildQueue.shift();
    const key = chunkKey(cx, cz);
    _queuedKeys.delete(key);
    if (!chunks.has(key)) {
      const arr = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
      chunks.set(key, arr);
      _genState = { cx, cz, arr, trees: [], lx: 0 };
    } else if (!chunkMeshGroups.has(key)) {
      buildChunkMesh(cx, cz);
    }
  }
}

function updateLoadedChunks(playerX,playerZ) {
  const pcx=Math.floor(playerX/CHUNK_SIZE), pcz=Math.floor(playerZ/CHUNK_SIZE);
  const rd=(typeof Settings!=='undefined')?Settings.get('renderDist'):4;
  const rd2=rd*rd;
  for (let dcx=-rd;dcx<=rd;dcx++) {
    for (let dcz=-rd;dcz<=rd;dcz++) {
      if (dcx*dcx+dcz*dcz>rd2) continue;
      const cx=pcx+dcx, cz=pcz+dcz, key=chunkKey(cx,cz);
      if (!chunks.has(key)||!chunkMeshGroups.has(key)) {
        _enqueueChunk(cx, cz);
      }
    }
  }
  const ud2=(rd+2)*(rd+2);
  for (const [key,group] of chunkMeshGroups) {
    const [cx,cz]=key.split(',').map(Number);
    if ((cx-pcx)*(cx-pcx)+(cz-pcz)*(cz-pcz)>ud2) {
      worldGroup.remove(group);
      group.children.forEach(c=>{if(c.geometry)c.geometry.dispose();});
      chunkMeshGroups.delete(key);
      _queuedKeys.delete(key);
    }
  }
}

function resetWorld() {
  for (const [,group] of chunkMeshGroups) {
    worldGroup.remove(group);
    group.children.forEach(c=>{if(c.geometry)c.geometry.dispose();});
  }
  chunkMeshGroups.clear(); chunks.clear(); pendingBlocks.clear();
  _buildQueue.length = 0; _meshQueue.length = 0; _queuedKeys.clear();
  _genState = null;
  initPerm();
  // Les chunks seront regénérés par startNewWorld() ou la file async
}

// ============================================================
//  Serialisation (sauvegarde)
// ============================================================
function serializeChunks() {
  const out={};
  for (const [key,arr] of chunks) {
    let bin=''; for (let i=0;i<arr.length;i++) bin+=String.fromCharCode(arr[i]);
    out[key]=btoa(bin);
  }
  return out;
}

function deserializeChunks(data) {
  for (const [,group] of chunkMeshGroups) {
    worldGroup.remove(group); group.children.forEach(c=>{if(c.geometry)c.geometry.dispose();});
  }
  chunkMeshGroups.clear(); chunks.clear(); pendingBlocks.clear();
  for (const [key,b64] of Object.entries(data)) {
    const bin=atob(b64), arr=new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
    chunks.set(key,arr);
  }
}

// ---- Scene objects ----
const worldGroup  = new THREE.Group();
const highlightGeo  = new THREE.BoxGeometry(1.02,1.02,1.02);
const highlightMat  = new THREE.MeshBasicMaterial({color:0x000000,wireframe:true});
const highlightMesh = new THREE.Mesh(highlightGeo,highlightMat);
highlightMesh.visible=false;
// NOTE: les chunks sont générés au démarrage de game.js (après buildTextures)
