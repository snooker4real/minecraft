import { describe, expect, it } from 'vitest';
import { armRotationX, mobVelocity, nextMobState, stepFlying, stepWalking } from './mobLogic';

describe('nextMobState', () => {
  it('hostile : poursuit sous le seuil de détection, abandonne au-delà du seuil de perte', () => {
    expect(nextMobState('wander', true, 5, 10, 20)).toBe('chase');
    expect(nextMobState('chase', true, 25, 10, 20)).toBe('wander');
  });

  it('hostile : garde son état entre les deux seuils', () => {
    expect(nextMobState('chase', true, 15, 10, 20)).toBe('chase');
    expect(nextMobState('wander', true, 15, 10, 20)).toBe('wander');
  });

  it('passif : fuit à moins de 5 blocs, se calme au-delà de 9', () => {
    expect(nextMobState('wander', false, 4, 10, 20)).toBe('flee');
    expect(nextMobState('flee', false, 7, 10, 20)).toBe('flee');
    expect(nextMobState('flee', false, 10, 10, 20)).toBe('wander');
  });
});

describe('mobVelocity', () => {
  const wanderDir = { x: 1, y: -1 };

  it('poursuite : vers le joueur à pleine vitesse', () => {
    expect(mobVelocity('chase', 3, 4, 5, 10, wanderDir)).toEqual({ x: 6, z: 8 });
  });

  it('fuite : à l’opposé du joueur', () => {
    const v = mobVelocity('flee', 3, 4, 5, 10, wanderDir);
    expect(v.x).toBeCloseTo(-6);
    expect(v.z).toBeCloseTo(-8);
  });

  it('errance : 45 % de la vitesse dans la direction aléatoire', () => {
    const v = mobVelocity('wander', 3, 4, 5, 10, wanderDir);
    expect(v.x).toBeCloseTo(4.5);
    expect(v.z).toBeCloseTo(-4.5);
  });

  it('ne divise pas par zéro sur le joueur', () => {
    expect(Number.isFinite(mobVelocity('chase', 0, 0, 0, 10, wanderDir).x)).toBe(true);
  });
});

describe('armRotationX', () => {
  it('zombie : bras tendus, autres mobs : balancement seul', () => {
    expect(armRotationX('ZOMBIE', 0, -1)).toBeCloseTo(-0.7);
    expect(armRotationX('SKELETON', 0, -1)).toBeCloseTo(0);
  });

  it('les deux bras sont en opposition de phase', () => {
    const phase = Math.PI / 2;
    expect(armRotationX('SKELETON', phase, 1)).toBeCloseTo(-armRotationX('SKELETON', phase, -1));
  });
});

// Monde factice : sol plein à y = 0, plus des blocs ajoutés par chaque test
const makeWorld = (extra = () => false) => ({
  getBlock: (x, y, z) => (y < 1 || extra(x, y, z) ? 1 : 0),
  AIR: 0, SIZE: 16, HEIGHT: 24, GRAVITY: -20,
});
const makeMob = (over = {}) => ({
  pos: { x: 8, y: 1.05, z: 8 }, vel: { x: 0, y: 0, z: 0 },
  wanderDir: { x: 1, y: 1 }, onGround: false, state: 'wander', ...over,
});

describe('stepWalking', () => {
  it('tombe puis se pose sur le sol', () => {
    const mob = makeMob({ pos: { x: 8, y: 5, z: 8 } });
    for (let i = 0; i < 60; i++) stepWalking(mob, 0, 0, 0.05, makeWorld());
    expect(mob.onGround).toBe(true);
    expect(mob.pos.y).toBeCloseTo(1.05);
    expect(mob.vel.y).toBe(0);
  });

  it('avance quand rien ne bloque', () => {
    const mob = makeMob();
    stepWalking(mob, 2, 0, 0.5, makeWorld());
    expect(mob.pos.x).toBeCloseTo(9);
  });

  it('un bloc devant renvoie le mob dans l’autre sens', () => {
    const mob = makeMob();
    stepWalking(mob, 40, 0, 0.05, makeWorld((x, y) => x === 10 && y === 1));
    expect(mob.pos.x).toBe(8);
    expect(mob.wanderDir.x).toBe(-1);
  });

  it('en poursuite et au sol, saute par-dessus le bloc', () => {
    const mob = makeMob({ state: 'chase', onGround: true });
    stepWalking(mob, 0, 40, 0.05, makeWorld((x, y, z) => z === 10 && y === 1));
    expect(mob.wanderDir.y).toBe(-1);
    expect(mob.vel.y).toBe(5.5);
  });

  it('reste dans les limites du monde', () => {
    const mob = makeMob({ pos: { x: 15.4, y: 1.05, z: 0.6 } });
    stepWalking(mob, 20, -20, 1, makeWorld());
    expect(mob.pos.x).toBe(15.5);
    expect(mob.pos.z).toBe(0.5);
  });

  it('hors du monde, ne lit pas de bloc et continue de tomber', () => {
    const mob = makeMob({ pos: { x: -3, y: 5, z: 8 } });
    stepWalking(mob, 0, 0, 0.1, makeWorld());
    expect(mob.pos.y).toBeLessThan(5);
  });
});

describe('stepFlying', () => {
  it('avance en XZ et rejoint la hauteur cible en douceur', () => {
    const mob = makeMob({ pos: { x: 0, y: 0, z: 0 } });
    stepFlying(mob, 2, -2, 0.1, 10);
    expect(mob.pos.x).toBeCloseTo(0.2);
    expect(mob.pos.z).toBeCloseTo(-0.2);
    expect(mob.pos.y).toBeCloseTo(3); // 10 * 0.3
  });
});
