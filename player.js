// ============================================================
//  Player — state, spawn positioning, physics & collision
//  Depends on: utils/constants.js, world.js, THREE
// ============================================================

// ---- Player state ----
const player = {
  vel: new THREE.Vector3(),
  onGround: false,
  yaw:   0,
  pitch: 0,
};

// Spawn column (center of world)
const startX = Math.floor(WORLD_SIZE / 2);
const startZ = Math.floor(WORLD_SIZE / 2);

// Called after terrain is generated and camera is defined in game.js
function initPlayer() {
  let startY = WORLD_HEIGHT;
  for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
    if (getBlock(startX, y, startZ) !== BLOCK.AIR) { startY = y + 2; break; }
  }
  camera.position.set(startX + 0.5, startY + PLAYER_HEIGHT, startZ + 0.5);
}

// ---- Collision helpers ----
function blockAt(x, y, z) {
  return getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
}

function isSolid(x, y, z) {
  const b = blockAt(x, y, z);
  return b !== BLOCK.AIR && b !== BLOCK.WATER && b !== BLOCK.LEAVES;
}

// ---- Physics ----
const PW = 0.3; // player half-width

function checkCollision(pos, vel, dt) {
  return moveWithCollisions(pos, vel, dt, isSolid, PLAYER_HEIGHT, PW);
}
