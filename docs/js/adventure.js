import { getGameView, advance, buy, equip } from './store.js';
import { tileInfo, spriteToCells, idleOffset } from './lib/game.js';

const THEME = {
  grass: { sky: '#bee7ff', ground: '#3aa655', ground2: '#34974c' },
  forest: { sky: '#d9f2df', ground: '#2f7d43', ground2: '#276b39' },
  sky: { sky: '#eaf4ff', ground: '#cbb994', ground2: '#b8a37f' },
};

const VISIBLE_TILES = 8;
const CELL = 4;

let currentView = null;
let rafId = null;

function init() {
  document.getElementById('advance-btn').onclick = handleAdvance;
  document.getElementById('modal-ok').onclick = () => { document.getElementById('modal').hidden = true; };
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

  if (res.chestReward) {
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

// ---- レトロマップ描画 ----

function drawSprite(ctx, name, centerX, groundY, cellSize = CELL) {
  const { cells, w, h } = spriteToCells(name);
  const left = centerX - (w * cellSize) / 2;
  const top = groundY - h * cellSize;
  for (const c of cells) {
    ctx.fillStyle = c.color;
    ctx.fillRect(left + c.x * cellSize, top + c.y * cellSize, cellSize, cellSize);
  }
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

  const groundY = H - 28;
  const tileWidth = W / VISIBLE_TILES;
  const length = view.area.length;
  const maxCamera = Math.max(0, length - VISIBLE_TILES);
  const camera = Math.min(maxCamera, Math.max(0, view.localTile - 3));

  for (let i = 0; i < VISIBLE_TILES; i += 1) {
    const tile = camera + i;
    if (tile >= length) break;
    const x = i * tileWidth;
    ctx.fillStyle = tile % 2 === 0 ? theme.ground : theme.ground2;
    ctx.fillRect(x, groundY, tileWidth, H - groundY);
  }

  const openedChests = view.game.openedChests || [];
  for (let i = 0; i < VISIBLE_TILES; i += 1) {
    const tile = camera + i;
    if (tile >= length) break;
    const info = tileInfo(view.area, tile, openedChests);
    if (info.chest) {
      const x = i * tileWidth + tileWidth / 2;
      drawSprite(ctx, info.chestOpened ? 'chestOpen' : 'chest', x, groundY);
    }
  }

  if (length - 1 >= camera && length - 1 < camera + VISIBLE_TILES) {
    const x = (length - 1 - camera) * tileWidth + tileWidth / 2;
    drawSprite(ctx, 'flag', x, groundY);
  }

  if (view.localTile >= camera && view.localTile < camera + VISIBLE_TILES) {
    const x = (view.localTile - camera) * tileWidth + tileWidth / 2;
    drawSprite(ctx, 'hero', x, groundY - heroBob);
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
