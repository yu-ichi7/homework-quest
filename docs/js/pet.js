import { getPetView, adoptPet, feedPet, playPet, graduatePet } from './store.js';
import { STAGE_NAMES, spriteKeyFor, petSpriteToCells } from './lib/pet.js';
import { idleOffset } from './lib/game.js';

let currentView = null;
let rafId = null;

function init() {
  document.getElementById('pet-feed-btn').onclick = handleFeed;
  document.getElementById('pet-play-btn').onclick = handlePlay;
  document.getElementById('pet-graduate-btn').onclick = handleGraduate;
  document.addEventListener('game-tab-changed', (e) => {
    if (e.detail.tab === 'pet') startIdleLoop(); else stopIdleLoop();
  });
  render();
}

// ペットだけ idleOffset ぶん揺らして再描画し続ける。タブ非表示中は止める。
function loop(t) {
  if (currentView) drawPet(currentView, t);
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
  const view = getPetView();
  currentView = view;

  document.getElementById('pet-picker-panel').hidden = Boolean(view.pet);
  document.getElementById('pet-care-panel').hidden = !view.pet;

  if (!view.pet) {
    renderPicker(view);
  } else {
    renderCare(view);
  }
  renderAlbum(view);
  drawPet(view, performance.now());
}

// ---- 種選び ----

function renderPicker(view) {
  const el = document.getElementById('pet-picker');
  el.innerHTML = '';
  for (const sp of view.species) {
    const card = document.createElement('div');
    card.className = 'task-row';
    card.appendChild(miniSpriteCanvas(`${sp.id}Baby`));
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `<div class="name">${sp.name}</div>`;
    card.appendChild(meta);
    const btn = document.createElement('button');
    btn.className = 'btn small';
    btn.textContent = 'そだてる';
    btn.onclick = () => { adoptPet(sp.id); render(); };
    card.appendChild(btn);
    el.appendChild(card);
  }
}

// ---- お世話 ----

function flavorText(pet) {
  if (pet.hunger < 30) return 'おなかすいたな…ごはんちょうだい';
  if (pet.happiness < 30) return 'ちょっとさみしいな…あそんでほしいな';
  if (pet.hunger >= 90 && pet.happiness >= 90) return 'きょうもげんき！だいすき！';
  return 'まったり中。';
}

function renderCare(view) {
  const { pet, feedCost } = view;
  document.getElementById('pet-coin-balance').textContent = view.balance;
  document.getElementById('pet-stage-name').textContent = STAGE_NAMES[pet.stage];
  document.getElementById('pet-hunger-fill').style.width = `${pet.hunger}%`;
  document.getElementById('pet-happy-fill').style.width = `${pet.happiness}%`;
  document.getElementById('pet-flavor').textContent = flavorText(pet);
  document.getElementById('pet-feed-cost').textContent = feedCost;

  const progress = document.getElementById('pet-progress');
  if (pet.stage < 2) {
    progress.textContent = `つぎのすがたまで：おせわ ${pet.careCount}/${view.careToEvolve[pet.stage]}`;
  } else {
    progress.textContent = '成体になりました！';
  }

  document.getElementById('pet-graduate-btn').hidden = pet.stage !== 2;
}

function handleFeed() {
  const res = feedPet();
  const msg = document.getElementById('pet-msg');
  if (!res.ok) {
    msg.textContent = res.reason === 'not-enough' ? '🪙が足りません'
      : res.reason === 'full' ? 'もうおなかいっぱいみたい' : '';
    return;
  }
  msg.textContent = '';
  render();
  if (res.evolved) celebrateEvolution(res.pet);
}

function handlePlay() {
  const res = playPet();
  const msg = document.getElementById('pet-msg');
  if (!res.ok) {
    msg.textContent = res.reason === 'full' ? 'もうじゅうぶんなかよしみたい' : '';
    return;
  }
  msg.textContent = '';
  render();
  if (res.evolved) celebrateEvolution(res.pet);
}

function celebrateEvolution(pet) {
  showModal('✨', 'すがたがかわった！', `${STAGE_NAMES[pet.stage]}になった！`);
}

function handleGraduate() {
  if (!confirm('この子をそつぎょうさせて、図鑑に記録しますか？')) return;
  graduatePet();
  render();
}

// ---- 図鑑 ----

function renderAlbum(view) {
  const el = document.getElementById('pet-album');
  el.innerHTML = view.album.length ? '' : '<div class="empty">まだ記録がありません</div>';
  for (const entry of view.album) {
    const row = document.createElement('div');
    row.className = 'task-row';
    row.appendChild(miniSpriteCanvas(`${entry.species}Adult${entry.form === 'tired' ? 'Tired' : 'Happy'}`));
    const meta = document.createElement('div');
    meta.className = 'meta';
    const date = new Date(entry.matured).toLocaleDateString('ja-JP');
    meta.innerHTML = `<div class="name">${entry.form === 'tired' ? 'おつかれ気味な成体' : '元気な成体'}</div><div class="sub">卒業日: ${date}</div>`;
    row.appendChild(meta);
    el.appendChild(row);
  }
}

// ---- 描画 ----

function drawPet(view, tNow = 0) {
  const canvas = document.getElementById('pet-canvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!view.pet) return;

  const key = spriteKeyFor(view.pet);
  const { cells, w, h } = petSpriteToCells(key);
  const cellSize = 14;
  const bob = idleOffset(tNow, 2, 1000);
  const left = (canvas.width - w * cellSize) / 2;
  const top = (canvas.height - h * cellSize) / 2 - bob;
  for (const c of cells) {
    ctx.fillStyle = c.color;
    ctx.fillRect(left + c.x * cellSize, top + c.y * cellSize, cellSize, cellSize);
  }
}

function miniSpriteCanvas(key, cellSize = 6) {
  const { cells, w, h } = petSpriteToCells(key);
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

function showModal(emoji, title, text) {
  document.getElementById('modal-emoji').textContent = emoji;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-text').textContent = text;
  document.getElementById('modal').hidden = false;
}
document.getElementById('modal-ok').onclick = () => { document.getElementById('modal').hidden = true; };

try {
  init();
} catch (err) {
  console.error(err);
}
