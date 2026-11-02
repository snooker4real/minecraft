// ============================================================
//  SaveSystem — SQLite game saves via sql.js (WASM)
//  Depends on: constants.js, world.js, player.js, mobs.js,
//              controls.js, inventory.js
//  game.js must call: SaveSystem.init()
// ============================================================

const SAVE_STORAGE_KEY = 'mcjs_db';

const SaveSystem = (() => {
  let SQL = null;
  let db  = null;

  // ── Init ────────────────────────────────────────────────────
  async function init() {
    SQL = await initSqlJs({
      locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${f}`,
    });
    _loadOrCreate();
    _bindUI();
  }

  function _loadOrCreate() {
    const stored = localStorage.getItem(SAVE_STORAGE_KEY);
    if (stored) {
      const buf = _b64ToU8(stored);
      db = new SQL.Database(buf);
    } else {
      db = new SQL.Database();
    }
    _migrate();
  }

  function _migrate() {
    db.run(`
      CREATE TABLE IF NOT EXISTS saves (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        name         TEXT    NOT NULL,
        saved_at     INTEGER NOT NULL,
        player_x     REAL, player_y REAL, player_z REAL,
        player_yaw   REAL, player_pitch REAL,
        health       INTEGER, max_health INTEGER,
        hotbar_index INTEGER, difficulty  INTEGER
      );
      CREATE TABLE IF NOT EXISTS inventory_slots (
        save_id INTEGER, slot INTEGER, item_id INTEGER, count INTEGER
      );
      CREATE TABLE IF NOT EXISTS tool_durability (
        save_id INTEGER, tool_id INTEGER, dur INTEGER
      );
      CREATE TABLE IF NOT EXISTS chunk_data (
        save_id INTEGER, cx INTEGER, cz INTEGER, data TEXT
      );
    `);
  }

  // ── Helpers ─────────────────────────────────────────────────
  function _persist() {
    const data = db.export();
    localStorage.setItem(SAVE_STORAGE_KEY, _u8ToB64(data));
  }

  function _u8ToB64(arr) {
    let bin = '';
    const CHUNK = 8192;
    for (let i = 0; i < arr.length; i += CHUNK)
      bin += String.fromCharCode.apply(null, arr.subarray(i, i + CHUNK));
    return btoa(bin);
  }

  function _b64ToU8(b64) {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }

  // ── Save ────────────────────────────────────────────────────
  function save(name) {
    if (!db) { console.warn('[Save] DB not ready'); return null; }

    db.run(
      `INSERT INTO saves
         (name, saved_at, player_x, player_y, player_z,
          player_yaw, player_pitch, health, max_health, hotbar_index, difficulty)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        name, Date.now(),
        camera.position.x, camera.position.y, camera.position.z,
        player.yaw, player.pitch,
        playerHealth.hp, playerHealth.maxHp,
        hotbarIndex, difficulty,
      ]
    );
    const saveId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];

    for (let i = 0; i < inventory.length; i++) {
      const slot = inventory[i];
      if (slot) db.run(
        `INSERT INTO inventory_slots VALUES (?,?,?,?)`,
        [saveId, i, slot.id, slot.count]
      );
    }

    for (const [toolId, dur] of Object.entries(toolDurability)) {
      db.run(`INSERT INTO tool_durability VALUES (?,?,?)`, [saveId, Number(toolId), dur]);
    }

    const chunksObj = serializeChunks();
    for (const [key, b64] of Object.entries(chunksObj)) {
      const [cx, cz] = key.split(',').map(Number);
      db.run(`INSERT INTO chunk_data VALUES (?,?,?,?)`, [saveId, cx, cz, b64]);
    }

    _persist();
    return saveId;
  }

  // ── List ────────────────────────────────────────────────────
  function list() {
    if (!db) return [];
    const res = db.exec(
      'SELECT id, name, saved_at, player_x, player_y, player_z FROM saves ORDER BY saved_at DESC'
    );
    if (!res.length) return [];
    return res[0].values.map(r => ({
      id: r[0], name: r[1], savedAt: r[2],
      x: r[3], y: r[4], z: r[5],
    }));
  }

  // ── Load ────────────────────────────────────────────────────
  function load(saveId) {
    if (!db) return false;

    const res = db.exec(`SELECT * FROM saves WHERE id = ${saveId}`);
    if (!res.length || !res[0].values.length) return false;

    const cols = res[0].columns;
    const row  = res[0].values[0];
    const rec  = {};
    cols.forEach((c, i) => { rec[c] = row[i]; });

    // Player
    camera.position.set(rec.player_x, rec.player_y, rec.player_z);
    player.yaw   = rec.player_yaw;
    player.pitch = rec.player_pitch;
    player.vel.set(0, 0, 0);

    // Health
    playerHealth.hp    = rec.health;
    playerHealth.maxHp = rec.max_health;
    playerHealth.dead  = false;
    updateHealthHUD();

    // Difficulty & hotbar
    setDifficulty(rec.difficulty);
    hotbarIndex = rec.hotbar_index;

    // Inventory
    for (let i = 0; i < inventory.length; i++) inventory[i] = null;
    const invRes = db.exec(
      `SELECT slot, item_id, count FROM inventory_slots WHERE save_id = ${saveId}`
    );
    if (invRes.length) {
      for (const [slot, id, count] of invRes[0].values) inventory[slot] = { id, count };
    }
    if (typeof renderInventory === 'function') renderInventory();

    // Tool durability
    const tdRes = db.exec(
      `SELECT tool_id, dur FROM tool_durability WHERE save_id = ${saveId}`
    );
    if (tdRes.length) {
      for (const [toolId, dur] of tdRes[0].values) toolDurability[toolId] = dur;
    }

    // Chunks
    const chRes = db.exec(
      `SELECT cx, cz, data FROM chunk_data WHERE save_id = ${saveId}`
    );
    const chunksObj = {};
    if (chRes.length) {
      for (const [cx, cz, data] of chRes[0].values) chunksObj[`${cx},${cz}`] = data;
    }
    deserializeChunks(chunksObj);
    for (const key of Object.keys(chunksObj)) {
      const [cx, cz] = key.split(',').map(Number);
      buildChunkMesh(cx, cz);
    }

    buildHUD();
    updateHUD();
    return true;
  }

  // ── Delete ──────────────────────────────────────────────────
  function deleteSave(saveId) {
    if (!db) return;
    db.run(`DELETE FROM saves           WHERE id      = ${saveId}`);
    db.run(`DELETE FROM inventory_slots WHERE save_id = ${saveId}`);
    db.run(`DELETE FROM tool_durability WHERE save_id = ${saveId}`);
    db.run(`DELETE FROM chunk_data      WHERE save_id = ${saveId}`);
    _persist();
  }

  // ── UI ──────────────────────────────────────────────────────
  function _bindUI() {
    document.getElementById('btnSave').addEventListener('click', _openSaveModal);
    document.getElementById('btnLoad').addEventListener('click', _openLoadModal);
    document.getElementById('save-modal-cancel').addEventListener('click', _closeModals);

    const _doSave = () => {
      const name = document.getElementById('save-name-input').value.trim() || 'Sauvegarde';
      save(name);
      _closeModals();
      _showToast('Partie sauvegardée : ' + name);
    };
    document.getElementById('save-modal-confirm').addEventListener('click', _doSave);
    document.getElementById('save-name-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') _doSave();
      if (e.key === 'Escape') _closeModals();
    });
    document.getElementById('load-modal-close').addEventListener('click', _closeModals);
  }

  function _openSaveModal() {
    document.getElementById('save-name-input').value = '';
    document.getElementById('save-modal').style.display = 'flex';
    if (typeof gpMenuResetFocus === 'function') gpMenuResetFocus();
  }

  function _openLoadModal() {
    const container = document.getElementById('load-list');
    container.innerHTML = '';
    const saves = list();
    if (!saves.length) {
      container.innerHTML = '<p style="opacity:.6;text-align:center">Aucune sauvegarde</p>';
    } else {
      saves.forEach(s => {
        const row = document.createElement('div');
        row.className = 'save-row';

        const info = document.createElement('div');
        info.className = 'save-info';
        const d = new Date(s.savedAt);
        const nameEl = document.createElement('span');
        nameEl.className = 'save-name';
        nameEl.textContent = s.name;
        info.appendChild(nameEl);
        info.insertAdjacentHTML('beforeend',
          `<span class="save-date">${d.toLocaleDateString()} ${d.toLocaleTimeString()}</span>` +
          `<span class="save-pos">X:${Math.round(s.x)} Y:${Math.round(s.y)} Z:${Math.round(s.z)}</span>`);

        const btnLoad = document.createElement('button');
        btnLoad.className = 'mc-btn';
        btnLoad.innerHTML = '<span class="mc-btn-inner">Charger</span>';
        btnLoad.addEventListener('click', () => {
          if (load(s.id)) {
            _closeModals();
            _showToast('Partie chargée : ' + s.name);
          }
        });

        const btnDel = document.createElement('button');
        btnDel.className = 'mc-btn danger';
        btnDel.innerHTML = '<span class="mc-btn-inner">✕</span>';
        btnDel.addEventListener('click', () => {
          deleteSave(s.id);
          row.remove();
          if (!container.children.length)
            container.innerHTML = '<p style="opacity:.6;text-align:center">Aucune sauvegarde</p>';
        });

        row.appendChild(info);
        row.appendChild(btnLoad);
        row.appendChild(btnDel);
        container.appendChild(row);
      });
    }
    document.getElementById('load-modal').style.display = 'flex';
    if (typeof gpMenuResetFocus === 'function') gpMenuResetFocus();
  }

  function _closeModals() {
    document.getElementById('save-modal').style.display = 'none';
    document.getElementById('load-modal').style.display = 'none';
  }

  function _showToast(msg) {
    const el = document.getElementById('save-toast');
    el.textContent = msg;
    el.classList.add('visible');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('visible'), 2500);
  }

  return { init, save, load, list, deleteSave };
})();
