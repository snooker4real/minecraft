// ============================================================
//  Procedural Texture Generator
//  Depends on: utils/constants.js, THREE (three.min.js)
// ============================================================

const TEX_SIZE = 16;

function rng(seed) {
    let s = seed;
    return function () {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 0xffffffff;
    };
}

function makeTexture(paintFn, seed = 42) {
    const c = document.createElement('canvas');
    c.width = c.height = TEX_SIZE;
    const ctx = c.getContext('2d');
    paintFn(ctx, rng(seed));
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
}

function fillPixel(ctx, x, y, r, g, b) {
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, y, 1, 1);
}
function noise(r, range) { return (r() - 0.5) * range; }

// --- Grass top ---
function paintGrassTop(ctx, r) {
    for (let x = 0; x < TEX_SIZE; x++) for (let y = 0; y < TEX_SIZE; y++) {
        const n = noise(r, 30);
        fillPixel(ctx, x, y, 72 + n, 158 + n, 50 + n);
    }
    for (let i = 0; i < 8; i++) {
        const x = Math.floor(r() * TEX_SIZE);
        ctx.fillStyle = 'rgba(40,120,20,0.5)';
        ctx.fillRect(x, 0, 1, Math.floor(r() * 4) + 2);
    }
}

// --- Dirt ---
function paintDirt(ctx, r) {
    for (let x = 0; x < TEX_SIZE; x++) for (let y = 0; y < TEX_SIZE; y++) {
        const n = noise(r, 28);
        fillPixel(ctx, x, y, 122 + n, 82 + n, 48 + n);
    }
    for (let i = 0; i < 4; i++) {
        const px = Math.floor(r() * (TEX_SIZE - 2)) + 1;
        const py = Math.floor(r() * (TEX_SIZE - 2)) + 1;
        ctx.fillStyle = 'rgba(80,55,30,0.6)';
        ctx.fillRect(px, py, 2, 2);
    }
}

// --- Grass side ---
function paintGrassSide(ctx, r) {
    paintDirt(ctx, r);
    for (let x = 0; x < TEX_SIZE; x++) {
        const h = 2 + Math.floor(r() * 2);
        for (let y = 0; y < h; y++) {
            const n = noise(r, 20);
            fillPixel(ctx, x, y, 72 + n, 158 + n, 50 + n);
        }
    }
}

// --- Stone ---
function paintStone(ctx, r) {
    for (let x = 0; x < TEX_SIZE; x++) for (let y = 0; y < TEX_SIZE; y++) {
        const n = noise(r, 22);
        const v = 136 + n;
        fillPixel(ctx, x, y, v, v, v);
    }
    for (let i = 0; i < 3; i++) {
        let cx = Math.floor(r() * TEX_SIZE), cy = Math.floor(r() * TEX_SIZE);
        ctx.strokeStyle = 'rgba(80,80,80,0.4)';
        ctx.beginPath(); ctx.moveTo(cx, cy);
        for (let s = 0; s < 4; s++) { cx += Math.floor(r() * 3) - 1; cy += Math.floor(r() * 3) - 1; ctx.lineTo(cx, cy); }
        ctx.stroke();
    }
}

// --- Sand ---
function paintSand(ctx, r) {
    for (let x = 0; x < TEX_SIZE; x++) for (let y = 0; y < TEX_SIZE; y++) {
        const n = noise(r, 16);
        fillPixel(ctx, x, y, 232 + n, 216 + n, 122 + n);
    }
    for (let i = 0; i < 12; i++) {
        ctx.fillStyle = 'rgba(180,160,80,0.4)';
        ctx.fillRect(Math.floor(r() * TEX_SIZE), Math.floor(r() * TEX_SIZE), 1, 1);
    }
}

// --- Wood side ---
function paintWoodSide(ctx, r) {
    for (let x = 0; x < TEX_SIZE; x++) for (let y = 0; y < TEX_SIZE; y++) {
        const n = noise(r, 12);
        fillPixel(ctx, x, y, 100 + n, 70 + n, 44 + n);
    }
    for (let x = 0; x < TEX_SIZE; x += 4) {
        ctx.fillStyle = 'rgba(60,40,20,0.35)';
        ctx.fillRect(x, 0, 1, TEX_SIZE);
    }
}

// --- Wood top ---
function paintWoodTop(ctx, r) {
    for (let x = 0; x < TEX_SIZE; x++) for (let y = 0; y < TEX_SIZE; y++) {
        const dx = x - 7.5, dy = y - 7.5;
        const dist = Math.hypot(dx, dy);
        const ring = Math.floor(dist / 2) % 2;
        const n = noise(r, 10);
        const base = ring ? 130 : 100;
        fillPixel(ctx, x, y, base + n, base * 0.7 + n, base * 0.44 + n);
    }
}

// --- Leaves ---
function paintLeaves(ctx, r) {
    ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
    for (let x = 0; x < TEX_SIZE; x++) for (let y = 0; y < TEX_SIZE; y++) {
        if (r() < 0.85) {
            const n = noise(r, 20);
            fillPixel(ctx, x, y, 55 + n, 148 + n, 30 + n);
        }
    }
}

// --- Water ---
function paintWater(ctx, r) {
    for (let x = 0; x < TEX_SIZE; x++) for (let y = 0; y < TEX_SIZE; y++) {
        const n = noise(r, 20);
        fillPixel(ctx, x, y, 30 + n, 100 + n, 200 + n);
    }
    for (let y = 2; y < TEX_SIZE; y += 4) {
        ctx.fillStyle = 'rgba(80,160,255,0.3)';
        ctx.fillRect(0, y, TEX_SIZE, 1);
    }
}

// --- Snow ---
function paintSnow(ctx, r) {
    for (let x = 0; x < TEX_SIZE; x++) for (let y = 0; y < TEX_SIZE; y++) {
        const n = noise(r, 10);
        const v = 235 + n;
        fillPixel(ctx, x, y, v, v, v + 3);
    }
}

// --- Coal ---
function paintCoal(ctx, r) {
    paintStone(ctx, rng(7));
    for (let i = 0; i < 5; i++) {
        const px = Math.floor(r() * 12) + 2, py = Math.floor(r() * 12) + 2;
        const s = 1 + Math.floor(r() * 2);
        ctx.fillStyle = 'rgba(20,20,20,0.9)';
        ctx.fillRect(px, py, s, s);
        ctx.fillStyle = 'rgba(60,60,80,0.5)';
        ctx.fillRect(px - 1, py - 1, 1, 1);
    }
}

// --- Cobblestone ---
function paintCobble(ctx, r) {
    for (let x = 0; x < TEX_SIZE; x++) for (let y = 0; y < TEX_SIZE; y++) {
        const n = noise(r, 20);
        const v = 110 + n;
        fillPixel(ctx, x, y, v, v, v);
    }
    const lines = [[0, 4], [0, 12], [8, 0], [4, 8], [12, 8]];
    ctx.fillStyle = 'rgba(50,50,50,0.6)';
    lines.forEach(([x, y]) => { ctx.fillRect(x, y, TEX_SIZE, 1); ctx.fillRect(x, y, 1, TEX_SIZE); });
    ctx.fillStyle = 'rgba(160,160,160,0.3)';
    lines.forEach(([x, y]) => { ctx.fillRect(x - 1, y - 1, TEX_SIZE, 1); });
}

// --- Iron Ore ---
function paintIronOre(ctx, r) {
    paintStone(ctx, rng(9));
    for (let i = 0; i < 8; i++) {
        const px = Math.floor(r() * 11) + 2, py = Math.floor(r() * 11) + 2;
        const s = 1 + Math.floor(r() * 2);
        ctx.fillStyle = 'rgba(210, 210, 210, 0.95)';
        ctx.fillRect(px, py, s, s);
        ctx.fillStyle = 'rgba(160, 160, 160, 0.5)';
        ctx.fillRect(px + 1, py + 1, s, s);
    }
}

// --- Gold Ore ---
function paintGoldOre(ctx, r) {
    paintStone(ctx, rng(11));
    for (let i = 0; i < 7; i++) {
        const px = Math.floor(r() * 11) + 2, py = Math.floor(r() * 11) + 2;
        const s = 1 + Math.floor(r() * 2);
        ctx.fillStyle = 'rgba(255, 215, 0, 0.95)';
        ctx.fillRect(px, py, s, s);
        ctx.fillStyle = 'rgba(200, 160, 0, 0.5)';
        ctx.fillRect(px + 1, py + 1, s, s);
    }
}

// --- Diamond Ore ---
function paintDiamondOre(ctx, r) {
    paintStone(ctx, rng(13));
    for (let i = 0; i < 6; i++) {
        const px = Math.floor(r() * 11) + 2, py = Math.floor(r() * 11) + 2;
        const s = 1 + Math.floor(r() * 2);
        ctx.fillStyle = 'rgba(77, 232, 220, 0.98)';
        ctx.fillRect(px, py, s, s);
        ctx.fillStyle = 'rgba(30, 180, 170, 0.5)';
        ctx.fillRect(px + 1, py + 1, s, s);
    }
}

// ---- Texture atlas ----
const TEXTURES = {};

function buildTextures() {
    TEXTURES[BLOCK.GRASS] = {
        top:  makeTexture(paintGrassTop,  1),
        side: makeTexture(paintGrassSide, 2),
        bot:  makeTexture(paintDirt,      3),
    };
    TEXTURES[BLOCK.DIRT] = {
        top:  makeTexture(paintDirt, 4),
        side: makeTexture(paintDirt, 5),
        bot:  makeTexture(paintDirt, 6),
    };
    TEXTURES[BLOCK.STONE] = {
        top:  makeTexture(paintStone, 10),
        side: makeTexture(paintStone, 11),
        bot:  makeTexture(paintStone, 12),
    };
    TEXTURES[BLOCK.SAND] = {
        top:  makeTexture(paintSand, 20),
        side: makeTexture(paintSand, 21),
        bot:  makeTexture(paintSand, 22),
    };
    TEXTURES[BLOCK.WOOD] = {
        top:  makeTexture(paintWoodTop,  30),
        side: makeTexture(paintWoodSide, 31),
        bot:  makeTexture(paintWoodTop,  32),
    };
    TEXTURES[BLOCK.LEAVES] = {
        top:  makeTexture(paintLeaves, 40),
        side: makeTexture(paintLeaves, 41),
        bot:  makeTexture(paintLeaves, 42),
    };
    TEXTURES[BLOCK.WATER] = {
        top:  makeTexture(paintWater, 50),
        side: makeTexture(paintWater, 51),
        bot:  makeTexture(paintWater, 52),
    };
    TEXTURES[BLOCK.SNOW] = {
        top:  makeTexture(paintSnow, 60),
        side: makeTexture(paintDirt,  61),
        bot:  makeTexture(paintDirt,  62),
    };
    TEXTURES[BLOCK.COAL] = {
        top:  makeTexture(paintCoal, 70),
        side: makeTexture(paintCoal, 71),
        bot:  makeTexture(paintCoal, 72),
    };
    TEXTURES[BLOCK.COBBLE] = {
        top:  makeTexture(paintCobble, 80),
        side: makeTexture(paintCobble, 81),
        bot:  makeTexture(paintCobble, 82),
    };
    TEXTURES[11] = {
        top:  makeTexture(paintIronOre,    90),
        side: makeTexture(paintIronOre,    91),
        bot:  makeTexture(paintIronOre,    92),
    };
    TEXTURES[12] = {
        top:  makeTexture(paintGoldOre,    100),
        side: makeTexture(paintGoldOre,    101),
        bot:  makeTexture(paintGoldOre,    102),
    };
    TEXTURES[13] = {
        top:  makeTexture(paintDiamondOre, 110),
        side: makeTexture(paintDiamondOre, 111),
        bot:  makeTexture(paintDiamondOre, 112),
    };
}
