// ============================================================
//  Game — Three.js setup, HUD, game loop, init
//  Depends on: utils/constants.js, utils/textures.js,
//              world.js, player.js, controls.js, THREE
// ============================================================

// ---- Three.js setup ----
const scene    = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog        = new THREE.Fog(0x87CEEB, 30, 80);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 200);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Lighting
const ambient = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff8e1, 1);
sun.position.set(40, 80, 40);
sun.castShadow = true;
sun.shadow.mapSize.width  = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far  = 200;
sun.shadow.camera.left = sun.shadow.camera.bottom = -60;
sun.shadow.camera.right = sun.shadow.camera.top   =  60;
scene.add(sun);

// ---- Scene objects from other modules ----
scene.add(worldGroup);
scene.add(highlightMesh);

// ---- Item en main (caméra) ----
scene.add(camera);          // nécessaire pour attacher des objets à la caméra
const handPivot = new THREE.Group();
camera.add(handPivot);

// ---- HUD ----
function drawBlockIcon(canvas, bt) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  ctx.clearRect(0, 0, W, W);
  const texSet = TEXTURES[bt];
  if (!texSet) return;

  // Draw isometric-like 3-face cube
  // Top face
  const topImg = texSet.top.image;
  // We'll sample from the canvas textures
  const H = W;
  const topH = Math.floor(H * 0.38);
  const sideH = H - topH;
  const midX = Math.floor(W / 2);

  // Top face (parallelogram)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, topH);
  ctx.lineTo(midX, 0);
  ctx.lineTo(W, topH);
  ctx.lineTo(midX, topH * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(topImg, 0, 0, W, topH * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Left face
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, topH);
  ctx.lineTo(midX, topH * 2);
  ctx.lineTo(midX, H);
  ctx.lineTo(0, H - topH);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(texSet.side.image, 0, topH, midX, sideH);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Right face
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(midX, topH * 2);
  ctx.lineTo(W, topH);
  ctx.lineTo(W, H - topH);
  ctx.lineTo(midX, H);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(texSet.side.image, midX, topH, midX, sideH);
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawToolIcon(canvas, toolId) {
  const ctx = canvas.getContext('2d');
  const W   = canvas.width;
  ctx.clearRect(0, 0, W, W);
  const def = TOOL_DEFS[toolId];
  if (!def) return;

  const p   = W / 16;
  const C   = def.color;
  const Cd  = def.dark;
  const BH  = '#8B5E3C';
  const BHd = '#5C3D1E';

  const fill = (pts, col) => {
    ctx.fillStyle = col;
    pts.forEach(([x, y]) => ctx.fillRect(x * p, y * p, p, p));
  };

  // Tête (couleur principale)
  fill([[0,0],[1,0],[2,0],[0,1],[3,1],[0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[5,3],[6,3],[6,4]], C);
  // Tête (ombre)
  fill([[1,1],[2,1],[3,2],[4,3],[5,4]], Cd);
  // Manche (clair)
  fill([[7,5],[8,6],[9,7],[10,8],[11,9],[12,10],[13,11],[14,12],[15,13]], BH);
  // Manche (ombre)
  fill([[6,5],[7,6],[8,7],[9,8],[10,9],[11,10],[12,11],[13,12],[14,13]], BHd);

  if (toolDurability[toolId] <= 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, W);
  }
}

// ---- Item en main — mesh 3D fixé à la caméra ----
function updateHandMesh() {
  // Nettoyer l'ancienne mesh
  while (handPivot.children.length > 0) {
    const child = handPivot.children[0];
    handPivot.remove(child);
    if (child.geometry) child.geometry.dispose();
    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
    else if (child.material) child.material.dispose();
  }

  const item = HOTBAR[hotbarIndex];
  let mesh;

  if (isTool(item)) {
    // Outil : dessin pixel-art sur canvas → plan incliné
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    drawToolIcon(canvas, item);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    const geo = new THREE.PlaneGeometry(0.44, 0.44);
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, alphaTest: 0.05,
      side: THREE.DoubleSide, depthTest: false,
    });
    mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0.38, -0.3, -0.55);
    mesh.rotation.set(0.25, 0.15, -0.55);   // tenu comme une vraie pioche
    handPivot.userData.baseY = -0.3;
  } else {
    // Bloc : petit cube avec les vraies textures procédurales
    const texSet = TEXTURES[item];
    if (!texSet) return;
    const geo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
    const mats = [
      new THREE.MeshLambertMaterial({ map: texSet.side, depthTest: false }),
      new THREE.MeshLambertMaterial({ map: texSet.side, depthTest: false }),
      new THREE.MeshLambertMaterial({ map: texSet.top,  depthTest: false }),
      new THREE.MeshLambertMaterial({ map: texSet.bot,  depthTest: false }),
      new THREE.MeshLambertMaterial({ map: texSet.side, depthTest: false }),
      new THREE.MeshLambertMaterial({ map: texSet.side, depthTest: false }),
    ];
    mesh = new THREE.Mesh(geo, mats);
    mesh.position.set(0.38, -0.3, -0.55);
    mesh.rotation.set(0.55, -0.75, 0.2);
    handPivot.userData.baseY = -0.3;
  }

  mesh.renderOrder = 999;
  handPivot.add(mesh);
}

function durabilityBar(item) {
  const { pct, color } = durabilityLook(toolDurability[item], TOOL_DEFS[item].durability);
  const wrap = document.createElement('div');
  wrap.className = 'durability-wrap';
  const bar = document.createElement('div');
  bar.className = 'durability-bar';
  bar.style.width      = pct + '%';
  bar.style.background = color;
  wrap.appendChild(bar);
  return wrap;
}

function buildSlot(i) {
  const item     = HOTBAR[i];
  const toolSlot = isTool(item);
  const slot     = document.createElement('div');
  slot.className = 'hotbar-slot' + (i === hotbarIndex ? ' active' : '') + (toolSlot ? ' tool-slot' : '');
  slot.title     = toolSlot ? (TOOL_DEFS[item]?.name ?? '') : (BLOCK_DEFS[item]?.name ?? '');

  const num = document.createElement('div');
  num.className = 'slot-num';
  num.textContent = i < 9 ? (i + 1) : '⛏';
  slot.appendChild(num);

  const icon = document.createElement('canvas');
  icon.className = 'block-icon';
  icon.width = icon.height = 48;
  if (toolSlot) drawToolIcon(icon, item);
  else          drawBlockIcon(icon, item);
  slot.appendChild(icon);

  if (toolSlot) slot.appendChild(durabilityBar(item));
  slot.addEventListener('click', () => { hotbarIndex = i; updateHUD(); });
  return slot;
}

function buildHUD() {
  const hud = document.getElementById('hud');
  hud.innerHTML = '';
  for (let i = 0; i < HOTBAR.length; i++) {
    if (i === 9) {  // séparateur visuel entre blocs et outils
      const sep = document.createElement('div');
      sep.className = 'hotbar-separator';
      hud.appendChild(sep);
    }
    hud.appendChild(buildSlot(i));
  }
}

function updateHUD() {
  document.querySelectorAll('.hotbar-slot').forEach((s, i) => {
    s.classList.toggle('active', i === hotbarIndex);
  });
  const item = HOTBAR[hotbarIndex];
  if (isTool(item)) {
    document.getElementById('blockInfo').textContent = '⛏ ' + (TOOL_DEFS[item]?.name ?? '?');
  } else {
    document.getElementById('blockInfo').textContent = 'Bloc: ' + (BLOCK_DEFS[item]?.name ?? '?');
  }
  updateHandMesh();
}

// ---- Swing animation ----
const swingState = { active: false, t: 0, duration: 0.3 };

function triggerSwing() {
  const item = HOTBAR[hotbarIndex];
  swingState.duration = isSword(item) ? 0.26 : 0.36;
  swingState.active   = true;
  swingState.t        = 0;
}

// ---- FPS counter ----
let frameCount = 0, lastFPS = performance.now(), fps = 0;

// ---- Game loop ----
let lastTime = performance.now();

function updateFps(now) {
  frameCount++;
  if (now - lastFPS < 500) return;
  fps = Math.round(frameCount / ((now - lastFPS) / 1000));
  document.getElementById('fps').textContent = 'FPS: ' + fps;
  frameCount = 0; lastFPS = now;
}

function keyboardMove() {
  const axis = (neg, pos) => (keys[pos[0]] || keys[pos[1]] ? 1 : 0) - (keys[neg[0]] || keys[neg[1]] ? 1 : 0);
  const dir = stickDirection(axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']), -axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']), player.yaw);
  player.vel.x = dir.x * PLAYER_SPEED;
  player.vel.z = dir.z * PLAYER_SPEED;
}

function updateHighlight() {
  const r = raycastBlock();
  highlightMesh.visible = r.hit;
  if (r.hit) highlightMesh.position.set(r.x + 0.5, r.y + 0.5, r.z + 0.5);
}

// Animation de l'item en main : frappe, sinon balancement au repos / à la marche
function animateHand(now, dt) {
  if (handPivot.children.length === 0) return;
  const hand  = handPivot.children[0];
  const baseY = handPivot.userData.baseY ?? -0.3;

  if (swingState.active) {
    swingState.t += dt;
    const p = Math.min(swingState.t / swingState.duration, 1);
    const pose = swingPose(isSword(HOTBAR[hotbarIndex]), p);
    handPivot.rotation.x = pose.rotX;
    handPivot.rotation.z = pose.rotZ;
    hand.position.y = baseY - pose.dropY;
    if (p >= 1) {
      swingState.active   = false;
      handPivot.rotation.x = 0;
      handPivot.rotation.z = 0;
    }
    return;
  }
  handPivot.rotation.x = 0;
  handPivot.rotation.z = 0;
  const moving = Math.abs(player.vel.x) > 0.1 || Math.abs(player.vel.z) > 0.1;
  hand.position.y = baseY + (moving ? Math.sin(now * 0.006) * 0.02 : Math.sin(now * 0.002) * 0.005);
}

function animate(now) {
  requestAnimationFrame(animate);

  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  updateFps(now);

  if (!locked) {
    pollGamepadMenu();
    renderer.render(scene, camera);
    return;
  }

  keyboardMove();
  pollGamepad(dt);     // Manette PS4
  updateBreaking(dt);  // Cassage progressif

  player.vel.y += GRAVITY * dt;
  if ((keys['Space'] || keys['KeySpace']) && player.onGround) {
    player.vel.y = JUMP_FORCE;
    player.onGround = false;
  }
  player.onGround = checkCollision(camera.position, player.vel, dt);

  camera.rotation.order = 'YXZ';
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;

  updateHighlight();
  updateMobs(dt);
  updateDrops(dt);
  processNextChunk();
  updateLoadedChunks(camera.position.x, camera.position.z);
  updateMinimap();

  document.getElementById('pos').textContent =
    `X: ${camera.position.x.toFixed(1)}  Y: ${camera.position.y.toFixed(1)}  Z: ${camera.position.z.toFixed(1)}`;

  animateHand(now, dt);
  renderer.render(scene, camera);
}

// ---- Minimap ----
const MINIMAP_COLORS = {
  [BLOCK.GRASS]:  [90,  154,  48],
  [BLOCK.DIRT]:   [139,  94,  60],
  [BLOCK.STONE]:  [136, 136, 136],
  [BLOCK.SAND]:   [212, 176,  96],
  [BLOCK.WOOD]:   [122,  80,  40],
  [BLOCK.LEAVES]: [ 45, 122,  32],
  [BLOCK.WATER]:  [ 40,  85, 204],
  [BLOCK.SNOW]:   [232, 232, 248],
  [BLOCK.COAL]:   [ 68,  68,  68],
  [BLOCK.COBBLE]: [119, 119, 119],
  [11]: [180, 180, 190],  // iron ore
  [12]: [210, 180,  50],  // gold ore
  [13]: [ 77, 210, 200],  // diamond ore
};

const _mmCanvas = document.getElementById('minimap');
const _mmCtx    = _mmCanvas.getContext('2d');
const MINIMAP_BLOCKS = 128; // blocs visibles (rayon 64)
let   _mmFrame  = 0;

function updateMinimap() {
  _mmFrame++;
  if (_mmFrame % 15 !== 0) return;

  const W   = _mmCanvas.width;            // 128px
  const px  = Math.floor(camera.position.x);
  const pz  = Math.floor(camera.position.z);
  const r   = MINIMAP_BLOCKS / 2;
  const img = _mmCtx.createImageData(W, W);
  const d   = img.data;

  for (let row = 0; row < W; row++) {
    for (let col = 0; col < W; col++) {
      const wx = px - r + Math.round(col * MINIMAP_BLOCKS / W);
      const wz = pz - r + Math.round(row * MINIMAP_BLOCKS / W);
      let surf = BLOCK.STONE;
      for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
        const b = getBlock(wx, y, wz);
        if (b !== BLOCK.AIR) { surf = b; break; }
      }
      const c = MINIMAP_COLORS[surf] || [80, 80, 80];
      const i = (row * W + col) * 4;
      d[i] = c[0]; d[i+1] = c[1]; d[i+2] = c[2]; d[i+3] = 255;
    }
  }
  _mmCtx.putImageData(img, 0, 0);

  // Cadre sombre sur les bords
  _mmCtx.strokeStyle = 'rgba(0,0,0,0.6)';
  _mmCtx.lineWidth   = 1;
  _mmCtx.strokeRect(0.5, 0.5, W - 1, W - 1);

  // Flèche joueur au centre
  const cx = W / 2, cy = W / 2;
  _mmCtx.save();
  _mmCtx.translate(cx, cy);
  _mmCtx.rotate(-player.yaw); // yaw → nord en haut
  _mmCtx.fillStyle    = '#ffffff';
  _mmCtx.strokeStyle  = '#000000';
  _mmCtx.lineWidth    = 1;
  _mmCtx.beginPath();
  _mmCtx.moveTo(0, -6);
  _mmCtx.lineTo(-3.5, 4);
  _mmCtx.lineTo(0, 2);
  _mmCtx.lineTo(3.5, 4);
  _mmCtx.closePath();
  _mmCtx.fill();
  _mmCtx.stroke();
  _mmCtx.restore();
}

// ---- Resize ----
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---- Clouds ----
function addClouds() {
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
  for (let i = 0; i < 20; i++) {
    const w = 6 + Math.random() * 10;
    const d = 3 + Math.random() * 6;
    const geo = new THREE.BoxGeometry(w, 0.8, d);
    const mesh = new THREE.Mesh(geo, cloudMat);
    mesh.position.set(
      Math.random() * WORLD_SIZE,
      WORLD_HEIGHT + 4 + Math.random() * 4,
      Math.random() * WORLD_SIZE
    );
    scene.add(mesh);
    // Animate clouds slowly
    mesh.userData.speed = 0.5 + Math.random() * 0.5;
  }
}

// ---- Init ----
buildTextures();
const _spawnCX = Math.floor(WORLD_SIZE / 2 / CHUNK_SIZE);
const _spawnCZ = Math.floor(WORLD_SIZE / 2 / CHUNK_SIZE);
for (let _dcx = -3; _dcx <= 3; _dcx++) {
  for (let _dcz = -3; _dcz <= 3; _dcz++) {
    getOrCreateChunk(_spawnCX + _dcx, _spawnCZ + _dcz);
    buildChunkMesh(_spawnCX + _dcx, _spawnCZ + _dcz);
  }
}
initPlayer();
initControls();
buildHUD();
updateHUD();
addClouds();
initMobs();
initInventory();
SaveSystem.init();

// Animate clouds in loop
const clouds = scene.children.filter(c => c.geometry instanceof THREE.BoxGeometry && c.material?.opacity === 0.8);
setInterval(() => {
  scene.children.forEach(c => {
    if (c.userData.speed) {
      c.position.x += c.userData.speed * 0.016;
      if (c.position.x > WORLD_SIZE + 10) c.position.x = -10;
    }
  });
}, 16);

requestAnimationFrame(animate);
