import {
  getPetView, adoptPet, feedPet, playPet, graduatePet, cleanPetPoop,
} from './store.js';
import {
  STAGE_NAMES, spriteKeyFor, petSpriteToCells, sadMarkCells, poopCells, bodyScaleFor,
} from './lib/pet.js';
import { idleOffset } from './lib/game.js';

let currentView = null;
let rafId = null;

// 左右にゆらゆら歩き回るための、その場だけの見た目状態（保存しない）。
const wander = { x: 0, targetX: 0, waitUntil: 0 };

function init() {
  document.getElementById('pet-feed-btn').onclick = handleFeed;
  document.getElementById('pet-play-btn').onclick = handlePlay;
  document.getElementById('pet-clean-btn').onclick = handleClean;
  document.getElementById('pet-graduate-btn').onclick = handleGraduate;
  document.addEventListener('game-tab-changed', (e) => {
    if (e.detail.tab === 'pet') startIdleLoop(); else stopIdleLoop();
  });
  render();
}

// ペットを揺らしつつ、左右にもゆっくり徘徊させて再描画し続ける。タブ非表示中は止める。
function loop(t) {
  if (currentView) {
    updateWander(t);
    drawPet(currentView, t);
  }
  rafId = requestAnimationFrame(loop);
}
function startIdleLoop() {
  if (rafId) return;
  rafId = requestAnimationFrame(loop);
}
function stopIdleLoop() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}

// 目的地に少しずつ近づき、着いたらしばらく待ってから次の目的地を選ぶ。
function updateWander(t) {
  const canvas = document.getElementById('pet-canvas');
  const bound = canvas.width * 0.28;
  if (Math.abs(wander.targetX - wander.x) < 0.5) {
    if (t > wander.waitUntil) {
      wander.targetX = (Math.random() * 2 - 1) * bound;
      wander.waitUntil = t + 1200 + Math.random() * 1800;
    }
  } else {
    wander.x += (wander.targetX - wander.x) * 0.02;
  }
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
    btn.textContent = '育てる';
    btn.onclick = () => { adoptPet(sp.id); render(); };
    card.appendChild(btn);
    el.appendChild(card);
  }
}

// ---- お世話 ----

function flavorText(pet) {
  if (pet.poopCount >= 3) return 'うんちが溜まってる…掃除してほしいな';
  if (pet.hunger < 30) return 'お腹すいたな…ごはんちょうだい';
  if (pet.happiness < 30) return 'ちょっと寂しいな…遊んでほしいな';
  if (pet.hunger >= 90 && pet.happiness >= 90) return '今日も元気！大好き！';
  return 'まったり中。';
}

function renderCare(view) {
  const { pet, feedCost, cleanCost } = view;
  document.getElementById('pet-coin-balance').textContent = view.balance;
  document.getElementById('pet-stage-name').textContent = STAGE_NAMES[pet.stage];
  document.getElementById('pet-hunger-fill').style.width = `${pet.hunger}%`;
  document.getElementById('pet-happy-fill').style.width = `${pet.happiness}%`;
  document.getElementById('pet-flavor').textContent = flavorText(pet);
  document.getElementById('pet-feed-cost').textContent = feedCost;
  document.getElementById('pet-clean-cost').textContent = cleanCost;
  document.getElementById('pet-clean-btn').textContent = `掃除（🪙 ${cleanCost}）${pet.poopCount > 0 ? ` ×${pet.poopCount}` : ''}`;

  const progress = document.getElementById('pet-progress');
  if (pet.stage < 2) {
    progress.textContent = `次の姿まで：お世話 ${pet.careCount}/${view.careToEvolve[pet.stage]}`;
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
      : res.reason === 'full' ? 'もうお腹いっぱいみたい' : '';
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
    msg.textContent = res.reason === 'full' ? 'もう十分仲良しみたい' : '';
    return;
  }
  msg.textContent = '';
  render();
  if (res.evolved) celebrateEvolution(res.pet);
}

function handleClean() {
  const res = cleanPetPoop();
  const msg = document.getElementById('pet-msg');
  if (!res.ok) {
    msg.textContent = res.reason === 'not-enough' ? '🪙が足りません'
      : res.reason === 'clean' ? 'もう綺麗だよ' : '';
    return;
  }
  msg.textContent = '✅ 綺麗になった';
  render();
}

function celebrateEvolution(pet) {
  showModal('✨', '姿が変わった！', `${STAGE_NAMES[pet.stage]}になった！`);
}

function handleGraduate() {
  if (!confirm('この子を卒業させて、図鑑に記録しますか？')) return;
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

  const pet = view.pet;
  const key = spriteKeyFor(pet);
  const { cells, w, h } = petSpriteToCells(key);
  const scale = bodyScaleFor(pet);
  const cellSize = 14 * scale;
  const bob = idleOffset(tNow, 2, 1000);
  const centerX = canvas.width / 2 + wander.x;
  const left = centerX - (w * cellSize) / 2;
  const top = (canvas.height - h * cellSize) / 2 - bob;
  for (const c of cells) {
    ctx.fillStyle = c.color;
    ctx.fillRect(left + c.x * cellSize, top + c.y * cellSize, cellSize, cellSize);
  }

  // なかよし度が低いと、頭の横に涙マークを出す。
  if (pet.happiness < 30) {
    const sad = sadMarkCells();
    const sadSize = 10;
    const sadLeft = left + w * cellSize + 2;
    const sadTop = top;
    for (const c of sad.cells) {
      ctx.fillStyle = c.color;
      ctx.fillRect(sadLeft + c.x * sadSize, sadTop + c.y * sadSize, sadSize, sadSize);
    }
  }

  // うんちはキャンバスの「右下の角」にまとめて並べる。
  // 体の真下だと体の一部に見えてしまうため、あえて横（右下）へ寄せて固定する。
  if (pet.poopCount > 0) {
    const poop = poopCells();
    const poopSize = 8;
    const poopW = poop.w * poopSize;
    const poopGap = poopW + 4;
    const py = canvas.height - poop.h * poopSize - 6;
    const rightEdge = canvas.width - 6;
    for (let i = 0; i < pet.poopCount; i += 1) {
      const px = rightEdge - poopW - i * poopGap; // 右詰めで左へ増えていく
      for (const c of poop.cells) {
        ctx.fillStyle = c.color;
        ctx.fillRect(px + c.x * poopSize, py + c.y * poopSize, poopSize, poopSize);
      }
    }
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
