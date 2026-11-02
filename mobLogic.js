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

if (typeof module !== 'undefined') module.exports = { nextMobState, mobVelocity, armRotationX };
