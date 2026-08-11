import { getShooterView, startRun, finishRun, buyUpgrade } from './store.js';
import {
  shooterSpriteToCells, stageAt, hits,
  shouldDropItem, pickItemType, applyItem, pickEnemyType,
  stageProgress, computeScore,
} from './lib/shooter.js';

const CELL = 3;           // ドット1つの大きさ（px）
const PLAYER_BOTTOM = 30; // 自機の下端からの位置（開始位置）
const PLAYER_TOP = 120;   // 自機がここより前（上）には行けない

let view = null;          // 画面表示用のデータ
let run = null;           // プレイ中の状態（null ならプレイしていない）
let rafId = null;
let lastFrame = 0;
let selectedStage = 0;    // 選択中のステージ（0始まり）
let selectedRam = 0;      // 出撃前に買う「体当たり」の個数

// 指でなぞった位置（この座標に自機が寄っていく）。null なら動かさない。
let touchX = null;
let touchY = null;

function init() {
  document.getElementById('shooter-start-btn').onclick = handleStart;
  document.getElementById('overlay-quit').onclick = () => quitRun();
  document.getElementById('modal-ok').onclick = () => { document.getElementById('modal').hidden = true; };
  document.getElementById('ram-minus').onclick = () => { selectedRam = Math.max(0, selectedRam - 1); renderRamPicker(); };
  document.getElementById('ram-plus').onclick = () => { selectedRam = Math.min(view.ramMax, selectedRam + 1); renderRamPicker(); };
  wireControls();
  document.addEventListener('game-tab-changed', (e) => {
    if (e.detail.tab === 'shooter') { if (run) startLoop(); } else { stopLoop(); touchX = null; touchY = null; }
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
  // 解放済みで、まだ選べる位置に補正する。
  if (view.stages[selectedStage]?.locked) selectedStage = view.cleared;
  selectedRam = Math.max(0, Math.min(view.ramMax, selectedRam));
  renderStages();
  renderUpgrades();
  renderRamPicker();
}

function renderRamPicker() {
  document.getElementById('ram-count').textContent = selectedRam;
  document.getElementById('ram-max').textContent = view.ramMax;
  document.getElementById('ram-cost').textContent = view.ramCost;
  document.getElementById('ram-minus').disabled = selectedRam <= 0;
  document.getElementById('ram-plus').disabled = selectedRam >= view.ramMax;
  document.getElementById('total-cost').textContent = view.playCost + selectedRam * view.ramCost;
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
      <div class="stage-no">${st.locked ? '🔒' : `第${st.index + 1}面`}</div>
      <div class="stage-name">${st.locked ? '？？？' : st.name}</div>
      <div class="stage-boss">${st.locked ? '' : `👾 ${st.bossName}`}</div>
      <div class="stage-score">${st.locked ? '' : `満点 ${st.fullScore}`}</div>
      ${st.cleared ? '<div class="stage-clear">制覇</div>' : ''}`;
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
  const res = startRun(selectedStage, selectedRam);
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
    damageCount: 0,           // 被弾した回数（0ならノーミス）
    clearedIndex: 0,          // このプレイでクリアしたステージ数
    elapsed: 0,               // ループが動いている間だけ進む時間（ms）
    player: { x: canvas.width / 2, y: canvas.height - PLAYER_BOTTOM },
    ramCharges: res.ramCount, // 体当たりアイテムの残数
    escorts: [],              // 護衛機（最大3体）の現在位置
    nextEscortFireAt: [0, 0, 0],
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
  touchY = null;
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
  run.bannerText = `第${index + 1}面　${stage.name}`;
  run.bannerUntil = run.elapsed + 1800;
  document.getElementById('hud-stage').textContent = `第${index + 1}面 ${stage.name}`;
  document.getElementById('boss-bar').hidden = true;
}

// stageCleared: ボスを倒して終わったか（false ならライフ切れ・中断）。
function endRun(stageCleared = false) {
  const { score, kills, clearedIndex, stageIndex, damageCount } = run;
  const isLast = stageIndex + 1 >= view.config.stages.length;
  const noMiss = stageCleared && damageCount === 0;
  const res = finishRun({ score, kills, clearedIndex });
  run = null;
  stopLoop();
  closeOverlay();
  render();

  let emoji = '💥';
  let title = 'ゲームオーバー';
  if (noMiss) {
    emoji = '🌟';
    title = isLast ? '無傷で全ステージ制覇！' : `第${stageIndex + 1}面 ノーミス満点！`;
  } else if (stageCleared) {
    emoji = isLast ? '👑' : '🎉';
    title = isLast ? '全ステージ制覇！' : `第${stageIndex + 1}面 クリア！`;
  } else if (res.isNewRecord) {
    emoji = '🏆';
    title = '最高得点を更新！';
  }
  const missMsg = damageCount === 0 ? 'ノーミス' : `被弾 ${damageCount}回`;
  const unlockMsg = res.unlockedNew ? '\n新しいステージが開いた！' : '';
  showModal(emoji, title, `得点 ${score}（${kills}機 撃墜・${missMsg}）\n最高得点 ${res.highScore}${unlockMsg}`);
}

// 「やめる」で中断（そこまでの記録は残す）。
function quitRun() {
  if (!run) { closeOverlay(); return; }
  endRun(false);
}

// ---- 操作（画面を指でなぞるだけ。前後にも動ける。弾は自動で出る） ----

function wireControls() {
  const canvas = document.getElementById('shooter-canvas');
  const move = (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    touchX = (e.clientX - rect.left) * (canvas.width / rect.width);
    touchY = (e.clientY - rect.top) * (canvas.height / rect.height);
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
    if (e.key === 'ArrowUp') touchY = run.player.y - 40;
    if (e.key === 'ArrowDown') touchY = run.player.y + 40;
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
    if (run) draw(); // update() 内でランが終了(run=null)している場合は描画しない
  }
  rafId = requestAnimationFrame(loop);
}

function update(dt) {
  const canvas = document.getElementById('shooter-canvas');
  const cfg = view.config;
  const stage = run.stage;
  const s = run.stats;
  const now = run.elapsed;

  // 自機の移動：指の位置へ少しずつ寄る（左右だけでなく前後にも動ける）。
  const half = 12;
  const minY = PLAYER_TOP;
  const maxY = canvas.height - 8;
  const maxStep = s.playerSpeed * 2.2 * dt;
  const approach = (cur, target, limitLo, limitHi) => {
    const t = Math.max(limitLo, Math.min(limitHi, target));
    const diff = t - cur;
    return cur + (Math.abs(diff) <= maxStep ? diff : Math.sign(diff) * maxStep);
  };
  if (touchX !== null) {
    run.player.x = approach(run.player.x, touchX, half, canvas.width - half);
  }
  if (touchY !== null) {
    run.player.y = approach(run.player.y, touchY, minY, maxY);
  }
  run.player.x = Math.max(half, Math.min(canvas.width - half, run.player.x));
  run.player.y = Math.max(minY, Math.min(maxY, run.player.y));

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

  // 護衛機（買っていれば最大3体）。自機の周りを等間隔でくるくる回りながら、自動で弾を撃つ。
  if (s.escortLevel > 0) {
    const angleBase = now / 500;
    const radius = 28;
    run.escorts = [];
    for (let i = 0; i < s.escortLevel; i += 1) {
      const angle = angleBase + (i * (Math.PI * 2)) / 3; // 3体分の位置を120度ずつ固定で割り当てる
      const ex = run.player.x + Math.cos(angle) * radius;
      const ey = run.player.y + Math.sin(angle) * radius * 0.6;
      run.escorts.push({ x: ex, y: ey });
      if (now >= run.nextEscortFireAt[i]) {
        run.nextEscortFireAt[i] = now + 500;
        run.bullets.push({ x: ex - 2, y: ey - 8, w: 5, h: 8, power: 1 });
      }
    }
  } else {
    run.escorts = [];
  }

  // ザコの出現（ボス戦中は出さない）。種類はステージの enemyMix から抽選。
  if (run.phase === 'wave' && now >= run.nextSpawnAt) {
    run.nextSpawnAt = now + stage.spawnMs;
    const kind = pickEnemyType(stage);
    const type = cfg.enemyTypes[kind];
    const cellsInfo = shooterSpriteToCells(type.sprite);
    const w = cellsInfo.w * CELL;
    const h = cellsInfo.h * CELL;
    const x = Math.random() * (canvas.width - w);
    run.enemies.push({
      x, baseX: x, y: -h, w, h, kind,
      hp: type.hp,
      speed: stage.enemySpeed * type.speedMul,
      dropChance: type.dropChance,
      zigzagAmp: type.zigzagAmp || 0,
      zigzagPhase: Math.random() * Math.PI * 2,
      nextAimedFireAt: type.aimedFireMs ? now + type.aimedFireMs + Math.random() * 500 : null,
    });
  }

  // ザコの攻撃（下向き）。stage.enemyFireCount 体が同時に撃つ。
  const enemyBulletSpeed = stage.enemyBulletSpeed || cfg.enemyBulletSpeed;
  if (now >= run.nextEnemyFireAt && run.enemies.length > 0) {
    run.nextEnemyFireAt = now + stage.enemyFireMs;
    const shuffled = [...run.enemies].sort(() => Math.random() - 0.5);
    const shooters = shuffled.slice(0, Math.min(stage.enemyFireCount || 1, shuffled.length));
    for (const shooter of shooters) {
      run.ebullets.push({ x: shooter.x + shooter.w / 2 - 3, y: shooter.y + shooter.h, w: 7, h: 10, vx: 0, vy: enemyBulletSpeed });
    }
  }

  // 狙撃タイプは、決まった間隔で自機をねらって撃つ。
  for (const e of run.enemies) {
    if (e.nextAimedFireAt !== null && now >= e.nextAimedFireAt) {
      e.nextAimedFireAt = now + cfg.enemyTypes[e.kind].aimedFireMs;
      const fx = e.x + e.w / 2;
      const fy = e.y + e.h;
      const dx = run.player.x - fx;
      const dy = run.player.y - fy;
      const len = Math.max(1, Math.hypot(dx, dy));
      run.ebullets.push({
        x: fx - 4, y: fy, w: 8, h: 8,
        vx: (dx / len) * enemyBulletSpeed, vy: (dy / len) * enemyBulletSpeed,
      });
    }
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
        run.ebullets.push({ x: cx - 4, y: b.y + b.h, w: 8, h: 12, vx: spread, vy: enemyBulletSpeed * 1.1 });
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

  // ザコの移動（すばやいタイプは左右にも揺れる）と、画面下に抜けた判定。
  for (const e of run.enemies) {
    e.y += e.speed * dt;
    if (e.zigzagAmp) {
      const sway = Math.sin(now / 220 + e.zigzagPhase) * e.zigzagAmp;
      e.x = Math.max(0, Math.min(canvas.width - e.w, e.baseX + sway));
    }
  }
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
        e.hp -= (b.power ?? s.power);
        hit = true;
        if (e.hp <= 0) {
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
      run.boss.hp -= (b.power ?? s.power);
      hit = true;
      run.booms.push({ x: b.x, y: b.y, until: now + 160 });
    }
    if (hit) b.y = -999;
  }
  run.bullets = run.bullets.filter((b) => b.y > -100);
  run.enemies = run.enemies.filter((e) => e.hp > 0);

  // ボス撃破 → ステージクリア（1プレイはここで終わり）。
  if (run.boss && run.boss.hp <= 0) {
    const b = run.boss;
    run.boss = null;
    run.phase = 'clear';
    run.kills += 1;
    run.clearedIndex = Math.max(run.clearedIndex, run.stageIndex + 1);
    run.ebullets = [];
    run.enemies = [];
    run.booms.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, until: now + 1400 });
    run.bannerText = `第${run.stageIndex + 1}面 クリア！`;
    run.bannerUntil = now + 2000;
    run.endAt = now + 2000;
    document.getElementById('boss-bar').hidden = true;
  }

  // クリア演出のあと、このプレイを終了する。
  if (run.phase === 'clear' && now >= run.endAt && !run.over) {
    run.over = true;
    endRun(true);
    return;
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

      // 体当たりアイテムがあれば、ぶつかった敵から先にノーダメージで倒す。
      const rammed = crashed.slice(0, run.ramCharges);
      const unrammed = crashed.slice(run.ramCharges);
      run.ramCharges -= rammed.length;
      for (const e of rammed) {
        run.kills += 1;
        run.booms.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, until: now + 260 });
        if (shouldDropItem(e, cfg)) {
          const type = pickItemType(cfg);
          run.items.push({ x: e.x + e.w / 2 - 10, y: e.y, w: 20, h: 20, type });
        }
      }
      for (const e of unrammed) run.booms.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, until: now + 260 });

      if (hitBullets.length > 0 || unrammed.length > 0) {
        damagePlayer(1, cfg);
      }
    }
  }

  run.booms = run.booms.filter((b) => b.until > now);

  // 得点を計算し直す（進むほど増え、被弾すると減る）。
  run.score = computeScore(stage, currentProgress(cfg), run.damageCount, cfg);

  // HUD更新。
  document.getElementById('hud-score').textContent = run.score;
  document.getElementById('hud-power').textContent = `💥${run.stats.power}`;
  document.getElementById('hud-lives').textContent = '❤'.repeat(Math.max(0, run.lives));
  const hudRam = document.getElementById('hud-ram');
  hudRam.hidden = run.ramCharges <= 0;
  hudRam.textContent = `💢${run.ramCharges}`;

  if (run.lives <= 0 && !run.over) {
    run.over = true;
    endRun(false);
  }
}

// いまのステージの進み具合（0〜1）。
function currentProgress(cfg) {
  if (run.phase === 'boss') {
    const ratio = run.boss ? run.boss.hp / run.boss.maxHp : 0;
    return stageProgress({ phase: 'boss', bossHpRatio: ratio }, cfg);
  }
  const waveRatio = (run.elapsed - run.stageStartedAt) / run.stage.duration;
  return stageProgress({ phase: run.phase, waveRatio }, cfg);
}

// ライフを減らし、しばらく無敵にする。被弾は1回ぶんとして得点から減点される。
function damagePlayer(amount, cfg) {
  run.lives -= amount;
  run.damageCount += amount;
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

// ステージごとの背景の色味（空・奥の帯・手前の粒子2色）。
const BG_THEMES = {
  meadow: { sky: '#173423', far: '#2f5c3a', particle: '#7cc26b', particleAlt: '#c8e6a0' },
  clouds: { sky: '#1b3350', far: '#33547e', particle: '#ffffff', particleAlt: '#bcd4f2' },
  storm: { sky: '#1c1630', far: '#3a2b58', particle: '#f2c94c', particleAlt: '#8a6bd8' },
  volcano: { sky: '#2a1210', far: '#5c2318', particle: '#fb923c', particleAlt: '#e0483b' },
  space: { sky: '#05060f', far: '#151a33', particle: '#ffffff', particleAlt: '#7ec8e3' },
};

function drawBackground(ctx, canvas, now, theme) {
  const t = BG_THEMES[theme] || BG_THEMES.space;
  ctx.fillStyle = t.sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // 奥の帯（地平線・雲の層・岩盤など、テーマごとの簡単な奥行き演出）。
  ctx.fillStyle = t.far;
  for (let i = 0; i < 6; i += 1) {
    const y = ((i * 90) + (now / 20)) % (canvas.height + 60) - 60;
    ctx.fillRect(0, y, canvas.width, 18);
  }
  ctx.fillStyle = t.particle;
  for (let i = 0; i < 24; i += 1) {
    const x = (i * 83) % canvas.width;
    const y = ((i * 61) + (now / 10)) % canvas.height;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.fillStyle = t.particleAlt;
  for (let i = 0; i < 14; i += 1) {
    const x = (i * 131 + 40) % canvas.width;
    const y = ((i * 97) + (now / 16)) % canvas.height;
    ctx.fillRect(x, y, 2, 2);
  }
}

function draw() {
  const canvas = document.getElementById('shooter-canvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  drawBackground(ctx, canvas, run.elapsed, run.stage.bgTheme);

  // 自機の弾
  ctx.fillStyle = '#f5e08a';
  for (const b of run.bullets) ctx.fillRect(b.x, b.y, b.w, b.h);

  // 敵の弾
  for (const eb of run.ebullets) {
    drawCells(ctx, shooterSpriteToCells('enemyBullet'), eb.x + eb.w / 2, eb.y + eb.h, 3);
  }

  for (const e of run.enemies) {
    const sprite = view.config.enemyTypes[e.kind]?.sprite || 'enemyNormal';
    drawCells(ctx, shooterSpriteToCells(sprite), e.x + e.w / 2, e.y + e.h);
  }

  if (run.boss) {
    const bossSprite = run.stage.boss.sprite || 'bossMeadow';
    drawCells(ctx, shooterSpriteToCells(bossSprite), run.boss.x + run.boss.w / 2, run.boss.y + run.boss.h, 6);
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

  // 護衛機。
  for (const escort of run.escorts) {
    drawCells(ctx, shooterSpriteToCells('escort'), escort.x, escort.y, 2);
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
