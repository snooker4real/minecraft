import { describe, expect, it } from 'vitest';
import { armRotationX, mobVelocity, nextMobState } from './mobLogic';

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
