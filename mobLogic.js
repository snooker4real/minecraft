// ============================================================
//  MOB LOGIC — fonctions pures de l'IA des mobs (sans THREE ni DOM)
//  Chargé avant mobs.js ; exporté aussi pour les tests Node.
// ============================================================

/** État suivant d'un mob selon sa distance au joueur (plan XZ). */
function nextMobState(state, hostile, distXZ, detect, lose) {
  if (hostile) {
    if (distXZ < detect) return 'chase';
    return distXZ > lose ? 'wander' : state;
  }
  if (distXZ < 5) return 'flee';
  return state === 'flee' && distXZ > 9 ? 'wander' : state;
}

/** Vitesse {x, z} : poursuite, fuite ou errance (45 % de la vitesse). */
function mobVelocity(state, dxp, dzp, distXZ, speed, wanderDir) {
  const len = Math.max(distXZ, 0.01);
  if (state === 'chase') return { x: (dxp / len) * speed, z: (dzp / len) * speed };
  if (state === 'flee') return { x: (-dxp / len) * speed, z: (-dzp / len) * speed };
  return { x: wanderDir.x * speed * 0.45, z: wanderDir.y * speed * 0.45 };
}

/** Rotation X d'un bras : balancement, bras tendus pour le zombie. */
function armRotationX(mobType, animPhase, armSide) {
  const swing = Math.sin(animPhase + (armSide > 0 ? Math.PI : 0)) * 0.3;
  return (mobType === 'ZOMBIE' ? -0.7 : 0) + swing;
}

/**
 * Un pas de marche : gravité, sol, puis déplacement en X et en Z avec demi-tour (et saut
 * en poursuite) contre un bloc, puis bornes du monde. Modifie mob.pos, mob.vel, mob.onGround, mob.wanderDir.
 * `world` : { getBlock, AIR, SIZE, HEIGHT, GRAVITY }.
 */
function stepWalking(mob, mvx, mvz, dt, world) {
  const { getBlock, AIR, SIZE, HEIGHT, GRAVITY } = world;
  const pos = mob.pos;
  mob.vel.x = mvx;
  mob.vel.z = mvz;
  mob.vel.y += GRAVITY * dt;

  const inside = (x, y, z) => x >= 0 && x < SIZE && z >= 0 && z < SIZE && y >= 0 && y < HEIGHT;
  const solid = (x, y, z) => inside(x, y, z) && getBlock(x, y, z) !== AIR;

  // Sol
  const bx = Math.floor(pos.x), bz = Math.floor(pos.z);
  if (bx >= 0 && bx < SIZE && bz >= 0 && bz < SIZE) {
    const newY = pos.y + mob.vel.y * dt;
    const by = Math.floor(newY - 0.05);
    if (mob.vel.y <= 0 && by >= 0 && by < HEIGHT && getBlock(bx, by, bz) !== AIR) {
      mob.vel.y = 0;
      mob.onGround = true;
      pos.y = by + 1 + 0.05;
    } else {
      mob.onGround = false;
      pos.y = newY;
    }
  } else {
    pos.y += mob.vel.y * dt;
  }

  const jump = () => { if (mob.onGround && mob.state === 'chase') mob.vel.y = 5.5; };
  const footY = Math.floor(pos.y - 0.05);

  // X puis Z : un bloc devant renvoie le mob dans l'autre sens
  const newX = pos.x + mob.vel.x * dt;
  if (solid(Math.floor(newX), footY, Math.floor(pos.z))) { mob.wanderDir.x *= -1; jump(); } else pos.x = newX;
  const newZ = pos.z + mob.vel.z * dt;
  if (solid(Math.floor(pos.x), footY, Math.floor(newZ))) { mob.wanderDir.y *= -1; jump(); } else pos.z = newZ;

  pos.x = Math.max(0.5, Math.min(SIZE - 0.5, pos.x));
  pos.z = Math.max(0.5, Math.min(SIZE - 0.5, pos.z));
}

/** Un pas de vol : avance en XZ et rejoint la hauteur cible en douceur. */
function stepFlying(mob, mvx, mvz, dt, targetY) {
  mob.pos.x += mvx * dt;
  mob.pos.z += mvz * dt;
  mob.pos.y += (targetY - mob.pos.y) * Math.min(dt * 3, 1);
}

if (typeof module !== 'undefined') module.exports = { nextMobState, mobVelocity, armRotationX, stepWalking, stepFlying };
