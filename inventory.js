// ============================================================
//  Inventory — item collection, drop entities, inventory UI
//  Depends on: utils/constants.js, THREE
//  game.js must call: initInventory(), updateDrops(dt)
//  controls.js calls: spawnDrop(x, y, z, itemId, count)
// ============================================================

// ================================================================
//  INVENTORY STATE — 27 slots
// ================================================================
const inventory = new Array(27).fill(null); // each slot: {id, count} or null

function addToInventory(id, count) {
    // Stack with existing slot first
    for (let i = 0; i < inventory.length; i++) {
        if (inventory[i] && inventory[i].id === id && inventory[i].count < 64) {
            const room = 64 - inventory[i].count;
            const toAdd = Math.min(count, room);
            inventory[i].count += toAdd;
            count -= toAdd;
            if (count <= 0) { renderInventory(); showPickupNotif(id, toAdd); return; }
        }
    }
    // Find empty slot
    for (let i = 0; i < inventory.length; i++) {
        if (!inventory[i]) {
            const toAdd = Math.min(count, 64);
            inventory[i] = { id, count: toAdd };
            count -= toAdd;
            renderInventory();
            showPickupNotif(id, toAdd);
            if (count <= 0) return;
        }
    }
    // Inventory full - just notify
    showPickupNotif(id, 0);
}

// ================================================================
//  ITEM HELPERS
// ================================================================
function getItemName(id) {
    if (ITEM_DEFS && ITEM_DEFS[id]) return ITEM_DEFS[id].name;
    if (BLOCK_DEFS && BLOCK_DEFS[id]) return BLOCK_DEFS[id].name;
    if (TOOL_DEFS  && TOOL_DEFS[id])  return TOOL_DEFS[id].name;
    return '?';
}

function getItemHexColor(id) {
    if (ITEM_DEFS && ITEM_DEFS[id]) return ITEM_DEFS[id].color;
    const blockColors = {
        1: '#5a9e30',   // grass
        2: '#8a5c3a',   // dirt
        3: '#888888',   // stone
        4: '#d4b464',   // sand
        5: '#7a5028',   // wood
        6: '#3a8a20',   // leaves
        8: '#dde8ff',   // snow
        9: '#333333',   // coal block
        10: '#777777',  // cobble
    };
    return blockColors[id] || '#aaaaaa';
}

function getItemThreeColor(id) {
    return Number.parseInt(getItemHexColor(id).replace('#', ''), 16);
}

// ================================================================
//  DROP ENTITIES — floating items in the world
// ================================================================
const drops = [];

function spawnDrop(wx, wy, wz, itemId, count) {
    if (!itemId) return;
    const color = getItemThreeColor(itemId);
    const geo   = new THREE.BoxGeometry(0.28, 0.28, 0.28);
    const mat   = new THREE.MeshLambertMaterial({ color });
    const mesh  = new THREE.Mesh(geo, mat);
    const bx = wx + 0.5 + (Math.random() - 0.5) * 0.4;
    const bz = wz + 0.5 + (Math.random() - 0.5) * 0.4;
    mesh.position.set(bx, wy + 0.8, bz);
    scene.add(mesh);
    drops.push({
        mesh,
        id: itemId,
        count: count || 1,
        baseX: bx,
        baseZ: bz,
        baseY: wy + 0.8,
        bobPhase: Math.random() * Math.PI * 2,
        alive: true,
    });
}

function updateDrops(dt) {
    const playerPos = camera.position;
    for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        if (!d.alive) {
            scene.remove(d.mesh);
            if (d.mesh.geometry) d.mesh.geometry.dispose();
            if (d.mesh.material) d.mesh.material.dispose();
            drops.splice(i, 1);
            continue;
        }
        // Bob + rotate
        d.bobPhase += dt * 2.2;
        d.mesh.position.y  = d.baseY + Math.sin(d.bobPhase) * 0.13;
        d.mesh.rotation.y += dt * 1.8;

        // Distance to player feet
        const dx   = playerPos.x - d.mesh.position.x;
        const dy   = playerPos.y - PLAYER_HEIGHT * 0.5 - d.mesh.position.y;
        const dz   = playerPos.z - d.mesh.position.z;
        const dist = Math.hypot(dx, dy, dz);

        // Magnetic pull when close
        if (dist < 3.5 && dist > 0.01) {
            const speed = dt * (dist < 1.5 ? 10 : 5);
            d.baseX += (dx / dist) * speed;
            d.baseZ += (dz / dist) * speed;
            d.mesh.position.x = d.baseX;
            d.mesh.position.z = d.baseZ;
        }

        // Pickup
        if (dist < 0.9) {
            addToInventory(d.id, d.count);
            d.alive = false;
        }
    }
}

// ================================================================
//  PICKUP NOTIFICATION
// ================================================================
function showPickupNotif(id, count) {
    if (count <= 0) return;
    const notif = document.getElementById('pickup-notif');
    if (!notif) return;
    notif.textContent = `+ ${count}  ${getItemName(id)}`;
    notif.style.opacity = '1';
    notif.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(notif._timer);
    notif._timer = setTimeout(() => {
        notif.style.opacity = '0';
        notif.style.transform = 'translateX(-50%) translateY(-10px)';
    }, 1800);
}

// ================================================================
//  INVENTORY UI
// ================================================================
let inventoryOpen = false;

function openInventory() {
    inventoryOpen = true;
    if (document.pointerLockElement) document.exitPointerLock();
    renderInventory();
    document.getElementById('inventory-screen').style.display = 'flex';
}

function closeInventory() {
    inventoryOpen = false;
    document.getElementById('inventory-screen').style.display = 'none';
    if (typeof gameStarted !== 'undefined' && gameStarted) {
        renderer.domElement.requestPointerLock();
    }
}

function toggleInventory() {
    if (inventoryOpen) closeInventory();
    else openInventory();
}

function drawInvItemIcon(canvas, id) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    ctx.clearRect(0, 0, W, W);

    // If it's a block with textures, use drawBlockIcon
    if (id < 20 && typeof drawBlockIcon === 'function' && TEXTURES[id]) {
        drawBlockIcon(canvas, id);
        return;
    }

    // Otherwise draw colored icon
    const hex = getItemHexColor(id);
    ctx.fillStyle = hex;
    ctx.fillRect(4, 4, W - 8, W - 8);

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(4, 4, W - 8, 3);
    ctx.fillRect(4, 4, 3, W - 8);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(4, W - 7, W - 8, 3);
    ctx.fillRect(W - 7, 4, 3, W - 8);

    // Inner detail for special items
    if (id === 20) { // coal
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(8, 8, 6, 6);
        ctx.fillRect(W-14, W-14, 6, 6);
    } else if (id === 21) { // iron
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(8, W/2-2, W-16, 4);
    } else if (id === 22) { // gold
        ctx.fillStyle = 'rgba(255,255,200,0.6)';
        ctx.fillRect(W/2-3, 6, 6, W-12);
    } else if (id === 23) { // diamond
        ctx.fillStyle = 'rgba(180,255,255,0.7)';
        ctx.beginPath();
        ctx.moveTo(W/2, 5); ctx.lineTo(W-5, W/2);
        ctx.lineTo(W/2, W-5); ctx.lineTo(5, W/2);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.moveTo(W/2, 5); ctx.lineTo(W-5, W/2); ctx.lineTo(W/2, W/2);
        ctx.closePath(); ctx.fill();
    }
}

function renderInventory() {
    const grid = document.getElementById('inventory-grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 0; i < 27; i++) {
        const slot = document.createElement('div');
        slot.className = 'inv-slot';
        const item = inventory[i];
        if (item) {
            const cvs = document.createElement('canvas');
            cvs.width = cvs.height = 32;
            cvs.className = 'inv-icon-canvas';
            drawInvItemIcon(cvs, item.id);
            slot.appendChild(cvs);
            if (item.count > 1) {
                const cnt = document.createElement('span');
                cnt.className = 'inv-count';
                cnt.textContent = item.count;
                slot.appendChild(cnt);
            }
            slot.title = `${getItemName(item.id)} (${item.count})`;
        }
        grid.appendChild(slot);
    }
    // Update inventory count badge
    const badge = document.getElementById('inv-badge');
    if (badge) {
        const total = inventory.filter(s => s !== null).length;
        badge.textContent = total > 0 ? total : '';
    }
}

// ================================================================
//  INIT
// ================================================================
function initInventory() {
    // E key to toggle
    document.addEventListener('keydown', e => {
        if (e.code === 'KeyE' && typeof gameStarted !== 'undefined' && gameStarted && !inventoryOpen) {
            e.preventDefault();
            openInventory();
        } else if ((e.code === 'KeyE' || e.code === 'Escape') && inventoryOpen) {
            e.preventDefault();
            closeInventory();
        }
    });

    // Close button
    const closeBtn = document.getElementById('inv-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeInventory);
}
