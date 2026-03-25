// ============================================================
//  Constants & Block definitions
// ============================================================

const WORLD_SIZE   = 512;
const WORLD_HEIGHT = 24;
const SEA_LEVEL    = 6;
const BLOCK_SIZE   = 1;
const GRAVITY      = -20;
const JUMP_FORCE   = 8;
const PLAYER_SPEED = 5;
const PLAYER_HEIGHT = 1.7;
const REACH        = 5;

const BLOCK = {
    AIR:    0,
    GRASS:  1,
    DIRT:   2,
    STONE:  3,
    SAND:   4,
    WOOD:   5,
    LEAVES: 6,
    WATER:  7,
    SNOW:   8,
    COAL:        9,
    COBBLE:      10,
    IRON_ORE:    11,
    GOLD_ORE:    12,
    DIAMOND_ORE: 13,
};

const BLOCK_DEFS = {
    [BLOCK.GRASS]:  { name: 'Herbe',    transparent: false },
    [BLOCK.DIRT]:   { name: 'Terre',    transparent: false },
    [BLOCK.STONE]:  { name: 'Pierre',   transparent: false },
    [BLOCK.SAND]:   { name: 'Sable',    transparent: false },
    [BLOCK.WOOD]:   { name: 'Bois',     transparent: false },
    [BLOCK.LEAVES]: { name: 'Feuilles', transparent: true  },
    [BLOCK.WATER]:  { name: 'Eau',      transparent: true  },
    [BLOCK.SNOW]:   { name: 'Neige',    transparent: false },
    [BLOCK.COAL]:        { name: 'Charbon',          transparent: false },
    [BLOCK.COBBLE]:      { name: 'Cobble',           transparent: false },
    [11]: { name: 'Minerai de Fer',     transparent: false },
    [12]: { name: "Minerai d'Or",       transparent: false },
    [13]: { name: 'Minerai de Diamant', transparent: false },
};

// Item-only IDs (not placeable blocks, only in inventory)
const ITEM = {
    COAL:    20,
    IRON:    21,
    GOLD:    22,
    DIAMOND: 23,
};

const ITEM_DEFS = {
    [20]: { name: 'Charbon',       color: '#2a2a2a' },
    [21]: { name: 'Lingot de Fer', color: '#d4d4d4' },
    [22]: { name: "Lingot d'Or",   color: '#ffd700' },
    [23]: { name: 'Diamant',       color: '#4de8e0' },
};

// What each block drops when mined
const BLOCK_DROPS = {
    [1]:  { id: 2,  count: 1 },   // GRASS → DIRT
    [2]:  { id: 2,  count: 1 },   // DIRT → DIRT
    [3]:  { id: 10, count: 1 },   // STONE → COBBLE
    [4]:  { id: 4,  count: 1 },   // SAND → SAND
    [5]:  { id: 5,  count: 1 },   // WOOD → WOOD
    [6]:  null,                    // LEAVES → nothing
    [8]:  { id: 8,  count: 1 },   // SNOW → SNOW
    [9]:  { id: 20, count: 1 },   // COAL block → coal item
    [10]: { id: 10, count: 1 },   // COBBLE → COBBLE
    [11]: { id: 21, count: 1 },   // IRON_ORE → iron ingot
    [12]: { id: 22, count: 1 },   // GOLD_ORE → gold ingot
    [13]: { id: 23, count: 1 },   // DIAMOND_ORE → diamond
};

// ---- Outils ----
const TOOL = {
    PICKAXE_WOOD:      100,
    PICKAXE_STONE:     101,
    PICKAXE_IRON:      102,
    PICKAXE_GOLD:      103,
    PICKAXE_DIAMOND:   104,
    PICKAXE_NETHERITE: 105,
    // Épées (200+)
    SWORD_WOOD:        200,
    SWORD_STONE:       201,
    SWORD_IRON:        202,
    SWORD_GOLD:        203,
    SWORD_DIAMOND:     204,
    SWORD_NETHERITE:   205,
};

// name / couleur principale / ombre / multiplicateur de vitesse / durabilité max / dmg
const TOOL_DEFS = {
    [TOOL.PICKAXE_WOOD]:      { name: 'Pioche Bois',      color: '#c49a6c', dark: '#8b6343', speedMult:  2, durability:   59 },
    [TOOL.PICKAXE_STONE]:     { name: 'Pioche Pierre',    color: '#b0b0b0', dark: '#707070', speedMult:  4, durability:  131 },
    [TOOL.PICKAXE_IRON]:      { name: 'Pioche Fer',       color: '#e8e8e8', dark: '#aaaaaa', speedMult:  6, durability:  250 },
    [TOOL.PICKAXE_GOLD]:      { name: 'Pioche Or',        color: '#ffd700', dark: '#b89600', speedMult: 12, durability:   32 },
    [TOOL.PICKAXE_DIAMOND]:   { name: 'Pioche Diamant',   color: '#4dd9e8', dark: '#2a97a8', speedMult:  8, durability: 1561 },
    [TOOL.PICKAXE_NETHERITE]: { name: 'Pioche Nétherite', color: '#8b6a8b', dark: '#4d3a4d', speedMult:  9, durability: 2031 },
    // Épées
    [TOOL.SWORD_WOOD]:        { name: 'Épée Bois',        color: '#c49a6c', dark: '#8b6343', dmg:  4, durability:   59 },
    [TOOL.SWORD_STONE]:       { name: 'Épée Pierre',      color: '#b0b0b0', dark: '#707070', dmg:  5, durability:  131 },
    [TOOL.SWORD_IRON]:        { name: 'Épée Fer',         color: '#e8e8e8', dark: '#aaaaaa', dmg:  6, durability:  250 },
    [TOOL.SWORD_GOLD]:        { name: 'Épée Or',          color: '#ffd700', dark: '#b89600', dmg:  4, durability:   32 },
    [TOOL.SWORD_DIAMOND]:     { name: 'Épée Diamant',     color: '#4dd9e8', dark: '#2a97a8', dmg:  7, durability: 1561 },
    [TOOL.SWORD_NETHERITE]:   { name: 'Épée Nétherite',   color: '#8b6a8b', dark: '#4d3a4d', dmg:  8, durability: 2031 },
};

// Temps de cassage de base en secondes (mains nues)
const BLOCK_HARDNESS = {
    [BLOCK.GRASS]:  0.9,
    [BLOCK.DIRT]:   0.75,
    [BLOCK.SAND]:   0.75,
    [BLOCK.SNOW]:   0.5,
    [BLOCK.WOOD]:   3,
    [BLOCK.LEAVES]: 0.3,
    [BLOCK.STONE]:  7.5,
    [BLOCK.COBBLE]: 7.5,
    [BLOCK.COAL]:   15,
    [11]: 15,   // IRON_ORE
    [12]: 15,   // GOLD_ORE
    [13]: 20,   // DIAMOND_ORE
};

// Blocs sur lesquels la pioche est efficace (bonus de vitesse complet)
const PICKAXE_EFFICIENT = new Set([BLOCK.STONE, BLOCK.COBBLE, BLOCK.COAL, 11, 12, 13]);

function isTool(id)    { return id >= 100; }
function isSword(id)   { return id >= 200; }
function isPickaxe(id) { return id >= 100 && id < 200; }

const HOTBAR = [
    // ── Blocs (touches 1–9) ─────────────────────────────────
    BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.SAND,
    BLOCK.WOOD, BLOCK.LEAVES, BLOCK.SNOW, BLOCK.COAL, BLOCK.COBBLE,
    // ── Pioches ──────────────────────────────────────────────
    TOOL.PICKAXE_WOOD, TOOL.PICKAXE_STONE, TOOL.PICKAXE_IRON,
    TOOL.PICKAXE_GOLD, TOOL.PICKAXE_DIAMOND, TOOL.PICKAXE_NETHERITE,
    // ── Épées ────────────────────────────────────────────────
    TOOL.SWORD_WOOD, TOOL.SWORD_STONE, TOOL.SWORD_IRON,
    TOOL.SWORD_GOLD, TOOL.SWORD_DIAMOND, TOOL.SWORD_NETHERITE,
];
