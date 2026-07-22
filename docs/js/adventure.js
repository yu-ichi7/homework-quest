import {
  getGameView, advance, buy, equip, defeatMonster, monsterDefeatCost,
} from './store.js';
import {
  tileInfo, spriteToCells, idleOffset, heroCells, pathWaveY,
} from './lib/game.js';

const THEME = {
  grass: { sky: '#bee7ff', ground: '#3aa655', ground2: '#34974c', path: '#2f7d43' },
  forest: { sky: '#d9f2df', ground: '#2f7d43', ground2: '#276b39', path: '#255e33' },
  sky: { sky: '#eaf4ff', ground: '#cbb994', ground2: '#b8a37f', path: '#a88f6c' },
};

const CELL = 5;

let currentView = null;
let rafId = null;
let battle = null; // { monster }

function init() {
  document.getElementById('advance-btn').onclick = handleAdvance;
  document.getElementById('modal-ok').onclick = () => { document.getElementById('modal').hidden = true; };
  document.getElementById('battle-defeat-btn').onclick = handleBattleDefeat;
  document.getElementById('battle-flee-btn').onclick = closeBattle;
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
  document.getElementById('area-name').textContent = view.isComplete ? '🏆 冒険クリア！' : view.area.name;

  const ratio = view.area.length > 1 ? view.localTile / (view.area.length - 1) : 1;
  document.getElementById('area-fill').style.width = `${Math.round(Math.min(1, ratio) * 100)}%`;
  document.getElementById('area-sub').textContent = view.isComplete
    ? 'すべてのエリアを制覇しました！'
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
      showModal('🪙', '宝箱！', `+${res.chestReward.coins} コイン`);
    } else {
      showModal('🎁', '宝箱！', `「${res.chestReward.item.name}」を手に入れた！`);
    }
  } else if (res.areaCleared) {
    showModal('🚩', 'エリアクリア！', `「${res.areaCleared.name}」に到着！`);
  } else if (res.completed) {
    showModal('🏆', '冒険クリア！', 'すべてのエリアを制覇した！');
  }
}

// ---- 対戦（コインで倒す。装備のこうげき力ぶん安くなる） ----

function startBattle(monster) {
  battle = { monster };
  const cost = monsterDefeatCost(monster);
  document.getElementById('battle-monster-name').textContent = monster.name;
  document.getElementById('battle-msg').textContent = `${monster.name} が現れた！ 装備が強いほど、倒すコインが安くなるよ。`;
  document.getElementById('battle-defeat-cost').textContent = cost;
  document.getElementById('battle-attack-power').textContent = currentView.heroAttack;
  document.getElementById('battle-defeat-btn').hidden = false;
  document.getElementById('battle-flee-btn').textContent = 'にげる';
  drawBattleMonster();
  document.getElementById('battle-modal').hidden = false;
}

function handleBattleDefeat() {
  if (!battle) return;
  const msg = document.getElementById('battle-msg');
  const res = defeatMonster(battle.monster);
  if (!res.ok) {
    msg.textContent = `コインが足りません（${res.cost}コイン必要）`;
    return;
  }
  render();
  msg.textContent = `${battle.monster.name} を倒した！ 🪙${res.cost} をつかい、ほうびに +${res.reward?.coins || 0} コイン！`;
  document.getElementById('battle-defeat-btn').hidden = true;
  document.getElementById('battle-flee-btn').textContent = 'とじる';
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

function drawMap(view, tNow = 0) {
  const canvas = document.getElementById('map-canvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const W = canvas.width;
  const H = canvas.height;
  const theme = THEME[view.area.theme] || THEME.grass;
  const heroBob = idleOffset(tNow, 2, 900);

  ctx.fillStyle = theme.sky;
  ctx.fillRect(0, 0, W, H);

  // マップは動かさず、エリアの全マスを画面内に並べる（スクロール無し）。
  const baseY = H - 46;
  const length = view.area.length;
  const margin = W * 0.06;
  const tileWidth = (W - margin * 2) / Math.max(1, length - 1);
  const centerAt = (tile) => ({ x: margin + tile * tileWidth, y: baseY + pathWaveY(tile) });

  // 道（タイル中心をウネウネつなぐ）。
  ctx.strokeStyle = theme.path;
  ctx.lineWidth = Math.max(8, tileWidth * 0.3);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let tile = 0; tile < length; tile += 1) {
    const { x, y } = centerAt(tile);
    if (tile === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // タイル（踏み石）。
  for (let tile = 0; tile < length; tile += 1) {
    const { x, y } = centerAt(tile);
    const size = Math.min(tileWidth * 0.6, 22);
    ctx.fillStyle = tile % 2 === 0 ? theme.ground : theme.ground2;
    ctx.beginPath();
    ctx.roundRect(x - size / 2, y - size / 2, size, size, 5);
    ctx.fill();
  }

  const openedChests = view.game.openedChests || [];
  const defeatedMonsters = view.game.defeatedMonsters || [];
  for (let tile = 0; tile < length; tile += 1) {
    const info = tileInfo(view.area, tile, openedChests, defeatedMonsters);
    const { x, y } = centerAt(tile);
    if (info.chest) drawSprite(ctx, info.chestOpened ? 'chestOpen' : 'chest', x, y);
    if (info.monster && !info.monsterDefeated) drawSprite(ctx, 'monster', x, y);
  }

  // ゴール旗（最後のマス）。
  {
    const { x, y } = centerAt(length - 1);
    drawSprite(ctx, 'flag', x, y);
  }

  // ヒーローだけがマスからマスへ動く（マップ自体は固定）。
  {
    const { x, y } = centerAt(view.localTile);
    const heroY = y - heroBob;
    const hc = heroCells(view.equipped, view.shop);
    drawCells(ctx, hc, x, heroY, CELL);

    // 武器は手もとに小さく添えて描く。
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
  const slots = [['weapon', '武器'], ['armor', '鎧'], ['boots', '靴']];
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
      <div class="name">${item.name}${isEquipped ? '（装備中）' : ''}</div>
      <div class="sub">${item.desc} ・ 🪙${item.cost}</div>`;
    row.appendChild(meta);

    const btn = document.createElement('button');
    btn.className = 'btn small' + (isEquipped ? ' secondary' : '');
    if (!owned) {
      btn.textContent = '購入';
      btn.onclick = () => {
        const res = buy(item.id);
        const msg = document.getElementById('move-msg');
        msg.textContent = res.ok ? '' : '🪙が足りません';
        render();
      };
    } else {
      btn.textContent = isEquipped ? '外す' : '装備する';
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
