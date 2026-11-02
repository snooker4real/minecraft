import { describe, expect, it } from 'vitest';
import { blastCells, breakPercent, durabilityLook, moveWithCollisions, placementBlocked, stickDirection, swingPose, voxelRaycast } from './physicsLogic';

// Générateur pseudo-aléatoire à graine fixe pour des mondes reproductibles
const rng = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const worldFrom = (r, density) => {
  const cells = new Set();
  for (let x = -6; x < 6; x++) for (let y = 0; y < 12; y++) for (let z = -6; z < 6; z++)
    if (y < 3 || r() < density) cells.add(`${x},${y},${z}`);
  return (x, y, z) => cells.has(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`);
};

// ---- Anciennes versions (controls.js / player.js), gardées comme référence ----
function refRaycast(orig, dir, reach, worldHeight, isTarget) {
  let x = Math.floor(orig.x), y = Math.floor(orig.y), z = Math.floor(orig.z);
  const stepX = dir.x >= 0 ? 1 : -1, stepY = dir.y >= 0 ? 1 : -1, stepZ = dir.z >= 0 ? 1 : -1;
  const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;
  let tMaxX = dir.x !== 0 ? (stepX > 0 ? (x + 1 - orig.x) : (orig.x - x)) / Math.abs(dir.x) : Infinity;
  let tMaxY = dir.y !== 0 ? (stepY > 0 ? (y + 1 - orig.y) : (orig.y - y)) / Math.abs(dir.y) : Infinity;
  let tMaxZ = dir.z !== 0 ? (stepZ > 0 ? (z + 1 - orig.z) : (orig.z - z)) / Math.abs(dir.z) : Infinity;
  let prevX = x, prevY = y, prevZ = z, steps = 0;
  while (steps++ < 100) {
    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) { prevX = x; x += stepX; tMaxX += tDeltaX; } else { prevZ = z; z += stepZ; tMaxZ += tDeltaZ; }
    } else {
      if (tMaxY < tMaxZ) { prevY = y; y += stepY; tMaxY += tDeltaY; } else { prevZ = z; z += stepZ; tMaxZ += tDeltaZ; }
    }
    if (Math.min(tMaxX, tMaxY, tMaxZ) > reach) break;
    if (y >= 0 && y < worldHeight && isTarget(x, y, z)) return { hit: true, x, y, z, prevX, prevY, prevZ };
    prevX = x; prevY = y; prevZ = z;
  }
  return { hit: false };
}

function refCollision(pos, vel, dt, isSolid, H, PW) {
  const { x, z } = pos;
  let onGround = false;
  const ny = pos.y + vel.y * dt, footY = ny - H, headY = ny;
  let yBlocked = false;
  if (vel.y < 0) {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (isSolid(x + dx * PW, footY, z + dz * PW)) { yBlocked = true; break; }
    if (yBlocked) { vel.y = 0; onGround = true; pos.y = Math.floor(footY + 1) + H; }
  } else if (vel.y > 0) {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (isSolid(x + dx * PW, headY, z + dz * PW)) { yBlocked = true; break; }
    if (yBlocked) { vel.y = 0; pos.y = Math.floor(headY) - 0.01; }
  }
  pos.y += vel.y * dt;
  const newX = pos.x + vel.x * dt, foot = pos.y - H;
  let xBlocked = false;
  for (let dy = 0; dy <= 1; dy++) { const cy = foot + dy; if (isSolid(newX - PW, cy, pos.z) || isSolid(newX + PW, cy, pos.z)) { xBlocked = true; break; } }
  if (!xBlocked) pos.x = newX; else vel.x = 0;
  const newZ = pos.z + vel.z * dt;
  let zBlocked = false;
  for (let dy = 0; dy <= 1; dy++) { const cy = foot + dy; if (isSolid(pos.x, cy, newZ - PW) || isSolid(pos.x, cy, newZ + PW)) { zBlocked = true; break; } }
  if (!zBlocked) pos.z = newZ; else vel.z = 0;
  return onGround;
}

describe('voxelRaycast', () => {
  it('même résultat que l’ancien code sur 3000 rayons aléatoires', () => {
    const r = rng(42);
    const isTarget = worldFrom(r, 0.12);
    for (let i = 0; i < 3000; i++) {
      const orig = { x: (r() - 0.5) * 8, y: 3 + r() * 6, z: (r() - 0.5) * 8 };
      const v = [r() - 0.5, r() - 0.5, r() - 0.5];
      if (i % 7 === 0) v[i % 3] = 0; // axes parallèles
      const n = Math.hypot(...v) || 1;
      const dir = { x: v[0] / n, y: v[1] / n, z: v[2] / n };
      expect(voxelRaycast(orig, dir, 5, 12, isTarget)).toEqual(refRaycast(orig, dir, 5, 12, isTarget));
    }
  });

  it('touche le premier bloc et donne la case précédente', () => {
    const isTarget = (x, y, z) => x === 3 && y === 0 && z === 0;
    const res = voxelRaycast({ x: 0.5, y: 0.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, 5, 10, isTarget);
    expect(res).toEqual({ hit: true, x: 3, y: 0, z: 0, prevX: 2, prevY: 0, prevZ: 0 });
  });

  it('ne touche rien au-delà de la portée', () => {
    const isTarget = (x) => x === 8;
    expect(voxelRaycast({ x: 0.5, y: 0.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, 5, 10, isTarget).hit).toBe(false);
  });
});

describe('moveWithCollisions', () => {
  const H = 1.6, PW = 0.3;

  it('même résultat que l’ancien code sur 3000 déplacements aléatoires', () => {
    const r = rng(7);
    const isSolid = worldFrom(r, 0.15);
    for (let i = 0; i < 3000; i++) {
      const base = { pos: { x: (r() - 0.5) * 6, y: 4 + r() * 5, z: (r() - 0.5) * 6 }, vel: { x: (r() - 0.5) * 10, y: (r() - 0.5) * 20, z: (r() - 0.5) * 10 } };
      const a = structuredClone(base), b = structuredClone(base), dt = 0.05;
      const ga = moveWithCollisions(a.pos, a.vel, dt, isSolid, H, PW);
      const gb = refCollision(b.pos, b.vel, dt, isSolid, H, PW);
      expect({ ...a, ground: ga }).toEqual({ ...b, ground: gb });
    }
  });

  it('retombe sur le sol : vitesse verticale annulée et au sol', () => {
    const isSolid = (x, y) => Math.floor(y) < 3;
    const pos = { x: 0, y: 3 + H + 0.05, z: 0 }, vel = { x: 0, y: -5, z: 0 };
    expect(moveWithCollisions(pos, vel, 0.05, isSolid, H, PW)).toBe(true);
    expect(vel.y).toBe(0);
    expect(pos.y).toBeCloseTo(3 + H);
  });

  it('un mur arrête le déplacement horizontal', () => {
    const isSolid = (x, y) => Math.floor(x) >= 2 && Math.floor(y) >= 3;
    const pos = { x: 1.6, y: 3 + H, z: 0 }, vel = { x: 4, y: 0, z: 0 };
    moveWithCollisions(pos, vel, 0.1, isSolid, H, PW);
    expect(vel.x).toBe(0);
    expect(pos.x).toBe(1.6);
  });
});

describe('stickDirection', () => {
  // Ancienne version : right*lx + forward*(-lz), normalisée
  const ref = (lx, lz, yaw) => {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    let x = rx * lx + fx * -lz, z = rz * lx + fz * -lz;
    const l = Math.hypot(x, z);
    if (l > 0) { x /= l; z /= l; }
    return { x, z };
  };

  it('même résultat que l’ancien calcul', () => {
    const r = rng(3);
    for (let i = 0; i < 500; i++) {
      const lx = r() * 2 - 1, lz = r() * 2 - 1, yaw = r() * 12 - 6;
      const a = stickDirection(lx, lz, yaw), b = ref(lx, lz, yaw);
      expect(a.x).toBeCloseTo(b.x, 10);
      expect(a.z).toBeCloseTo(b.z, 10);
    }
  });

  it('stick vers l’avant avec yaw 0 : on avance vers -z', () => {
    const d = stickDirection(0, -1, 0);
    expect(d.x).toBeCloseTo(0);
    expect(d.z).toBeCloseTo(-1);
  });

  it('stick au repos : direction nulle', () => {
    expect(stickDirection(0, 0, 1.2)).toEqual({ x: 0, z: 0 });
  });
});

describe('swingPose', () => {
  it('repos aux extrémités du coup, amplitude maximale à mi-course', () => {
    for (const sword of [true, false]) {
      expect(swingPose(sword, 0).rotX).toBeCloseTo(0);
      expect(swingPose(sword, 1).dropY).toBeCloseTo(0);
      expect(Math.abs(swingPose(sword, 0.5).rotX)).toBeGreaterThan(Math.abs(swingPose(sword, 0.2).rotX));
    }
  });
  it('épée : balayage horizontal ; pioche : coup vers le bas', () => {
    expect(swingPose(true, 0.5)).toEqual({ rotX: -0.85, rotZ: -1.15, dropY: 0.08 });
    expect(swingPose(false, 0.5)).toEqual({ rotX: -1.55, rotZ: 0.22, dropY: 0.06 });
  });
});

describe('breakPercent', () => {
  it('proportionnel puis plafonné à 100', () => {
    expect(breakPercent(0.5, 2)).toBe(25);
    expect(breakPercent(3, 2)).toBe(100);
  });
});

describe('placementBlocked', () => {
  const cam = { x: 5.5, y: 10.6, z: 5.5 }; // cy = floor(10.6 - 0.8) = 9
  it('refuse la case du joueur (pieds et tête)', () => {
    expect(placementBlocked({ x: 5, y: 9, z: 5 }, cam, 24, 1.6)).toBe(true);
    expect(placementBlocked({ x: 5, y: 10, z: 5 }, cam, 24, 1.6)).toBe(true);
  });
  it('accepte une case voisine ou plus haute', () => {
    expect(placementBlocked({ x: 6, y: 9, z: 5 }, cam, 24, 1.6)).toBe(false);
    expect(placementBlocked({ x: 5, y: 11, z: 5 }, cam, 24, 1.6)).toBe(false);
  });
  it('refuse hors du monde en hauteur', () => {
    expect(placementBlocked({ x: 0, y: -1, z: 0 }, cam, 24, 1.6)).toBe(true);
    expect(placementBlocked({ x: 0, y: 24, z: 0 }, cam, 24, 1.6)).toBe(true);
  });
});

describe('durabilityLook', () => {
  it('vert au-dessus de 50 %, orange jusqu’à 20 %, rouge en dessous', () => {
    expect(durabilityLook(100, 100)).toEqual({ pct: 100, color: '#44ff44' });
    expect(durabilityLook(50, 100).color).toBe('#ffaa00');
    expect(durabilityLook(20, 100).color).toBe('#ff3333');
    expect(durabilityLook(1, 3)).toEqual({ pct: 33, color: '#ffaa00' });
  });
});

describe('blastCells', () => {
  it('sphère de rayon 3 : 123 cases au milieu du monde', () => {
    expect(blastCells({ x: 20.5, y: 10.2, z: 20.5 }, 3, 64, 24)).toHaveLength(123);
  });
  it('rien en dehors du monde', () => {
    const cells = blastCells({ x: 0.5, y: 1.5, z: 0.5 }, 3, 64, 24);
    expect(cells.every(c => c.x >= 0 && c.y >= 0 && c.z >= 0)).toBe(true);
    expect(cells.length).toBeLessThan(123);
  });
  it('toutes les cases sont dans le rayon', () => {
    for (const c of blastCells({ x: 10, y: 10, z: 10 }, 3, 64, 24))
      expect((c.x - 10) ** 2 + (c.y - 10) ** 2 + (c.z - 10) ** 2).toBeLessThanOrEqual(9);
  });
});
