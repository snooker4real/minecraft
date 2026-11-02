// ============================================================
//  MOBS — Entities, AI, health system
//  Depends on: utils/constants.js, world.js, player.js, THREE
//  game.js must call: initMobs(), updateMobs(dt)
// ============================================================

// ================================================================
//  PLAYER HEALTH
// ================================================================
const playerHealth = { hp: 20, maxHp: 20, lastHit: 0, dead: false };

function updateHealthHUD() {
  const bar = document.getElementById('health-bar');
  if (!bar) return;
  bar.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const heart = document.createElement('span');
    const full  = playerHealth.hp >= (i + 1) * 2;
    const half  = !full && playerHealth.hp >= i * 2 + 1;
    heart.textContent = full ? '❤' : half ? '❤' : '♡';
    heart.className   = full ? 'heart-full' : half ? 'heart-half' : 'heart-empty';
    bar.appendChild(heart);
  }
}

function hurtPlayer(dmg) {
  if (playerHealth.dead) return;
  const now = Date.now();
  if (now - playerHealth.lastHit < 800) return; // brief iframes
  playerHealth.lastHit = now;
  playerHealth.hp = Math.max(0, playerHealth.hp - dmg);
  updateHealthHUD();

  // Red flash
  const flash = document.getElementById('dmg-flash');
  if (flash) {
    flash.style.opacity = '0.45';
    clearTimeout(flash._timer);
    flash._timer = setTimeout(() => { flash.style.opacity = '0'; }, 350);
  }

  if (playerHealth.hp <= 0 && !playerHealth.dead) {
    playerHealth.dead = true;
    setTimeout(showDeathScreen, 400);
  }
}

function showDeathScreen() {
  if (document.pointerLockElement) document.exitPointerLock();
  const ds = document.getElementById('death-screen');
  if (ds) ds.style.display = 'flex';
}

function respawn() {
  playerHealth.hp = 20;
  playerHealth.dead = false;
  updateHealthHUD();
  // Find spawn surface
  let sy = WORLD_HEIGHT;
  for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
    if (getBlock(startX, y, startZ) !== BLOCK.AIR) { sy = y + 2; break; }
  }
  camera.position.set(startX + 0.5, sy + PLAYER_HEIGHT, startZ + 0.5);
  player.vel.set(0, 0, 0);
  document.getElementById('death-screen').style.display = 'none';
  renderer.domElement.requestPointerLock();
}

// ================================================================
//  DIFFICULTY SYSTEM (1–5 stars, like GTA)
// ================================================================
let difficulty = 2; // default: 2 stars out of 5

// Per-star scaling tables
const DIFF_DETECTION  = [4,  7,  10, 14, 18];  // chase range (blocks)
const DIFF_LOSE       = [7, 10,  14, 18, 24];  // lose-chase range
const DIFF_SPEED_MULT = [0.5, 0.75, 1, 1.4, 1.9];  // speed multiplier
const DIFF_DMG_MULT   = [0.4, 0.65, 1, 1.5, 2.2];  // damage multiplier
const DIFF_COOLDOWN   = [3.5, 2.5,  2, 1.3, 0.8];  // attack cooldown (s)

function getDiffIdx() { return Math.max(0, Math.min(4, difficulty - 1)); }

function setDifficulty(d) {
  difficulty = Math.max(1, Math.min(5, d));
  updateDifficultyHUD();
}

function updateDifficultyHUD() {
  const el = document.getElementById('difficulty-hud');
  if (!el) return;
  el.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('span');
    star.textContent = i <= difficulty ? '⭐' : '☆';
    star.className = 'diff-star' + (i <= difficulty ? ' active' : '');
    star.title = `Difficulté ${i}`;
    star.addEventListener('click', () => setDifficulty(i));
    el.appendChild(star);
  }
  // Label under stars
  const labels = ['Paisible','Facile','Normal','Difficile','Enfer'];
  const lbl = document.createElement('div');
  lbl.id = 'diff-label';
  lbl.textContent = labels[getDiffIdx()];
  el.appendChild(lbl);
}

// Keyboard [ and ] to decrease/increase difficulty
document.addEventListener('keydown', e => {
  if (e.code === 'BracketLeft')  setDifficulty(difficulty - 1);
  if (e.code === 'BracketRight') setDifficulty(difficulty + 1);
});

// ================================================================
//  MOB DEFINITIONS
// ================================================================
const MOB_TYPES = {
  PIG: {
    name: 'Cochon', label: '🐷', hostile: false,
    hp: 10, speed: 1.2, dmg: 0,
    w: 0.9, h: 0.95, d: 0.55, eyeH: 0.7,
    color: 0xf4acb7, spawnOnGrass: true,
  },
  ZOMBIE: {
    name: 'Zombie', label: '🧟', hostile: true,
    hp: 20, speed: 1.3, dmg: 2,
    w: 0.6, h: 1.85, d: 0.6, eyeH: 1.6,
    color: 0x5dbb6c, spawnOnGrass: true,
  },
  SKELETON: {
    name: 'Squelette', label: '💀', hostile: true,
    hp: 20, speed: 1.4, dmg: 2,
    w: 0.6, h: 1.85, d: 0.6, eyeH: 1.6,
    color: 0xddddcc, spawnOnGrass: true,
  },
  SPIDER: {
    name: 'Araignée', label: '🕷', hostile: true,
    hp: 16, speed: 1.8, dmg: 1,
    w: 1.4, h: 0.65, d: 0.9, eyeH: 0.5,
    color: 0x222222, spawnOnGrass: true,
  },
  PHANTOM: {
    name: 'Fantôme', label: '👻', hostile: true,
    hp: 20, speed: 2.2, dmg: 3,
    w: 0.9, h: 0.55, d: 1.3, eyeH: 0.4,
    color: 0x8844ee, flies: true, spawnOnGrass: false,
  },
  CREEPER: {
    name: 'Creeper', label: '💚', hostile: true,
    hp: 20, speed: 1.2, dmg: 4,
    w: 0.6, h: 1.7, d: 0.6, eyeH: 1.4,
    color: 0x45b34e, spawnOnGrass: true,
  },
};

// ================================================================
//  BUILD MOB MESHES (procedural, all BoxGeometry)
// ================================================================
function buildMobMesh(type) {
  const def = MOB_TYPES[type];
  const group = new THREE.Group();

  // Helper
  function box(w, h, d, color, x, y, z, rx = 0, rz = 0) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color })
    );
    m.position.set(x, y, z);
    m.rotation.x = rx;
    m.rotation.z = rz;
    group.add(m);
    return m;
  }

  if (type === 'PIG') {
    const pink = 0xfdb7c8, darkPink = 0xe89aaa, snout = 0xd47090;
    box(0.9, 0.6, 0.55, pink,     0,     0.55,  0);         // body
    const head = box(0.55, 0.55, 0.55, pink,   0,     0.85, -0.48);  // head
    box(0.28, 0.18, 0.12, snout,  0,     0.76, -0.78);      // snout
    // legs
    [ [-0.28,0.22,-0.18], [0.28,0.22,-0.18], [-0.28,0.22,0.18], [0.28,0.22,0.18] ]
      .forEach(([lx,ly,lz]) => { const l = box(0.2, 0.44, 0.2, darkPink, lx, ly, lz); l.userData.isLeg = true; l.userData.phase = lx < 0 ? 0 : Math.PI; });
    // ears
    box(0.15, 0.18, 0.04, snout, -0.22, 1.1, -0.48);
    box(0.15, 0.18, 0.04, snout,  0.22, 1.1, -0.48);
    // eyes
    const eyeM = new THREE.MeshBasicMaterial({ color: 0x111111 });
    [-0.14, 0.14].forEach(ex => {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.04), eyeM);
      e.position.set(ex, 0.89, -0.76); group.add(e);
    });
  }

  else if (type === 'ZOMBIE') {
    const skin = 0x6dcc7e, dark = 0x3a7a4a, shirt = 0x3355aa, cloth = 0x224488;
    box(0.5, 0.75, 0.28, shirt,   0,    0.875, 0);       // torso
    box(0.5, 0.5,  0.5,  skin,   0,    1.5,   0);         // head
    // eyes (glow red)
    const eyeM = new THREE.MeshBasicMaterial({ color: 0xff2200 });
    [-0.12, 0.12].forEach(ex => {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.04), eyeM); e.position.set(ex, 1.54, -0.26); group.add(e);
    });
    // mouth (rotting dark)
    const mM = new THREE.MeshBasicMaterial({ color: 0x222208 });
    const mo = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.04), mM); mo.position.set(0, 1.42, -0.26); group.add(mo);
    // arms (raised like zombie)
    const aL = box(0.24, 0.7, 0.24, dark, -0.37, 1.2, -0.2, -0.7, 0); aL.userData.isArm = true; aL.userData.armSide = -1;
    const aR = box(0.24, 0.7, 0.24, dark,  0.37, 1.2, -0.2, -0.7, 0); aR.userData.isArm = true; aR.userData.armSide = 1;
    // legs
    const lL = box(0.24, 0.75, 0.24, cloth, -0.13, 0.375, 0); lL.userData.isLeg = true; lL.userData.phase = 0;
    const lR = box(0.24, 0.75, 0.24, cloth,  0.13, 0.375, 0); lR.userData.isLeg = true; lR.userData.phase = Math.PI;
  }

  else if (type === 'SKELETON') {
    const bone = 0xd8d8c8, dark = 0xb8b8a8;
    box(0.44, 0.7, 0.22, bone,   0,    0.85, 0);      // rib cage (thin)
    box(0.5,  0.5, 0.5,  bone,   0,    1.5,  0);       // skull
    // hollow eye sockets
    const eyeM = new THREE.MeshBasicMaterial({ color: 0x111100 });
    [-0.12, 0.12].forEach(ex => {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.05), eyeM); e.position.set(ex, 1.52, -0.26); group.add(e);
    });
    // arms
    const aL = box(0.16, 0.65, 0.16, dark, -0.3, 1.1, 0); aL.userData.isArm = true; aL.userData.armSide = -1;
    const aR = box(0.16, 0.65, 0.16, dark,  0.3, 1.1, 0); aR.userData.isArm = true; aR.userData.armSide = 1;
    // legs (separated)
    const lL = box(0.16, 0.7, 0.16, bone, -0.12, 0.35, 0); lL.userData.isLeg = true; lL.userData.phase = 0;
    const lR = box(0.16, 0.7, 0.16, bone,  0.12, 0.35, 0); lR.userData.isLeg = true; lR.userData.phase = Math.PI;
    // bow (visual only)
    box(0.06, 0.5, 0.06, 0x885522, 0.45, 1.2, -0.15, -0.3, 0.3);
  }

  else if (type === 'SPIDER') {
    const sp = 0x1a1a1a, sp2 = 0x333333;
    box(0.7,  0.5, 0.9, sp,  0.3,  0.35, 0);   // abdomen
    box(0.5,  0.4, 0.4, sp2, -0.42, 0.3, 0);   // head/cephalothorax
    // rows of red eyes
    const eyeM = new THREE.MeshBasicMaterial({ color: 0xff1100 });
    [[-0.14, 0.38, -0.21], [0.14, 0.38, -0.21], [-0.08, 0.44, -0.21], [0.08, 0.44, -0.21]].forEach(([ex,ey,ez]) => {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.04), eyeM); e.position.set(-0.42+ex, ey, ez); group.add(e);
    });
    // legs (4 pairs)
    for (let i = 0; i < 4; i++) {
      const side = i < 2 ? -1 : 1;
      const zOff = [-0.3, 0, 0.3, 0.15][i];
      const yAng = (i < 2 ? 0.4 : 0.3) * side;
      const leg = box(0.85, 0.08, 0.08, sp2, side * 0.55, 0.28, zOff - (i%2)*0.1, 0, yAng);
      leg.userData.isLeg = true; leg.userData.phase = i * Math.PI / 2;
    }
  }

  else if (type === 'PHANTOM') {
    const purple = 0x7733cc, wing = 0x5522aa, eye = 0x00ffaa;
    box(0.9, 0.32, 1.15, purple, 0, 0.16, 0);  // body
    // wings
    const wL = box(1, 0.1, 0.6, wing, -0.95, 0.16, 0.05); wL.userData.isWing = true; wL.userData.side = -1;
    const wR = box(1, 0.1, 0.6, wing,  0.95, 0.16, 0.05); wR.userData.isWing = true; wR.userData.side = 1;
    // eye glow
    const eyeM = new THREE.MeshBasicMaterial({ color: eye });
    [-0.2, 0.2].forEach(ex => {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.05), eyeM); e.position.set(ex, 0.26, -0.58); group.add(e);
    });
    // tail
    box(0.3, 0.18, 0.5, purple, 0, 0.16, 0.72);
  }

  else if (type === 'CREEPER') {
    const green = 0x3dae45, dark = 0x1e6b24, face = 0x2a8a32;
    box(0.5, 0.75, 0.3, green, 0, 0.875, 0);     // body
    box(0.5, 0.5, 0.5, face,  0, 1.5, 0);         // head
    // creeper face (classic pixel)
    const eyeM  = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const mouthM = new THREE.MeshBasicMaterial({ color: 0x111111 });
    [-0.14, 0.14].forEach(ex => {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.04), eyeM); e.position.set(ex, 1.56, -0.26); group.add(e);
    });
    // mouth (M-shape via 3 boxes)
    [[-0.15,1.36,-0.26],[0,1.38,-0.26],[0.15,1.36,-0.26]].forEach(([mx,my,mz]) => {
      const mp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.04), mouthM); mp.position.set(mx,my,mz); group.add(mp);
    });
    const lL = box(0.24, 0.75, 0.24, dark, -0.13, 0.375, 0); lL.userData.isLeg = true; lL.userData.phase = 0;
    const lR = box(0.24, 0.75, 0.24, dark,  0.13, 0.375, 0); lR.userData.isLeg = true; lR.userData.phase = Math.PI;
  }

  return group;
}

// ================================================================
//  NAME-TAG SPRITE
// ================================================================
function makeMobLabel(type) {
  const def = MOB_TYPES[type];
  const c = document.createElement('canvas');
  c.width = 128; c.height = 28;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.roundRect(0, 0, 128, 28, 5);
  ctx.fill();
  ctx.fillStyle = def.hostile ? '#ff8888' : '#88ff88';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(def.label + ' ' + def.name, 64, 14);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.4, 0.35, 1);
  return sprite;
}

// ================================================================
//  SURFACE HELPER
// ================================================================
function getSurfaceY(bx, bz) {
  bx = Math.floor(bx); bz = Math.floor(bz);
  if (bx < 0 || bx >= WORLD_SIZE || bz < 0 || bz >= WORLD_SIZE) return SEA_LEVEL;
  for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
    const _b = getBlock(bx, y, bz);
    if (_b !== BLOCK.AIR && _b !== BLOCK.WATER)
      return y + 1;
  }
  return SEA_LEVEL;
}

// ================================================================
//  MOB POOL
// ================================================================
const mobs = [];

function spawnMob(type, x, z) {
  const def = MOB_TYPES[type];
  const sy = getSurfaceY(x, z);
  if (sy <= SEA_LEVEL) return;

  const mesh = buildMobMesh(type);
  const label = makeMobLabel(type);
  label.position.y = def.h + 0.55;
  mesh.add(label);

  const pos = new THREE.Vector3(x + 0.5, sy, z + 0.5);
  mesh.position.copy(pos);
  scene.add(mesh);

  mobs.push({
    type, def, mesh, label,
    hp: def.hp, maxHp: def.hp,
    pos,
    vel: new THREE.Vector3(0, 0, 0),
    onGround: false,
    state: 'wander',            // 'wander' | 'chase' | 'flee'
    wanderTimer: Math.random() * 3,
    wanderDir: new THREE.Vector2((Math.random()-0.5)*2, (Math.random()-0.5)*2).normalize(),
    attackCooldown: 0,
    animPhase: Math.random() * Math.PI * 2,
    alive: true,
    flyPhase: Math.random() * Math.PI * 2,
    // Creeper explode state
    fuseTimer: -1,
  });
}

function spawnInitialMobs() {
  const quota  = { PIG: 6, ZOMBIE: 4, SKELETON: 3, SPIDER: 3, PHANTOM: 3, CREEPER: 3 };
  const center = WORLD_SIZE / 2;
  const radius = 48; // spawn dans les chunks déjà générés autour du spawn
  for (const type in quota) {
    let placed = 0, tries = 0;
    while (placed < quota[type] && tries++ < 600) {
      const x = Math.floor(center - radius + Math.random() * radius * 2);
      const z = Math.floor(center - radius + Math.random() * radius * 2);
      const sy = getSurfaceY(x, z);
      if (sy > SEA_LEVEL + 1) { spawnMob(type, x, z); placed++; }
    }
  }
}

// ================================================================
//  RAYCASTING MOBS (for player hitting them)
// ================================================================
function raycastMob() {
  const dir = new THREE.Vector3(0, 0, -1)
    .applyEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ'))
    .normalize();
  const orig = camera.position.clone();

  let best = null, bestDist = Infinity;
  for (const mob of mobs) {
    if (!mob.alive) continue;
    // Centre du mob (milieu du corps, pas les pieds)
    const cx = mob.pos.x;
    const cy = mob.pos.y + mob.def.h * 0.5;
    const cz = mob.pos.z;
    const dx = cx - orig.x, dy = cy - orig.y, dz = cz - orig.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > REACH + 1) continue;
    // Vérifier que le mob est bien devant le joueur
    const dot = (dx*dir.x + dy*dir.y + dz*dir.z) / dist;
    if (dot < 0.6) continue;
    if (dist < bestDist) { best = mob; bestDist = dist; }
  }
  return best;
}

// ================================================================
//  HIT PARTICLE EFFECT
// ================================================================
function spawnHitParticles(pos, color) {
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.12),
      new THREE.MeshBasicMaterial({ color })
    );
    p.position.copy(pos).add(new THREE.Vector3((Math.random()-.5)*0.5, (Math.random()-.5)*0.5 + 0.5, (Math.random()-.5)*0.5));
    const vx = (Math.random()-.5)*4, vy = 2+Math.random()*2, vz = (Math.random()-.5)*4;
    scene.add(p);
    let t = 0;
    const tick = setInterval(() => {
      t += 0.05;
      p.position.x += vx * 0.05;
      p.position.y += (vy - 9.8*t) * 0.05;
      p.position.z += vz * 0.05;
      p.scale.multiplyScalar(0.93);
      if (t > 0.7) { scene.remove(p); clearInterval(tick); }
    }, 50);
  }
}

// ================================================================
//  CREEPER EXPLOSION
// ================================================================
function explodeCreeper(mob) {
  // Destroy blocks in radius
  const r = 3;
  const cx = Math.floor(mob.pos.x), cy = Math.floor(mob.pos.y), cz = Math.floor(mob.pos.z);
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
    if (dx*dx + dy*dy + dz*dz > r*r) continue;
    const bx = cx+dx, by = cy+dy, bz2 = cz+dz;
    if (bx>=0&&bx<WORLD_SIZE&&by>=0&&by<WORLD_HEIGHT&&bz2>=0&&bz2<WORLD_SIZE)
      setBlock(bx, by, bz2, BLOCK.AIR);
  }
  buildWorldMesh();
  // Hurt player if close
  if (mob.pos.distanceTo(camera.position) < r + 1) hurtPlayer(8);
  spawnHitParticles(mob.pos.clone(), 0x3dae45);
  mob.alive = false;
}

// ================================================================
//  MAIN UPDATE — called every frame from game.js
// ================================================================
function updateMobs(dt) {
  if (playerHealth.dead) return;

  const playerPos = camera.position;

  for (let i = mobs.length - 1; i >= 0; i--) {
    const mob = mobs[i];

    // --- Remove dead ---
    if (!mob.alive) {
      spawnHitParticles(mob.pos.clone(), mob.def.color);
      scene.remove(mob.mesh);
      mobs.splice(i, 1);
      continue;
    }

    const def   = mob.def;
    const pos   = mob.pos;
    const dxp   = playerPos.x - pos.x;
    const dzp   = playerPos.z - pos.z;
    const distXZ = Math.hypot(dxp, dzp);
    const dist3D  = playerPos.distanceTo(pos);

    // --- AI state ---
    const idx = getDiffIdx();
    mob.state = nextMobState(mob.state, def.hostile, distXZ, DIFF_DETECTION[idx], DIFF_LOSE[idx]);

    // --- Creeper fuse ---
    if (mob.type === 'CREEPER') {
      if (mob.state === 'chase' && dist3D < 1.8) {
        if (mob.fuseTimer < 0) mob.fuseTimer = 1.5; // 1.5s fuse
        mob.fuseTimer -= dt;
        // Flash white on fuse
        mob.mesh.children.forEach(c => {
          if (c.material) c.material.emissive = new THREE.Color(Math.sin(mob.fuseTimer * 20) > 0 ? 0xffffff : 0x000000);
        });
        if (mob.fuseTimer <= 0) { explodeCreeper(mob); continue; }
      } else {
        mob.fuseTimer = -1;
        mob.mesh.children.forEach(c => { if (c.material && c.material.emissive) c.material.emissive.set(0x000000); });
      }
    }

    // --- Attack ---
    mob.attackCooldown = Math.max(0, mob.attackCooldown - dt);
    if (def.hostile && mob.type !== 'CREEPER' && dist3D < 1.6 && mob.attackCooldown <= 0) {
      hurtPlayer(Math.round(def.dmg * DIFF_DMG_MULT[getDiffIdx()]));
      mob.attackCooldown = DIFF_COOLDOWN[getDiffIdx()];
    }

    // --- Movement ---
    mob.wanderTimer -= dt;
    if (mob.wanderTimer <= 0) {
      mob.wanderDir.set(Math.random()-0.5, Math.random()-0.5).normalize();
      mob.wanderTimer = 2 + Math.random() * 3;
    }

    const spd = def.speed * DIFF_SPEED_MULT[getDiffIdx()];
    const { x: mvx, z: mvz } = mobVelocity(mob.state, dxp, dzp, distXZ, spd, mob.wanderDir);

    // Face movement direction
    if (Math.abs(mvx)+Math.abs(mvz) > 0.05) {
      mob.mesh.rotation.y = Math.atan2(mvx, mvz);
    }

    // --- Physics ---
    if (def.flies) {
      // Float at player height + some offset, bob, dive on chase
      mob.flyPhase += dt * 1.5;
      const targetY = (mob.state === 'chase' && dist3D < 8)
        ? playerPos.y + 1
        : getSurfaceY(Math.floor(pos.x), Math.floor(pos.z)) + 5 + Math.sin(mob.flyPhase) * 1.5;

      pos.x += mvx * dt;
      pos.z += mvz * dt;
      pos.y += (targetY - pos.y) * Math.min(dt * 3, 1);

    } else {
      // Gravity
      mob.vel.x = mvx;
      mob.vel.z = mvz;
      mob.vel.y += GRAVITY * dt;

      // Simple ground collision
      const bx = Math.floor(pos.x), bz2 = Math.floor(pos.z);
      if (bx >= 0 && bx < WORLD_SIZE && bz2 >= 0 && bz2 < WORLD_SIZE) {
        const newY = pos.y + mob.vel.y * dt;
        const footY = newY - 0.05;
        const by = Math.floor(footY);
        if (mob.vel.y <= 0 && by >= 0 && by < WORLD_HEIGHT && getBlock(bx, by, bz2) !== BLOCK.AIR) {
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

      // X movement + wall jump
      const newX = pos.x + mob.vel.x * dt;
      const nbx = Math.floor(newX), nby = Math.floor(pos.y - 0.05);
      if (nbx >= 0 && nbx < WORLD_SIZE && nby >= 0 && nby < WORLD_HEIGHT && getBlock(nbx, nby, Math.floor(pos.z)) !== BLOCK.AIR) {
        mob.wanderDir.x *= -1;
        if (mob.onGround && mob.state === 'chase') mob.vel.y = 5.5; // jump over block
      } else pos.x = newX;

      // Z movement + wall jump
      const newZ = pos.z + mob.vel.z * dt;
      const nbz = Math.floor(newZ), nbx2 = Math.floor(pos.x);
      if (nbx2 >= 0 && nbx2 < WORLD_SIZE && nby >= 0 && nby < WORLD_HEIGHT && getBlock(nbx2, nby, nbz) !== BLOCK.AIR) {
        mob.wanderDir.y *= -1;
        if (mob.onGround && mob.state === 'chase') mob.vel.y = 5.5;
      } else pos.z = newZ;

      // Bound to world
      pos.x = Math.max(0.5, Math.min(WORLD_SIZE - 0.5, pos.x));
      pos.z = Math.max(0.5, Math.min(WORLD_SIZE - 0.5, pos.z));
    }

    // Sync mesh
    mob.mesh.position.copy(pos);

    // --- Animations ---
    mob.animPhase += dt * (mob.state === 'chase' ? 6 : 2.5);
    mob.mesh.children.forEach(child => {
      if (!(child instanceof THREE.Mesh)) return;
      if (child.userData.isLeg) {
        child.rotation.x = Math.sin(mob.animPhase + (child.userData.phase ?? 0)) * 0.55;
      }
      if (child.userData.isArm) {
        child.rotation.x = armRotationX(mob.type, mob.animPhase, child.userData.armSide);
      }
      if (child.userData.isWing) {
        child.rotation.z = child.userData.side * (0.35 + Math.sin(mob.animPhase * 2) * 0.55);
      }
    });
  }
}

// ================================================================
//  INIT called from game.js after scene and world are ready
// ================================================================
function initMobs() {
  updateHealthHUD();
  updateDifficultyHUD();
  spawnInitialMobs();
}
