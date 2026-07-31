import { getShooterView, startRun, finishRun, buyUpgrade } from './store.js';
import { shooterSpriteToCells, difficultyAt, hits } from './lib/shooter.js';

const CELL = 3;           // ドット1つの大きさ（px）
const PLAYER_BOTTOM = 26; // 自機の下端からの位置

let view = null;          // 画面表示用のデータ
let run = null;           // プレイ中の状態（null ならプレイしていない）
let rafId = null;
let lastFrame = 0;
let selectedTier = null;  // 選択中のブーストid

// 押しっぱなし操作の状態。
const input = { left: false, right: false, shoot: false };

function init() {
  document.getElementById('shooter-start-btn').onclick = handleStart;
  document.getElementById('modal-ok').onclick = () => { document.getElementById('modal').hidden = true; };
  wireControls();
  document.addEventListener('game-tab-changed', (e) => {
    if (e.detail.tab === 'shooter') { if (run) startLoop(); } else { stopLoop(); releaseAll(); }
  });
  render();
}

// ---- 画面（プレイ外） ----

function render() {
  view = getShooterView();
  document.getElementById('shooter-coin').textContent = view.balance;
  document.getElementById('shooter-highscore').textContent = view.highScore;
  document.getElementById('shooter-kills').textContent = view.totalKills;
  document.getElementById('shooter-plays').textContent = view.plays;
  if (!selectedTier) selectedTier = view.boostTiers[0].id;
  renderTiers();
  renderUpgrades();
  if (!run) drawIdleScreen();
}

function renderTiers() {
  const el = document.getElementById('boost-list');
  el.innerHTML = '';
  for (const t of view.boostTiers) {
    const card = document.createElement('button');
    card.className = 'boost-card' + (t.id === selectedTier ? ' active' : '');
    card.disabled = Boolean(run);
    card.innerHTML = `
      <div class="boost-name">${t.name}</div>
      <div class="boost-cost">🪙${t.cost}</div>
      <div class="boost-stats">威力${t.stats.power} ・ ライフ${t.stats.lives}</div>
      <div class="boost-desc">${t.desc}</div>`;
    card.onclick = () => { selectedTier = t.id; renderTiers(); };
    el.appendChild(card);
  }
}

function renderUpgrades() {
  const el = document.getElementById('upgrade-list');
  el.innerHTML = '';
  for (const u of view.upgrades) {
    const row = document.createElement('div');
    row.className = 'task-row';
    const maxed = u.nextCost === null;
    row.innerHTML = `
      <div class="icon">${u.icon}</div>
      <div class="meta">
        <div class="name">${u.name} <span class="up-level">Lv.${u.level}/${u.maxLevel}</span></div>
        <div class="sub">${u.desc}${maxed ? ' ・ 最大レベル' : ` ・ つぎ 🪙${u.nextCost}`}</div>
      </div>`;
    const btn = document.createElement('button');
    btn.className = 'btn small' + (maxed ? ' secondary' : '');
    btn.textContent = maxed ? 'MAX' : '強化';
    btn.disabled = maxed || Boolean(run);
    btn.onclick = () => {
      const res = buyUpgrade(u.kind);
      document.getElementById('shooter-msg').textContent = res.ok
        ? `✅ ${u.name} が Lv.${res.level} になった！`
        : (res.reason === 'not-enough' ? '🪙が足りません' : '');
      render();
    };
    row.appendChild(btn);
    el.appendChild(row);
  }
}

// プレイしていないときの画面（自機だけ表示）。
function drawIdleScreen() {
  const canvas = document.getElementById('shooter-canvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  drawBackground(ctx, canvas, 0);
  const plane = shooterSpriteToCells('player');
  drawCells(ctx, plane, canvas.width / 2, canvas.height - PLAYER_BOTTOM);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('スタートをおしてね', canvas.width / 2, canvas.height / 2);
}

// ---- 出撃 ----

function handleStart() {
  if (run) return;
  const res = startRun(selectedTier);
  const msg = document.getElementById('shooter-msg');
  if (!res.ok) {
    msg.textContent = res.reason === 'not-enough' ? `🪙が足りません（${res.cost}コイン必要）` : '';
    return;
  }
  msg.textContent = '';
  const canvas = document.getElementById('shooter-canvas');
  run = {
    stats: res.stats,
    lives: res.stats.lives,
    score: 0,
    kills: 0,
    // 時間は「ループが動いている間だけ」進める累積時間（ms）。
    // 壁時計だと、タブを離れている間も進んで難易度が跳ね上がってしまうため。
    elapsed: 0,
    nextSpawnAt: 0,
    nextFireAt: 0,
    player: { x: canvas.width / 2, y: canvas.height - PLAYER_BOTTOM },
    bullets: [],
    enemies: [],
    booms: [],
    over: false,
  };
  render();
  document.getElementById('shooter-start-btn').disabled = true;
  document.getElementById('shooter-hud').hidden = false;
  lastFrame = performance.now();
  startLoop();
}

function endRun() {
  const { score, kills } = run;
  const res = finishRun({ score, kills });
  run = null;
  stopLoop();
  releaseAll();
  document.getElementById('shooter-start-btn').disabled = false;
  document.getElementById('shooter-hud').hidden = true;
  render();
  showModal(
    res.isNewRecord ? '🏆' : '💥',
    res.isNewRecord ? 'ハイスコア更新！' : 'ゲームオーバー',
    `スコア ${score}（${kills}機 撃墜）\nハイスコア ${res.highScore}`,
  );
}

// ---- 操作（押しっぱなし対応） ----

function wireControls() {
  bindHold('ctrl-left', 'left');
  bindHold('ctrl-right', 'right');
  bindHold('ctrl-shot', 'shoot');
  // キーボードでも遊べるように（PC確認用）。
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') input.left = true;
    if (e.key === 'ArrowRight') input.right = true;
    if (e.key === ' ') input.shoot = true;
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') input.left = false;
    if (e.key === 'ArrowRight') input.right = false;
    if (e.key === ' ') input.shoot = false;
  });
}

function bindHold(id, key) {
  const el = document.getElementById(id);
  const press = (e) => { e.preventDefault(); input[key] = true; };
  const release = (e) => { e.preventDefault(); input[key] = false; };
  el.addEventListener('pointerdown', press);
  el.addEventListener('pointerup', release);
  el.addEventListener('pointerleave', release);
  el.addEventListener('pointercancel', release);
}

function releaseAll() {
  input.left = false;
  input.right = false;
  input.shoot = false;
}

// ---- ゲームループ ----

function startLoop() {
  if (rafId) return;
  lastFrame = performance.now();
  rafId = requestAnimationFrame(loop);
}
function stopLoop() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}

function loop(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000); // 1フレームの秒数（タブ復帰時の飛びを抑制）
  lastFrame = now;
  if (run) {
    run.elapsed += dt * 1000;
    update(dt);
    draw();
  }
  rafId = requestAnimationFrame(loop);
}

function update(dt) {
  const canvas = document.getElementById('shooter-canvas');
  const cfg = view.config;
  const s = run.stats;
  const now = run.elapsed; // ゲーム内時間（一時停止中は進まない）
  const diff = difficultyAt(now, cfg);

  // 自機の移動。
  const half = 12;
  if (input.left) run.player.x -= s.playerSpeed * dt;
  if (input.right) run.player.x += s.playerSpeed * dt;
  run.player.x = Math.max(half, Math.min(canvas.width - half, run.player.x));

  // ショット（押しっぱなしで連射）。
  if (input.shoot && now >= run.nextFireAt) {
    run.nextFireAt = now + s.fireIntervalMs;
    run.bullets.push({ x: run.player.x - 3, y: run.player.y - 20, w: 6, h: 9 });
  }

  // 弾の移動。フレームが飛んでも敵をすり抜けないよう、移動前の位置を覚えておく。
  for (const b of run.bullets) {
    b.prevY = b.y;
    b.y -= s.bulletSpeed * dt;
  }
  run.bullets = run.bullets.filter((b) => b.y + b.h > 0);

  // 敵の出現。
  if (now >= run.nextSpawnAt) {
    run.nextSpawnAt = now + diff.spawnMs;
    const tough = Math.random() < diff.toughChance;
    const w = 24;
    run.enemies.push({
      x: Math.random() * (canvas.width - w),
      y: -24,
      w,
      h: 18,
      tough,
      hp: tough ? cfg.enemy.toughHp : cfg.enemy.normalHp,
      speed: diff.speed * (tough ? 0.8 : 1),
    });
  }

  // 敵の移動と、画面下に抜けた判定。
  for (const e of run.enemies) e.y += e.speed * dt;
  const escaped = run.enemies.filter((e) => e.y > canvas.height);
  if (escaped.length > 0) {
    run.enemies = run.enemies.filter((e) => e.y <= canvas.height);
    run.lives -= escaped.length;
  }

  // 弾と敵の当たり判定。1フレームで進んだ区間ぜんぶを判定対象にする（すり抜け防止）。
  for (const b of run.bullets) {
    const sweep = {
      x: b.x,
      y: b.y,
      w: b.w,
      h: Math.max(b.h, (b.prevY ?? b.y) + b.h - b.y),
    };
    for (const e of run.enemies) {
      if (e.hp > 0 && hits(sweep, e)) {
        e.hp -= s.power;
        b.y = -999; // この弾は消す
        if (e.hp <= 0) {
          run.score += e.tough ? cfg.enemy.scoreTough : cfg.enemy.scoreNormal;
          run.kills += 1;
          run.booms.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, until: now + 260 });
        }
        break;
      }
    }
  }
  run.bullets = run.bullets.filter((b) => b.y > -100);
  run.enemies = run.enemies.filter((e) => e.hp > 0);

  // 自機と敵の衝突。
  const pbox = { x: run.player.x - half, y: run.player.y - 20, w: half * 2, h: 22 };
  const crashed = run.enemies.filter((e) => hits(pbox, e));
  if (crashed.length > 0) {
    run.enemies = run.enemies.filter((e) => !crashed.includes(e));
    run.lives -= 1;
    for (const e of crashed) run.booms.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, until: now + 260 });
  }

  run.booms = run.booms.filter((b) => b.until > now);

  // HUD更新。
  document.getElementById('hud-score').textContent = run.score;
  document.getElementById('hud-lives').textContent = '❤'.repeat(Math.max(0, run.lives));

  if (run.lives <= 0 && !run.over) {
    run.over = true;
    endRun();
  }
}

// ---- 描画 ----

function drawCells(ctx, cellsObj, centerX, bottomY, cellSize = CELL) {
  const { cells, w, h } = cellsObj;
  const left = centerX - (w * cellSize) / 2;
  const top = bottomY - h * cellSize;
  for (const c of cells) {
    ctx.fillStyle = c.color;
    ctx.fillRect(left + c.x * cellSize, top + c.y * cellSize, cellSize, cellSize);
  }
}

function drawBackground(ctx, canvas, now) {
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // 流れる星。
  ctx.fillStyle = '#26325a';
  for (let i = 0; i < 28; i += 1) {
    const x = (i * 97) % canvas.width;
    const y = ((i * 53) + (now / 12)) % canvas.height;
    ctx.fillRect(x, y, 2, 2);
  }
}

function draw() {
  const canvas = document.getElementById('shooter-canvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  drawBackground(ctx, canvas, run.elapsed);

  ctx.fillStyle = '#f5e08a';
  for (const b of run.bullets) ctx.fillRect(b.x, b.y, b.w, b.h);

  for (const e of run.enemies) {
    drawCells(ctx, shooterSpriteToCells(e.tough ? 'enemyTough' : 'enemy'), e.x + e.w / 2, e.y + e.h);
  }

  for (const b of run.booms) {
    drawCells(ctx, shooterSpriteToCells('boom'), b.x, b.y + 8, 4);
  }

  drawCells(ctx, shooterSpriteToCells('player'), run.player.x, run.player.y);
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
