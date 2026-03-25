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
  const { x, y, z } = pos;

  let onGround = false;

  // Y axis
  const ny = y + vel.y * dt;
  const footY = ny - PLAYER_HEIGHT;
  const headY = ny;
  let yBlocked = false;

  if (vel.y < 0) {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (isSolid(x + dx * PW, footY, z + dz * PW)) { yBlocked = true; break; }
    }
    if (yBlocked) {
      vel.y = 0;
      onGround = true;
      pos.y = Math.floor(footY + 1) + PLAYER_HEIGHT;
    }
  } else if (vel.y > 0) {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (isSolid(x + dx * PW, headY, z + dz * PW)) { yBlocked = true; break; }
    }
    if (yBlocked) { vel.y = 0; pos.y = Math.floor(headY) - 0.01; }
  }
  pos.y += vel.y * dt;

  // X axis
  const newX = pos.x + vel.x * dt;
  const foot = pos.y - PLAYER_HEIGHT, head = pos.y;
  let xBlocked = false;
  for (let dy = 0; dy <= 1; dy++) {
    const cy = foot + dy;
    if (isSolid(newX - PW, cy, pos.z) || isSolid(newX + PW, cy, pos.z)) { xBlocked = true; break; }
  }
  if (!xBlocked) pos.x = newX; else vel.x = 0;

  // Z axis
  const newZ = pos.z + vel.z * dt;
  let zBlocked = false;
  for (let dy = 0; dy <= 1; dy++) {
    const cy = foot + dy;
    if (isSolid(pos.x, cy, newZ - PW) || isSolid(pos.x, cy, newZ + PW)) { zBlocked = true; break; }
  }
  if (!zBlocked) pos.z = newZ; else vel.z = 0;

  return onGround;
}
