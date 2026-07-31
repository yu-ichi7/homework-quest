import { getShooterView, startRun, finishRun, buyUpgrade } from './store.js';
import {
  shooterSpriteToCells, stageAt, hits,
  shouldDropItem, pickItemType, applyItem,
} from './lib/shooter.js';

const CELL = 3;           // ドット1つの大きさ（px）
const PLAYER_BOTTOM = 30; // 自機の下端からの位置

let view = null;          // 画面表示用のデータ
let run = null;           // プレイ中の状態（null ならプレイしていない）
let rafId = null;
let lastFrame = 0;
let selectedStage = 0;    // 選択中のステージ（0始まり）

// 指でなぞった位置（この x に自機が寄っていく）。null なら動かさない。
let touchX = null;

function init() {
  document.getElementById('shooter-start-btn').onclick = handleStart;
  document.getElementById('overlay-quit').onclick = () => quitRun();
  document.getElementById('modal-ok').onclick = () => { document.getElementById('modal').hidden = true; };
  wireControls();
  document.addEventListener('game-tab-changed', (e) => {
    if (e.detail.tab === 'shooter') { if (run) startLoop(); } else { stopLoop(); touchX = null; }
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
  document.getElementById('play-cost').textContent = view.playCost;
  // 解放済みで、まだ選べる位置に補正する。
  if (view.stages[selectedStage]?.locked) selectedStage = view.cleared;
  renderStages();
  renderUpgrades();
}

function renderStages() {
  const el = document.getElementById('stage-list');
  el.innerHTML = '';
  for (const st of view.stages) {
    const card = document.createElement('button');
    card.className = 'stage-card'
      + (st.index === selectedStage ? ' active' : '')
      + (st.locked ? ' locked' : '');
    card.disabled = st.locked;
    card.innerHTML = `
      <div class="stage-no">${st.locked ? '🔒' : `STAGE ${st.index + 1}`}</div>
      <div class="stage-name">${st.locked ? '？？？' : st.name}</div>
      <div class="stage-boss">${st.locked ? '' : `👾 ${st.bossName}`}</div>
      ${st.cleared ? '<div class="stage-clear">クリア済み</div>' : ''}`;
    card.onclick = () => { selectedStage = st.index; renderStages(); };
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
    btn.disabled = maxed;
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

// ---- 全画面オーバーレイ ----

function openOverlay() {
  document.getElementById('game-overlay').hidden = false;
  // プレイ中はページが動かないようにする（なぞって操作するため）。
  document.body.style.overflow = 'hidden';
}

function closeOverlay() {
  document.getElementById('game-overlay').hidden = true;
  document.body.style.overflow = '';
}

// ---- 出撃 ----

function handleStart() {
  if (run) return;
  const res = startRun(selectedStage);
  const msg = document.getElementById('shooter-msg');
  if (!res.ok) {
    msg.textContent = res.reason === 'not-enough' ? `🪙が足りません（${res.cost}コイン必要）`
      : res.reason === 'locked' ? 'このステージはまだ開いていません' : '';
    return;
  }
  msg.textContent = '';
  const canvas = document.getElementById('shooter-canvas');
  run = {
    stats: res.stats,
    lives: res.stats.lives,
    score: 0,
    kills: 0,
    clearedIndex: 0,          // このプレイでクリアしたステージ数
    elapsed: 0,               // ループが動いている間だけ進む時間（ms）
    player: { x: canvas.width / 2, y: canvas.height - PLAYER_BOTTOM },
    bullets: [],
    enemies: [],
    ebullets: [],
    items: [],
    booms: [],
    boss: null,
    invincibleUntil: 0,
    pickupText: '',
    pickupUntil: 0,
    over: false,
  };
  touchX = null;
  startStage(res.stageIndex);
  openOverlay();
  render();
  lastFrame = performance.now();
  startLoop();
}

// ステージを開始（次のステージへ進むときも呼ぶ。ライフや強化は引き継ぐ）。
function startStage(index) {
  const stage = stageAt(index, view.config);
  run.stageIndex = index;
  run.stage = stage;
  run.phase = 'wave';
  run.stageStartedAt = run.elapsed;
  run.nextSpawnAt = run.elapsed + 400;
  run.nextFireAt = run.elapsed;
  run.nextEnemyFireAt = run.elapsed + stage.enemyFireMs;
  run.enemies = [];
  run.ebullets = [];
  run.boss = null;
  run.bannerText = `STAGE ${index + 1}　${stage.name}`;
  run.bannerUntil = run.elapsed + 1800;
  document.getElementById('hud-stage').textContent = `S${index + 1} ${stage.name}`;
  document.getElementById('boss-bar').hidden = true;
}

function endRun(allCleared = false) {
  const { score, kills, clearedIndex } = run;
  const res = finishRun({ score, kills, clearedIndex });
  run = null;
  stopLoop();
  closeOverlay();
  render();

  const title = allCleared ? 'ぜんぶクリア！' : (res.isNewRecord ? 'ハイスコア更新！' : 'ゲームオーバー');
  const emoji = allCleared ? '👑' : (res.isNewRecord ? '🏆' : '💥');
  const unlockMsg = res.unlockedNew ? `\n新しいステージが開いた！` : '';
  showModal(emoji, title, `スコア ${score}（${kills}機 撃墜）\nハイスコア ${res.highScore}${unlockMsg}`);
}

// 「やめる」で中断（そこまでの記録は残す）。
function quitRun() {
  if (!run) { closeOverlay(); return; }
  endRun(false);
}

// ---- 操作（画面を指でなぞるだけ。弾は自動で出る） ----

function wireControls() {
  const canvas = document.getElementById('shooter-canvas');
  const move = (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    touchX = (e.clientX - rect.left) * (canvas.width / rect.width);
  };
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    move(e);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.buttons === 0 && e.pointerType === 'mouse') return; // マウスは押している間だけ
    move(e);
  });
  canvas.addEventListener('pointerup', (e) => { e.preventDefault(); });
  window.addEventListener('keydown', (e) => {
    if (!run) return;
    if (e.key === 'ArrowLeft') touchX = run.player.x - 40;
    if (e.key === 'ArrowRight') touchX = run.player.x + 40;
  });
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
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
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
  const stage = run.stage;
  const s = run.stats;
  const now = run.elapsed;

  // 自機の移動：指の位置へ少しずつ寄る。
  const half = 12;
  if (touchX !== null) {
    const target = Math.max(half, Math.min(canvas.width - half, touchX));
    const maxStep = s.playerSpeed * 2.2 * dt;
    const diff = target - run.player.x;
    run.player.x += Math.abs(diff) <= maxStep ? diff : Math.sign(diff) * maxStep;
  }
  run.player.x = Math.max(half, Math.min(canvas.width - half, run.player.x));

  // 自機の弾（自動連射）。
  if (now >= run.nextFireAt) {
    run.nextFireAt = now + s.fireIntervalMs;
    run.bullets.push({ x: run.player.x - 3, y: run.player.y - 22, w: 6, h: 9 });
  }
  for (const b of run.bullets) {
    b.prevY = b.y;
    b.y -= s.bulletSpeed * dt;
  }
  run.bullets = run.bullets.filter((b) => b.y + b.h > 0);

  // ザコの出現（ボス戦中は出さない）。
  if (run.phase === 'wave' && now >= run.nextSpawnAt) {
    run.nextSpawnAt = now + stage.spawnMs;
    const tough = Math.random() < stage.toughChance;
    const w = 24;
    run.enemies.push({
      x: Math.random() * (canvas.width - w),
      y: -24, w, h: 18, tough,
      hp: tough ? cfg.enemy.toughHp : cfg.enemy.normalHp,
      speed: stage.enemySpeed * (tough ? 0.8 : 1),
    });
  }

  // ザコの攻撃。
  if (now >= run.nextEnemyFireAt && run.enemies.length > 0) {
    run.nextEnemyFireAt = now + stage.enemyFireMs;
    const shooter = run.enemies[Math.floor(Math.random() * run.enemies.length)];
    run.ebullets.push({ x: shooter.x + shooter.w / 2 - 3, y: shooter.y + shooter.h, w: 7, h: 10, vx: 0, vy: cfg.enemyBulletSpeed });
  }

  // ボス出現。
  if (run.phase === 'wave' && now - run.stageStartedAt >= stage.duration) {
    run.phase = 'boss';
    run.boss = {
      x: canvas.width / 2 - 36, y: 30, w: 72, h: 54,
      hp: stage.boss.hp, maxHp: stage.boss.hp,
      dir: 1, fireAt: now + 800,
    };
    run.bannerText = `⚠ ${stage.boss.name} 出現！`;
    run.bannerUntil = now + 1600;
    document.getElementById('boss-bar').hidden = false;
    document.getElementById('boss-name').textContent = stage.boss.name;
  }

  // ボスの動きと攻撃。
  if (run.boss) {
    const b = run.boss;
    b.x += stage.boss.speed * b.dir * dt;
    if (b.x <= 0) { b.x = 0; b.dir = 1; }
    if (b.x + b.w >= canvas.width) { b.x = canvas.width - b.w; b.dir = -1; }
    if (now >= b.fireAt) {
      b.fireAt = now + stage.boss.fireMs;
      const ways = stage.boss.ways;
      const cx = b.x + b.w / 2;
      for (let i = 0; i < ways; i += 1) {
        const spread = (i - (ways - 1) / 2) * 55;
        run.ebullets.push({ x: cx - 4, y: b.y + b.h, w: 8, h: 12, vx: spread, vy: cfg.enemyBulletSpeed * 1.1 });
      }
    }
    document.getElementById('boss-hp-fill').style.width = `${Math.max(0, (b.hp / b.maxHp) * 100)}%`;
  }

  // 敵の弾の移動。
  for (const eb of run.ebullets) {
    eb.x += (eb.vx || 0) * dt;
    eb.y += eb.vy * dt;
  }
  run.ebullets = run.ebullets.filter((eb) => eb.y < canvas.height && eb.x > -20 && eb.x < canvas.width + 20);

  // ザコの移動と、画面下に抜けた判定。
  for (const e of run.enemies) e.y += e.speed * dt;
  const escaped = run.enemies.filter((e) => e.y > canvas.height);
  if (escaped.length > 0) {
    run.enemies = run.enemies.filter((e) => e.y <= canvas.height);
    damagePlayer(escaped.length, cfg);
  }

  // 自機の弾 → ザコ / ボス。
  for (const b of run.bullets) {
    const sweep = { x: b.x, y: b.y, w: b.w, h: Math.max(b.h, (b.prevY ?? b.y) + b.h - b.y) };
    let hit = false;
    for (const e of run.enemies) {
      if (e.hp > 0 && hits(sweep, e)) {
        e.hp -= s.power;
        hit = true;
        if (e.hp <= 0) {
          run.score += e.tough ? cfg.enemy.scoreTough : cfg.enemy.scoreNormal;
          run.kills += 1;
          run.booms.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, until: now + 260 });
          if (shouldDropItem(e, cfg)) {
            const type = pickItemType(cfg);
            run.items.push({ x: e.x + e.w / 2 - 10, y: e.y, w: 20, h: 20, type });
          }
        }
        break;
      }
    }
    if (!hit && run.boss && run.boss.hp > 0 && hits(sweep, run.boss)) {
      run.boss.hp -= s.power;
      hit = true;
      run.booms.push({ x: b.x, y: b.y, until: now + 160 });
    }
    if (hit) b.y = -999;
  }
  run.bullets = run.bullets.filter((b) => b.y > -100);
  run.enemies = run.enemies.filter((e) => e.hp > 0);

  // ボス撃破 → ステージクリア。
  if (run.boss && run.boss.hp <= 0) {
    const b = run.boss;
    run.boss = null;
    run.phase = 'clear';
    run.score += cfg.enemy.scoreBoss + stage.clearBonus;
    run.kills += 1;
    run.clearedIndex = Math.max(run.clearedIndex, run.stageIndex + 1);
    run.ebullets = [];
    run.booms.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, until: now + 900 });
    run.bannerText = `STAGE ${run.stageIndex + 1} クリア！`;
    run.bannerUntil = now + 1800;
    run.nextStageAt = now + 1800;
    document.getElementById('boss-bar').hidden = true;
  }

  // クリア演出のあと、次のステージへ突入（最後ならぜんぶクリア）。
  if (run.phase === 'clear' && now >= run.nextStageAt) {
    if (run.stageIndex + 1 < cfg.stages.length) {
      startStage(run.stageIndex + 1);
    } else {
      run.over = true;
      endRun(true);
      return;
    }
  }

  // アイテムの落下と取得。
  for (const it of run.items) it.y += cfg.items.fallSpeed * dt;
  const pbox = { x: run.player.x - half, y: run.player.y - 20, w: half * 2, h: 22 };
  const grabbed = run.items.filter((it) => hits(pbox, it));
  for (const it of grabbed) {
    const applied = applyItem(run.stats, run.lives, it.type, cfg);
    run.stats = applied.stats;
    run.lives = applied.lives;
    run.pickupText = it.type.name;
    run.pickupUntil = now + 1200;
  }
  run.items = run.items.filter((it) => !grabbed.includes(it) && it.y < canvas.height);

  // 被弾（敵の弾・体当たり）。無敵中は当たらない。
  if (now >= run.invincibleUntil) {
    const hitBullets = run.ebullets.filter((eb) => hits(pbox, eb));
    const crashed = run.enemies.filter((e) => hits(pbox, e));
    if (hitBullets.length > 0 || crashed.length > 0) {
      run.ebullets = run.ebullets.filter((eb) => !hitBullets.includes(eb));
      run.enemies = run.enemies.filter((e) => !crashed.includes(e));
      for (const e of crashed) run.booms.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, until: now + 260 });
      damagePlayer(1, cfg);
    }
  }

  run.booms = run.booms.filter((b) => b.until > now);

  // HUD更新。
  document.getElementById('hud-score').textContent = run.score;
  document.getElementById('hud-power').textContent = `💥${run.stats.power}`;
  document.getElementById('hud-lives').textContent = '❤'.repeat(Math.max(0, run.lives));

  if (run.lives <= 0 && !run.over) {
    run.over = true;
    endRun(false);
  }
}

// ライフを減らし、しばらく無敵にする。
function damagePlayer(amount, cfg) {
  run.lives -= amount;
  run.invincibleUntil = run.elapsed + cfg.invincibleMs;
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
  ctx.fillStyle = '#26325a';
  for (let i = 0; i < 30; i += 1) {
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

  // 自機の弾
  ctx.fillStyle = '#f5e08a';
  for (const b of run.bullets) ctx.fillRect(b.x, b.y, b.w, b.h);

  // 敵の弾
  for (const eb of run.ebullets) {
    drawCells(ctx, shooterSpriteToCells('enemyBullet'), eb.x + eb.w / 2, eb.y + eb.h, 3);
  }

  for (const e of run.enemies) {
    drawCells(ctx, shooterSpriteToCells(e.tough ? 'enemyTough' : 'enemy'), e.x + e.w / 2, e.y + e.h);
  }

  if (run.boss) {
    drawCells(ctx, shooterSpriteToCells('boss'), run.boss.x + run.boss.w / 2, run.boss.y + run.boss.h, 6);
  }

  for (const it of run.items) {
    drawCells(ctx, shooterSpriteToCells(it.type.sprite), it.x + it.w / 2, it.y + it.h);
  }

  for (const b of run.booms) {
    drawCells(ctx, shooterSpriteToCells('boom'), b.x, b.y + 8, 4);
  }

  // 自機（無敵中は点滅）。
  const blinking = run.elapsed < run.invincibleUntil && Math.floor(run.elapsed / 100) % 2 === 0;
  if (!blinking) {
    drawCells(ctx, shooterSpriteToCells('player'), run.player.x, run.player.y);
  }

  // アイテムを取ったときのひとこと。
  if (run.pickupUntil > run.elapsed) {
    ctx.fillStyle = '#f5e08a';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(run.pickupText, canvas.width / 2, canvas.height - 70);
  }

  // ステージ名・ボス出現・クリアの帯。
  if (run.bannerUntil > run.elapsed) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, canvas.height / 2 - 26, canvas.width, 52);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(run.bannerText, canvas.width / 2, canvas.height / 2 + 6);
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
