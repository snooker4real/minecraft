// ============================================================
//  Physics logic — voxel raycast & axis-by-axis collision (pure)
//  Expose: voxelRaycast, moveWithCollisions, stickDirection, swingPose, breakPercent, placementBlocked, durabilityLook, blastCells
// ============================================================

// Parcours de grille (DDA) depuis orig dans la direction dir ; s'arrête au premier bloc
// pour lequel isTarget(x, y, z) est vrai, ou au-delà de reach.
function voxelRaycast(orig, dir, reach, worldHeight, isTarget) {
  let x = Math.floor(orig.x), y = Math.floor(orig.y), z = Math.floor(orig.z);
  const step  = { x: dir.x >= 0 ? 1 : -1, y: dir.y >= 0 ? 1 : -1, z: dir.z >= 0 ? 1 : -1 };
  const delta = { x: Math.abs(1 / dir.x) || Infinity, y: Math.abs(1 / dir.y) || Infinity, z: Math.abs(1 / dir.z) || Infinity };
  const firstT = (o, c, s, d) => d !== 0 ? (s > 0 ? (c + 1 - o) : (o - c)) / Math.abs(d) : Infinity;
  let tMaxX = firstT(orig.x, x, step.x, dir.x);
  let tMaxY = firstT(orig.y, y, step.y, dir.y);
  let tMaxZ = firstT(orig.z, z, step.z, dir.z);

  let prevX = x, prevY = y, prevZ = z;
  for (let steps = 0; steps < 100; steps++) {
    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) { prevX = x; x += step.x; tMaxX += delta.x; }
      else               { prevZ = z; z += step.z; tMaxZ += delta.z; }
    } else if (tMaxY < tMaxZ) { prevY = y; y += step.y; tMaxY += delta.y; }
    else                      { prevZ = z; z += step.z; tMaxZ += delta.z; }

    if (Math.min(tMaxX, tMaxY, tMaxZ) > reach) break;

    if (y >= 0 && y < worldHeight && isTarget(x, y, z)) return { hit: true, x, y, z, prevX, prevY, prevZ };
    prevX = x; prevY = y; prevZ = z;
  }
  return { hit: false };
}

// Direction horizontale (normalisée) d'un stick gauche (lx droite, lz arrière) pour un cap yaw
function stickDirection(lx, lz, yaw) {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);   // devant
  const rx =  Math.cos(yaw), rz = -Math.sin(yaw);   // droite
  const x = rx * lx - fx * lz, z = rz * lx - fz * lz;
  const len = Math.hypot(x, z);
  return len > 0 ? { x: x / len, z: z / len } : { x: 0, z: 0 };
}

// Pose de la main pendant une frappe (p de 0 à 1) : rotations et descente de l'item
function swingPose(isSword, p) {
  const arc = Math.sin(p * Math.PI); // 0 → 1 → 0
  return isSword
    ? { rotX: -arc * 0.85, rotZ: -arc * 1.15, dropY: arc * 0.08 }  // slash horizontal
    : { rotX: -arc * 1.55, rotZ:  arc * 0.22, dropY: arc * 0.06 }; // coup de pioche vers le bas-avant
}

// Avancement du cassage en pourcentage (0 à 100)
function breakPercent(progress, duration) {
  return Math.min(progress / duration * 100, 100);
}

// Pose interdite hors du monde ou à l'emplacement du joueur (pieds ou tête)
function placementBlocked(t, camPos, worldHeight, playerHeight) {
  if (t.y < 0 || t.y >= worldHeight) return true;
  const cx = Math.floor(camPos.x), cy = Math.floor(camPos.y - playerHeight / 2), cz = Math.floor(camPos.z);
  return t.x === cx && (t.y === cy || t.y === cy + 1) && t.z === cz;
}

// Largeur (%) et couleur de la barre de durabilité d'un outil
function durabilityLook(current, max) {
  const pct = Math.round(current / max * 100);
  return { pct, color: pct > 50 ? '#44ff44' : pct > 20 ? '#ffaa00' : '#ff3333' };
}

// Cases détruites par une explosion de rayon r centrée sur pos, limitées au monde
function blastCells(pos, r, worldSize, worldHeight) {
  const cx = Math.floor(pos.x), cy = Math.floor(pos.y), cz = Math.floor(pos.z);
  const cells = [];
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
    if (dx*dx + dy*dy + dz*dz > r*r) continue;
    const x = cx + dx, y = cy + dy, z = cz + dz;
    if (x >= 0 && x < worldSize && y >= 0 && y < worldHeight && z >= 0 && z < worldSize) cells.push({ x, y, z });
  }
  return cells;
}

// Déplace pos de vel*dt, un axe après l'autre ; annule la vitesse de l'axe bloqué.
// Retourne true si le joueur est posé au sol.
function moveWithCollisions(pos, vel, dt, isSolid, height, halfWidth) {
  const onGround = moveY(pos, vel, dt, isSolid, height, halfWidth);
  const foot = pos.y - height;
  const blockedAt = (x, z) => [0, 1].some(dy => isSolid(x, foot + dy, z));

  const newX = pos.x + vel.x * dt;
  if (blockedAt(newX - halfWidth, pos.z) || blockedAt(newX + halfWidth, pos.z)) vel.x = 0; else pos.x = newX;

  const newZ = pos.z + vel.z * dt;
  if (blockedAt(pos.x, newZ - halfWidth) || blockedAt(pos.x, newZ + halfWidth)) vel.z = 0; else pos.z = newZ;

  return onGround;
}

function moveY(pos, vel, dt, isSolid, height, halfWidth) {
  const { x, z } = pos;
  const ny = pos.y + vel.y * dt;
  const anySolidAt = y => [-1, 0, 1].some(dx => [-1, 0, 1].some(dz => isSolid(x + dx * halfWidth, y, z + dz * halfWidth)));
  let onGround = false;

  if (vel.y < 0 && anySolidAt(ny - height)) {
    vel.y = 0;
    onGround = true;
    pos.y = Math.floor(ny - height + 1) + height;
  } else if (vel.y > 0 && anySolidAt(ny)) {
    vel.y = 0;
    pos.y = Math.floor(ny) - 0.01;
  }
  pos.y += vel.y * dt;
  return onGround;
}

if (typeof module !== 'undefined') module.exports = { voxelRaycast, moveWithCollisions, stickDirection, swingPose, breakPercent, placementBlocked, durabilityLook, blastCells };
