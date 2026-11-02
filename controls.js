// ============================================================
//  Controls — keyboard, mouse, pointer lock, block interaction
//  Depends on: utils/constants.js, world.js, player.js
//  Note: initControls() must be called from game.js after the
//        renderer is created (renderer.domElement is needed).
// ============================================================

const MOUSE_SENS     = 0.002;
const ATTACK_COOLDOWN_MS = 400;
const PLACE_COOLDOWN_MS  = 200;

// ---- Keyboard state ----
const keys = {};
document.addEventListener('keydown', e => { keys[e.code] = true; });
document.addEventListener('keyup',   e => { keys[e.code] = false; });

// ---- Hotbar ----
let hotbarIndex = 0;

function cycleHotbar(dir) {
  hotbarIndex = (hotbarIndex + dir + HOTBAR.length) % HOTBAR.length;
  updateHUD();
}

document.addEventListener('keydown', e => {
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= 9) { hotbarIndex = n - 1; updateHUD(); }
  if (e.code === 'Escape') togglePause();
});

document.addEventListener('wheel', e => {
  cycleHotbar(e.deltaY > 0 ? 1 : -1);
});

// ---- Pointer lock ----
let locked = false;
let gameStarted = false;

// Cached DOM refs
const elPaused     = document.getElementById('paused');
const elMenu       = document.getElementById('menu');
const elBreakWrap  = document.getElementById('break-bar-wrap');
const elBreakBar   = document.getElementById('break-bar');

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  if (gameStarted) {
    elPaused.style.display = locked ? 'none' : 'flex';
    if (!locked) gpMenuResetFocus();
  }
});

function togglePause() {
  if (locked) document.exitPointerLock();
  else if (gameStarted) renderer.domElement.requestPointerLock();
}

function startGame() {
  elMenu.style.display = 'none';
  gameStarted = true;
  renderer.domElement.requestPointerLock();
}

function initControls() {
  renderer.domElement.addEventListener('click', () => {
    if (!locked && !gameStarted) return;
    if (!locked) renderer.domElement.requestPointerLock();
  });
}

// ---- Menu buttons ----
document.getElementById('btnPlay').addEventListener('click', startGame);

document.getElementById('btnNewWorld').addEventListener('click', () => {
  resetWorld();
  const cx = Math.floor(WORLD_SIZE / 2 / CHUNK_SIZE);
  const cz = Math.floor(WORLD_SIZE / 2 / CHUNK_SIZE);
  for (let dcx = -3; dcx <= 3; dcx++)
    for (let dcz = -3; dcz <= 3; dcz++) {
      getOrCreateChunk(cx + dcx, cz + dcz);
      buildChunkMesh(cx + dcx, cz + dcz);
    }
  let spawnY = WORLD_HEIGHT;
  for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
    if (getBlock(startX, y, startZ) !== BLOCK.AIR) { spawnY = y + 2; break; }
  }
  camera.position.set(startX + 0.5, spawnY + PLAYER_HEIGHT, startZ + 0.5);
  player.vel.set(0, 0, 0);
  startGame();
});

document.getElementById('btnOptions').addEventListener('click', () => {
  alert('Options : à venir !');
});

document.getElementById('btnQuit').addEventListener('click', () => {
  if (confirm('Quitter le jeu ?')) window.close();
});

document.getElementById('btnResume').addEventListener('click', () => {
  if (gameStarted) renderer.domElement.requestPointerLock();
});

document.getElementById('btnBackMenu').addEventListener('click', () => {
  document.exitPointerLock();
  gameStarted = false;
  elPaused.style.display = 'none';
  elMenu.style.display = 'flex';
});

// ---- Mouse look ----
function clampPitch(p) {
  return Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, p));
}

document.addEventListener('mousemove', e => {
  if (!locked) return;
  player.yaw   -= e.movementX * MOUSE_SENS;
  player.pitch  = clampPitch(player.pitch - e.movementY * MOUSE_SENS);
});

// ---- Raycasting (DDA) ----
function raycastBlock() {
  const dir = new THREE.Vector3(0, 0, -1)
    .applyEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ'))
    .normalize();
  return voxelRaycast(camera.position, dir, REACH, WORLD_HEIGHT, (x, y, z) => {
    const b = getBlock(x, y, z);
    return b !== BLOCK.AIR && b !== BLOCK.WATER;
  });
}

// ---- Block interaction ----
let lastBreak = 0, lastPlace = 0;

const toolDurability = {};
for (const id of Object.values(TOOL)) toolDurability[id] = TOOL_DEFS[id].durability;

const breakState = { active: false, x: -1, y: -1, z: -1, progress: 0, duration: 0 };

function getBreakDuration(blockId) {
  const hardness = BLOCK_HARDNESS[blockId] ?? 1;
  const item = HOTBAR[hotbarIndex];
  if (!isTool(item)) return hardness;
  const def = TOOL_DEFS[item];
  if (!def) return hardness;
  const mult = PICKAXE_EFFICIENT.has(blockId) ? def.speedMult : Math.min(def.speedMult, 1.5);
  return Math.max(0.05, hardness / mult);
}

function startBreak() {
  const r = raycastBlock();
  if (!r.hit) return;
  breakState.active   = true;
  breakState.x        = r.x;
  breakState.y        = r.y;
  breakState.z        = r.z;
  breakState.progress = 0;
  breakState.duration = getBreakDuration(getBlock(r.x, r.y, r.z));
}

function cancelBreak() {
  breakState.active      = false;
  breakState.progress    = 0;
  elBreakWrap.style.display = 'none';
  elBreakBar.style.width    = '0%';
}

function updateBreaking(dt) {
  if (!breakState.active || !locked) { cancelBreak(); return; }
  const r = raycastBlock();
  if (!r.hit || r.x !== breakState.x || r.y !== breakState.y || r.z !== breakState.z) {
    cancelBreak(); return;
  }
  breakState.progress += dt;
  if (typeof swingState !== 'undefined' && !swingState.active) triggerSwing();

  const pct = Math.min(breakState.progress / breakState.duration * 100, 100);
  elBreakWrap.style.display = 'block';
  elBreakBar.style.width    = pct + '%';

  if (breakState.progress >= breakState.duration) {
    const brokenId = getBlock(breakState.x, breakState.y, breakState.z);
    setBlock(breakState.x, breakState.y, breakState.z, BLOCK.AIR);
    buildBlockMesh(breakState.x, breakState.z);
    if (typeof spawnDrop === 'function') {
      const drop = BLOCK_DROPS[brokenId];
      if (drop) spawnDrop(breakState.x, breakState.y, breakState.z, drop.id, drop.count);
    }
    const item = HOTBAR[hotbarIndex];
    if (isTool(item) && toolDurability[item] > 0) {
      toolDurability[item]--;
      buildHUD();
    }
    cancelBreak();
    lastBreak = Date.now();
  }
}

// ---- Shared action helpers ----
function tryAttackMob() {
  const hitMob = (typeof raycastMob === 'function') ? raycastMob() : null;
  if (!hitMob) return false;
  const now = Date.now();
  if (now - lastBreak <= ATTACK_COOLDOWN_MS) return true;
  lastBreak = now;
  triggerSwing();
  hitMob.hp    = 0;
  hitMob.alive = false;
  if (typeof spawnHitParticles === 'function')
    spawnHitParticles(
      hitMob.pos.clone().add(new THREE.Vector3(0, hitMob.def.h * 0.5, 0)),
      hitMob.def.color
    );
  return true;
}

function tryPlaceBlock() {
  const now = Date.now();
  if (now - lastPlace <= PLACE_COOLDOWN_MS) return;
  if (isTool(HOTBAR[hotbarIndex])) return;
  const r = raycastBlock();
  if (!r.hit) return;
  const { prevX: px, prevY: py, prevZ: pz } = r;
  if (py < 0 || py >= WORLD_HEIGHT) return;
  const cpx = Math.floor(camera.position.x);
  const cpy = Math.floor(camera.position.y - PLAYER_HEIGHT / 2);
  const cpz = Math.floor(camera.position.z);
  if (px === cpx && (py === cpy || py === cpy + 1) && pz === cpz) return;
  lastPlace = now;
  setBlock(px, py, pz, HOTBAR[hotbarIndex]);
  buildBlockMesh(px, pz);
}

document.addEventListener('mousedown', e => {
  if (!locked) return;
  if (e.button === 0) {
    if (!tryAttackMob() && !breakState.active) {
      startBreak();
      triggerSwing();
    }
  }
  if (e.button === 2) tryPlaceBlock();
});

document.addEventListener('mouseup', e => {
  if (e.button === 0) cancelBreak();
});

document.addEventListener('contextmenu', e => e.preventDefault());

// ============================================================
//  MANETTE PS4 — Gamepad API
//  Mapping DualShock 4 standard :
//    Stick gauche  (axes 0/1) → déplacement
//    Stick droit   (axes 2/3) → caméra
//    ×  (btn 0)               → sauter
//    ○  (btn 1)               → placer un bloc
//    □  (btn 2)               → casser / frapper
//    L2 (btn 6)               → casser / frapper
//    L1 (btn 4)               → slot hotbar précédent
//    R1 (btn 5)               → slot hotbar suivant
//    △  (btn 3)               → cycle difficulté
//    Options (btn 9)          → pause
// ============================================================

const GP = {
  DEADZONE:  0.12,
  LOOK_SENS: 0.04,
  REPEAT_MS: 250,
};

const gpLastPress = {};

function gpPressed(gp, idx) {
  if (!gp.buttons[idx]?.pressed) return false;
  const now = performance.now();
  if (now - (gpLastPress[idx] || 0) < GP.REPEAT_MS) return false;
  gpLastPress[idx] = now;
  return true;
}

function applyDeadzone(v) {
  return Math.abs(v) < GP.DEADZONE ? 0 : v;
}

// Reusable vectors to avoid per-frame allocations

function findGamepad() {
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const g of gamepads) { if (g?.connected) return g; }
  return null;
}

function gpMove(gp) {
  const lx = applyDeadzone(gp.axes[0]);
  const lz = applyDeadzone(gp.axes[1]);
  if (lx === 0 && lz === 0) return;
  const dir = stickDirection(lx, lz, player.yaw);
  player.vel.x = dir.x * PLAYER_SPEED;
  player.vel.z = dir.z * PLAYER_SPEED;
}

function gpLook(gp) {
  const rx = applyDeadzone(gp.axes[2]);
  const ry = applyDeadzone(gp.axes[3]);
  player.yaw   -= rx * GP.LOOK_SENS;
  player.pitch  = clampPitch(player.pitch - ry * GP.LOOK_SENS);
}

function gpAttack(gp) {
  const attackPressed = gp.buttons[2]?.pressed || gp.buttons[6]?.pressed;
  if (!attackPressed) { cancelBreak(); return; }
  if (!breakState.active && !tryAttackMob()) { startBreak(); triggerSwing(); }
}

function gpButtons(gp) {
  if (gpPressed(gp, 1) || gpPressed(gp, 7)) tryPlaceBlock();

  if (gpPressed(gp, 4)) cycleHotbar(-1);
  if (gpPressed(gp, 5)) cycleHotbar(1);

  if (gpPressed(gp, 3))  setDifficulty(difficulty >= 5 ? 1 : difficulty + 1);
  if (gpPressed(gp, 10)) { hotbarIndex = 0;                        updateHUD(); }
  if (gpPressed(gp, 11)) { hotbarIndex = HOTBAR.findIndex(isTool); updateHUD(); }
  if (gpPressed(gp, 9))  togglePause();
  if (gpPressed(gp, 14)) toggleInventory(); // D-pad gauche → inventaire
}

function pollGamepad(dt) {
  const gp = findGamepad();
  if (!gp) return;

  gpMove(gp);
  gpLook(gp);
  if (gp.buttons[0]?.pressed && player.onGround) {
    player.vel.y = JUMP_FORCE;
    player.onGround = false;
  }
  gpAttack(gp);
  gpButtons(gp);
}

// ============================================================
//  GAMEPAD MENU NAVIGATION
//  Called from animate() when the game is NOT locked.
//  Mapping :
//    Stick gauche Y / D-pad ↑↓ → naviguer
//    ×  (btn 0) → confirmer / cliquer
//    ○  (btn 1) → annuler / retour
//    Options (btn 9) → démarrer (menu principal seulement)
// ============================================================

const gpMenu = {
  focus:   0,
  lastNav: 0,
  NAV_DELAY: 180,
};

function gpMenuResetFocus() { gpMenu.focus = 0; }

function _elVisible(id) {
  const el = document.getElementById(id);
  return el ? getComputedStyle(el).display !== 'none' : false;
}

function _gpMenuItems() {
  if (_elVisible('save-modal'))
    return [...document.querySelectorAll('#save-modal .mc-btn')];
  if (_elVisible('load-modal'))
    return [...document.querySelectorAll('#load-list .mc-btn, #load-modal-close')];
  if (_elVisible('death-screen'))
    return [...document.querySelectorAll('#btnRespawn, #btnDeathMenu')];
  if (_elVisible('paused'))
    return [...document.querySelectorAll('#btnResume, #btnSave, #btnLoad, #btnBackMenu')];
  if (_elVisible('menu'))
    return [...document.querySelectorAll('#btnPlay, #btnNewWorld, #btnOptions, #btnQuit')];
  return [];
}

function _gpMenuSetFocus(items) {
  document.querySelectorAll('.gp-focus').forEach(el => el.classList.remove('gp-focus'));
  if (items[gpMenu.focus]) items[gpMenu.focus].classList.add('gp-focus');
}

function gpMenuNavigate(gp, items) {
  const now    = performance.now();
  const ly     = applyDeadzone(gp.axes[1]);
  const navUp  = gp.buttons[12]?.pressed || ly < -0.5;
  const navDown= gp.buttons[13]?.pressed || ly >  0.5;

  if ((navUp || navDown) && now - gpMenu.lastNav > gpMenu.NAV_DELAY) {
    gpMenu.lastNav = now;
    gpMenu.focus   = (gpMenu.focus + (navDown ? 1 : -1) + items.length) % items.length;
    _gpMenuSetFocus(items);
  }
}

// ○ → ferme la fenêtre ouverte (sauvegarde, chargement) ou revient au menu depuis la pause
function gpMenuBack() {
  for (const id of ['save-modal', 'load-modal']) {
    if (_elVisible(id)) { document.getElementById(id).style.display = 'none'; return; }
  }
  if (_elVisible('paused')) document.getElementById('btnBackMenu')?.click();
}

function pollGamepadMenu() {
  const gp = findGamepad();
  if (!gp) return;

  const items = _gpMenuItems();
  if (!items.length) {
    document.querySelectorAll('.gp-focus').forEach(el => el.classList.remove('gp-focus'));
    return;
  }

  gpMenu.focus = Math.max(0, Math.min(gpMenu.focus, items.length - 1));
  _gpMenuSetFocus(items);
  gpMenuNavigate(gp, items);

  // × → confirmer
  if (gpPressed(gp, 0)) items[gpMenu.focus]?.click();
  if (gpPressed(gp, 1)) gpMenuBack();

  // D-pad gauche → fermer l'inventaire si ouvert
  if (gpPressed(gp, 14) && _elVisible('inventory-screen'))
    if (typeof toggleInventory === 'function') toggleInventory();

  // Options → lancer le jeu depuis le menu principal
  if (gpPressed(gp, 9) && _elVisible('menu')) startGame();
}
