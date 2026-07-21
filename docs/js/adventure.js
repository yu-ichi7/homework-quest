import { getGameView, advance, buy, equip, defeatMonster } from './store.js';
import {
  tileInfo, spriteToCells, idleOffset, heroCells, pathWaveY,
} from './lib/game.js';

const THEME = {
  grass: { sky: '#bee7ff', ground: '#3aa655', ground2: '#34974c', path: '#2f7d43' },
  forest: { sky: '#d9f2df', ground: '#2f7d43', ground2: '#276b39', path: '#255e33' },
  sky: { sky: '#eaf4ff', ground: '#cbb994', ground2: '#b8a37f', path: '#a88f6c' },
};

const VISIBLE_TILES = 8;
const CELL = 4;

let currentView = null;
let rafId = null;
let battle = null; // { monster, monsterId, heroHp, heroMaxHp, monsterHp, monsterMaxHp, over }

function init() {
  document.getElementById('advance-btn').onclick = handleAdvance;
  document.getElementById('modal-ok').onclick = () => { document.getElementById('modal').hidden = true; };
  document.getElementById('battle-attack-btn').onclick = handleBattleAttack;
  document.getElementById('battle-close-btn').onclick = closeBattle;
  document.addEventListener('game-tab-changed', (e) => {
    if (e.detail.tab === 'adventure') startIdleLoop(); else stopIdleLoop();
  });
  render();
}

// ヒーローだけ idleOffset ぶん揺らして再描画し続ける。タブ非表示中は止める。
function loop(t) {
  if (currentView) drawMap(currentView, t);
  rafId = requestAnimationFrame(loop);
}
function startIdleLoop() {
  if (rafId) return;
  rafId = requestAnimationFrame(loop);
}
function stopIdleLoop() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}

function render() {
  const view = getGameView();
  currentView = view;
  document.getElementById('coin-balance').textContent = view.balance;
  document.getElementById('area-name').textContent = view.isComplete ? '🏆 ぼうけんクリア！' : view.area.name;

  const ratio = view.area.length > 1 ? view.localTile / (view.area.length - 1) : 1;
  document.getElementById('area-fill').style.width = `${Math.round(Math.min(1, ratio) * 100)}%`;
  document.getElementById('area-sub').textContent = view.isComplete
    ? 'すべてのエリアをせいはしました！'
    : `${view.localTile + 1} / ${view.area.length} マス目`;

  document.getElementById('move-cost').textContent = view.moveCost;
  document.getElementById('advance-btn').disabled = view.isComplete;

  drawMap(view, performance.now());
  renderEquip(view);
  renderShop(view);
}

// ---- 移動 ----

function handleAdvance() {
  const msg = document.getElementById('move-msg');
  const res = advance();
  if (!res.moved) {
    msg.textContent = res.reason === 'complete'
      ? 'もうさいごまで到着しています！'
      : `🪙が足りません（${res.cost}コインひつよう）`;
    return;
  }
  msg.textContent = '';
  render();

  if (res.monsterEncounter) {
    startBattle(res.monsterEncounter);
  } else if (res.chestReward) {
    if (res.chestReward.kind === 'coins') {
      showModal('🪙', 'たからばこ！', `+${res.chestReward.coins} コイン`);
    } else {
      showModal('🎁', 'たからばこ！', `「${res.chestReward.item.name}」を手に入れた！`);
    }
  } else if (res.areaCleared) {
    showModal('🚩', 'エリアクリア！', `「${res.areaCleared.name}」に到着！`);
  } else if (res.completed) {
    showModal('🏆', 'ぼうけんクリア！', 'すべてのエリアをせいはした！');
  } else if (res.event) {
    showModal('💬', 'できごと', res.event);
  }
}

// ---- バトル ----

function startBattle(monster) {
  const stats = currentView.heroStats;
  battle = {
    monster,
    monsterId: monster.id,
    heroHp: stats.hp,
    heroMaxHp: stats.hp,
    heroAtk: stats.atk,
    heroDef: stats.def,
    monsterHp: monster.hp,
    monsterMaxHp: monster.hp,
    over: false,
  };
  document.getElementById('battle-monster-name').textContent = monster.name;
  document.getElementById('battle-msg').textContent = `${monster.name} があらわれた！`;
  document.getElementById('battle-attack-btn').hidden = false;
  document.getElementById('battle-close-btn').hidden = true;
  renderBattle();
  drawBattleMonster();
  document.getElementById('battle-modal').hidden = false;
}

function renderBattle() {
  document.getElementById('battle-hero-hp-fill').style.width = `${Math.round((battle.heroHp / battle.heroMaxHp) * 100)}%`;
  document.getElementById('battle-hero-hp-text').textContent = `${Math.max(0, battle.heroHp)}/${battle.heroMaxHp}`;
  document.getElementById('battle-monster-hp-fill').style.width = `${Math.round((Math.max(0, battle.monsterHp) / battle.monsterMaxHp) * 100)}%`;
  document.getElementById('battle-monster-hp-text').textContent = `${Math.max(0, battle.monsterHp)}/${battle.monsterMaxHp}`;
}

function handleBattleAttack() {
  if (!battle || battle.over) return;
  const msg = document.getElementById('battle-msg');

  battle.monsterHp -= battle.heroAtk;
  if (battle.monsterHp <= 0) {
    battle.over = true;
    renderBattle();
    const res = defeatMonster(battle.monsterId, battle.monster.reward);
    render();
    msg.textContent = `${battle.monster.name} をたおした！ +${battle.monster.reward?.coins || 0} コイン`;
    document.getElementById('battle-attack-btn').hidden = true;
    document.getElementById('battle-close-btn').hidden = false;
    void res;
    return;
  }

  const dmg = Math.max(1, battle.monster.atk - battle.heroDef);
  battle.heroHp -= dmg;
  renderBattle();

  if (battle.heroHp <= 0) {
    battle.over = true;
    msg.textContent = 'たいりょくがなくなった…でなおそう！';
    document.getElementById('battle-attack-btn').hidden = true;
    document.getElementById('battle-close-btn').hidden = false;
    return;
  }

  msg.textContent = `こうげき！ ${battle.heroAtk}ダメージ。${battle.monster.name}のこうげきで${dmg}ダメージをうけた。`;
}

function closeBattle() {
  document.getElementById('battle-modal').hidden = true;
  battle = null;
}

function drawBattleMonster() {
  const canvas = document.getElementById('battle-monster-canvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const { cells, w, h } = spriteToCells('monster');
  const cellSize = 10;
  const left = (canvas.width - w * cellSize) / 2;
  const top = (canvas.height - h * cellSize) / 2;
  for (const c of cells) {
    ctx.fillStyle = c.color;
    ctx.fillRect(left + c.x * cellSize, top + c.y * cellSize, cellSize, cellSize);
  }
}

// ---- レトロマップ描画（ウネウネ道） ----

function drawCells(ctx, cellsObj, centerX, groundY, cellSize = CELL) {
  const { cells, w, h } = cellsObj;
  const left = centerX - (w * cellSize) / 2;
  const top = groundY - h * cellSize;
  for (const c of cells) {
    ctx.fillStyle = c.color;
    ctx.fillRect(left + c.x * cellSize, top + c.y * cellSize, cellSize, cellSize);
  }
}

function drawSprite(ctx, name, centerX, groundY, cellSize = CELL) {
  drawCells(ctx, spriteToCells(name), centerX, groundY, cellSize);
}

function tileCenter(i, tileWidth, baseY) {
  return { x: i * tileWidth + tileWidth / 2, y: baseY + pathWaveY(i) };
}

function drawMap(view, tNow = 0) {
  const canvas = document.getElementById('map-canvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const W = canvas.width;
  const H = canvas.height;
  const theme = THEME[view.area.theme] || THEME.grass;
  const heroBob = idleOffset(tNow, 1, 900);

  ctx.fillStyle = theme.sky;
  ctx.fillRect(0, 0, W, H);

  const baseY = H - 40;
  const tileWidth = W / VISIBLE_TILES;
  const length = view.area.length;
  const maxCamera = Math.max(0, length - VISIBLE_TILES);
  const camera = Math.min(maxCamera, Math.max(0, view.localTile - 3));

  // 道（タイル中心をウネウネつなぐ）。
  ctx.strokeStyle = theme.path;
  ctx.lineWidth = Math.max(6, tileWidth * 0.35);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < VISIBLE_TILES; i += 1) {
    const tile = camera + i;
    if (tile >= length) break;
    const { x, y } = tileCenter(tile, tileWidth, baseY);
    if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
  }
  ctx.stroke();

  // タイル（踏み石）。
  for (let i = 0; i < VISIBLE_TILES; i += 1) {
    const tile = camera + i;
    if (tile >= length) break;
    const { x, y } = tileCenter(tile, tileWidth, baseY);
    const size = tileWidth * 0.55;
    ctx.fillStyle = tile % 2 === 0 ? theme.ground : theme.ground2;
    ctx.beginPath();
    ctx.roundRect(x - size / 2, y - size / 2, size, size, 6);
    ctx.fill();
  }

  const openedChests = view.game.openedChests || [];
  const defeatedMonsters = view.game.defeatedMonsters || [];
  for (let i = 0; i < VISIBLE_TILES; i += 1) {
    const tile = camera + i;
    if (tile >= length) break;
    const info = tileInfo(view.area, tile, openedChests, defeatedMonsters);
    const { x, y } = tileCenter(tile, tileWidth, baseY);
    if (info.chest) {
      drawSprite(ctx, info.chestOpened ? 'chestOpen' : 'chest', x, y);
    }
    if (info.monster && !info.monsterDefeated) {
      drawSprite(ctx, 'monster', x, y);
    }
  }

  if (length - 1 >= camera && length - 1 < camera + VISIBLE_TILES) {
    const { x, y } = tileCenter(length - 1, tileWidth, baseY);
    drawSprite(ctx, 'flag', x, y);
  }

  if (view.localTile >= camera && view.localTile < camera + VISIBLE_TILES) {
    const { x, y } = tileCenter(view.localTile, tileWidth, baseY);
    const heroY = y - heroBob;
    const hc = heroCells(view.equipped, view.shop);
    drawCells(ctx, hc, x, heroY, CELL);

    // ぶきは手もとに小さく添えて描く。
    const weaponId = view.equipped?.weapon;
    const weapon = weaponId ? view.shop.find((s) => s.id === weaponId) : null;
    if (weapon) {
      drawSprite(ctx, weapon.sprite, x + hc.w * CELL * 0.55, heroY - hc.h * CELL * 0.35, CELL * 0.8);
    }
  }
}

function spriteCanvas(name, cellSize = CELL) {
  const { cells, w, h } = spriteToCells(name);
  const canvas = document.createElement('canvas');
  canvas.width = w * cellSize;
  canvas.height = h * cellSize;
  canvas.className = 'sprite-icon';
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  for (const c of cells) {
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x * cellSize, c.y * cellSize, cellSize, cellSize);
  }
  return canvas;
}

// ---- 装備 ----

function renderEquip(view) {
  const el = document.getElementById('equip-row');
  el.innerHTML = '';
  const slots = [['weapon', 'ぶき'], ['armor', 'よろい'], ['boots', 'くつ']];
  for (const [slot, label] of slots) {
    const id = view.equipped[slot];
    const item = id ? view.shop.find((s) => s.id === id) : null;
    const box = document.createElement('div');
    box.className = 'equip-slot';
    if (item) box.appendChild(spriteCanvas(item.sprite));
    const name = document.createElement('div');
    name.className = 'label';
    name.textContent = item ? item.name : `${label}：なし`;
    box.appendChild(name);
    el.appendChild(box);
  }
}

// ---- おみせ ----

function renderShop(view) {
  const el = document.getElementById('shop-list');
  el.innerHTML = '';
  for (const item of view.shop) {
    const owned = view.inventory.includes(item.id);
    const isEquipped = view.equipped[item.slot] === item.id;

    const row = document.createElement('div');
    row.className = 'task-row';
    row.appendChild(spriteCanvas(item.sprite));

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `
      <div class="name">${item.name}${isEquipped ? '（そうび中）' : ''}</div>
      <div class="sub">${item.desc} ・ 🪙${item.cost}</div>`;
    row.appendChild(meta);

    const btn = document.createElement('button');
    btn.className = 'btn small' + (isEquipped ? ' secondary' : '');
    if (!owned) {
      btn.textContent = 'こうにゅう';
      btn.onclick = () => {
        const res = buy(item.id);
        const msg = document.getElementById('move-msg');
        msg.textContent = res.ok ? '' : '🪙が足りません';
        render();
      };
    } else {
      btn.textContent = isEquipped ? 'はずす' : 'そうびする';
      btn.onclick = () => { equip(item.id); render(); };
    }
    row.appendChild(btn);
    el.appendChild(row);
  }
}

function showModal(emoji, title, text) {
  document.getElementById('modal-emoji').textContent = emoji;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-text').textContent = text;
  document.getElementById('modal').hidden = false;
}

try {
  init();
} catch (err) {
  console.error(err);
}
