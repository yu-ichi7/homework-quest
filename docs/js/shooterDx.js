import { getShooterDxView, startDxRun, finishDxRun, buyDxUpgrade } from './store.js';
import {
  stageAt, hits, shouldDropItem, pickItemType, applyItem, pickEnemyType,
  stageProgress, computeScore,
} from './lib/shooter.js';
import {
  nextWeapon, weaponShots, weaponFireInterval, isAngledShot, WEAPON_LABEL,
} from './lib/shooterDx.js';
import {
  drawBackground, drawPlayer, drawEscort, drawEnemy, drawChargeWarning,
  drawMidboss, drawBoss, drawPlayerBullet, drawEnemyBullet, drawHazard,
  drawItem, drawBoom, drawFlash, drawEffects, drawBanner, drawPickupText,
} from './shooterArt.js';

const PLAYER_BOTTOM = 30; // 自機の下端からの位置（開始位置）
const PLAYER_TOP = 130;   // 自機がここより前（上）には行けない（ボスと重ならない高さ）
const BOSS_W = 84;
const BOSS_H = 60;
const MIDBOSS_W = 56;
const MIDBOSS_H = 40;
const ITEM_SIZE = 22;
const TAU = Math.PI * 2;
// 画面の解像度倍率。ゲームの座標は 320x460 のまま、スマホでもくっきり描けるよう内部は2倍で描く。
const SCALE = 2;

const WEAPON_ICON = { normal: '・', spread: '🔴', laser: '🔵', homing: '🟢' };

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
  document.getElementById('dx-start-btn').onclick = handleStart;
  document.getElementById('dx-quit').onclick = () => quitRun();
  document.getElementById('modal-ok').onclick = () => { document.getElementById('modal').hidden = true; };
  document.getElementById('dx-ram-minus').onclick = () => { selectedRam = Math.max(0, selectedRam - 1); renderRamPicker(); };
  document.getElementById('dx-ram-plus').onclick = () => { selectedRam = Math.min(view.ramMax, selectedRam + 1); renderRamPicker(); };
  wireControls();
  document.addEventListener('game-tab-changed', (e) => {
    if (e.detail.tab === 'shooterdx') { if (run) startLoop(); else render(); } else { stopLoop(); touchX = null; touchY = null; }
  });
  render();
}

// ---- 画面（プレイ外） ----

function render() {
  view = getShooterDxView();
  document.getElementById('dx-coin').textContent = view.balance;
  document.getElementById('dx-highscore').textContent = view.highScore;
  document.getElementById('dx-kills').textContent = view.totalKills;
  document.getElementById('dx-plays').textContent = view.plays;
  if (view.stages[selectedStage]?.locked) selectedStage = view.cleared;
  selectedRam = Math.max(0, Math.min(view.ramMax, selectedRam));
  renderStages();
  renderUpgrades();
  renderRamPicker();
}

function renderRamPicker() {
  document.getElementById('dx-ram-count').textContent = selectedRam;
  document.getElementById('dx-ram-max').textContent = view.ramMax;
  document.getElementById('dx-ram-cost').textContent = view.ramCost;
  document.getElementById('dx-ram-minus').disabled = selectedRam <= 0;
  document.getElementById('dx-ram-plus').disabled = selectedRam >= view.ramMax;
  document.getElementById('dx-total-cost').textContent = view.playCost + selectedRam * view.ramCost;
}

function renderStages() {
  const el = document.getElementById('dx-stage-list');
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
  const el = document.getElementById('dx-upgrade-list');
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
      const res = buyDxUpgrade(u.kind);
      document.getElementById('dx-msg').textContent = res.ok
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
  document.getElementById('dx-overlay').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeOverlay() {
  document.getElementById('dx-overlay').hidden = true;
  document.body.style.overflow = '';
}

// ---- 出撃 ----

function handleStart() {
  if (run) return;
  const res = startDxRun(selectedStage, selectedRam);
  const msg = document.getElementById('dx-msg');
  if (!res.ok) {
    msg.textContent = res.reason === 'not-enough' ? `🪙が足りません（${res.cost}コイン必要）`
      : res.reason === 'locked' ? 'このステージはまだ開いていません' : '';
    return;
  }
  msg.textContent = '';
  const canvas = document.getElementById('dx-canvas');
  run = {
    stats: res.stats,
    lives: res.stats.lives,
    score: 0,
    kills: 0,
    damageCount: 0,           // 被弾した回数（0ならノーミス）
    clearedIndex: 0,
    elapsed: 0,               // ループが動いている間だけ進む時間（ms）
    player: { x: canvas.width / SCALE / 2, y: canvas.height / SCALE - PLAYER_BOTTOM },
    weapon: { kind: 'normal', level: 1 },
    ramCharges: res.ramCount, // 体当たりアイテムの残数
    shield: 0,                // シールド（1回だけ被弾を防ぐ）
    starUntil: 0,             // 無敵スターの終わる時刻
    slowUntil: 0,             // スローの終わる時刻
    magnetUntil: 0,           // マグネットの終わる時刻
    flashUntil: 0,            // ボムの閃光
    escorts: [],
    nextEscortFireAt: [0, 0, 0],
    bullets: [],
    enemies: [],
    spawnQueue: [],           // 分裂などで、判定の途中に生まれた敵
    ebullets: [],
    hazards: [],              // 予告つきの攻撃（雷の柱・火柱）
    items: [],
    booms: [],
    groups: {},               // 編隊（全滅でアイテム確定）
    nextId: 1,
    midboss: null,
    midbossDone: false,
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

function startStage(index) {
  const stage = stageAt(index, view.config);
  run.stageIndex = index;
  run.stage = stage;
  run.phase = 'wave';
  run.stageStartedAt = run.elapsed;
  run.nextSpawnAt = run.elapsed + 400;
  run.nextFireAt = run.elapsed;
  run.nextEnemyFireAt = run.elapsed + stage.enemyFireMs;
  setBanner(`第${index + 1}面　${stage.name}`, 1800);
  document.getElementById('dx-hud-stage').textContent = `第${index + 1}面 ${stage.name}`;
  document.getElementById('dx-boss-bar').hidden = true;
}

function endRun(stageCleared = false) {
  const { score, kills, clearedIndex, stageIndex, damageCount } = run;
  const isLast = stageIndex + 1 >= view.config.stages.length;
  const noMiss = stageCleared && damageCount === 0;
  const res = finishDxRun({ score, kills, clearedIndex });
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

function quitRun() {
  if (!run) { closeOverlay(); return; }
  endRun(false);
}

// ---- 操作（画面を指でなぞるだけ。前後にも動ける。弾は自動で出る） ----

function wireControls() {
  const canvas = document.getElementById('dx-canvas');
  const move = (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    touchX = (e.clientX - rect.left) * (canvas.width / SCALE / rect.width);
    touchY = (e.clientY - rect.top) * (canvas.height / SCALE / rect.height);
  };
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    move(e);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.buttons === 0 && e.pointerType === 'mouse') return;
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

// ---- 小さな道具 ----

function canvasSize() {
  const c = document.getElementById('dx-canvas');
  return { W: c.width / SCALE, H: c.height / SCALE };
}

function setBanner(text, ms) {
  run.bannerText = text;
  run.bannerUntil = run.elapsed + ms;
}

function setPickup(text) {
  run.pickupText = text;
  run.pickupUntil = run.elapsed + 1300;
}

function boom(x, y, size, color) {
  const now = run.elapsed;
  run.booms.push({ x, y, size, color, start: now, until: now + (size > 40 ? 750 : 320), seed: Math.random() * 6 });
}

// 敵の弾を撃つ。(x, y) は弾の中心。
function shoot(x, y, vx, vy, size = 8, style = 'normal') {
  run.ebullets.push({ x: x - size / 2, y: y - size / 2, w: size, h: size, vx, vy, style });
}

// (x, y) から自機へ向かう速度。offset は向きをずらす角度(rad)。
function aim(x, y, speed, offset = 0) {
  const a = Math.atan2(run.player.y - 12 - y, run.player.x - x) + offset;
  return [Math.cos(a) * speed, Math.sin(a) * speed];
}

function slowFactor() {
  return run.elapsed < run.slowUntil ? 0.5 : 1;
}

// ---- 敵を出す・倒す ----

function spawnEnemy(kind, x, y, extra = {}) {
  const cfg = view.config;
  const type = cfg.enemyTypes[kind];
  const e = {
    id: run.nextId++,
    kind,
    x, y, w: type.w, h: type.h,
    baseX: x,
    hp: type.hp,
    speed: run.stage.enemySpeed * type.speedMul,
    dropChance: type.dropChance,
    move: type.move || 'fall',
    zigzagAmp: type.zigzagAmp || 0,
    zigzagPhase: Math.random() * TAU,
    nextAimedFireAt: type.aimedFireMs ? run.elapsed + type.aimedFireMs + Math.random() * 500 : null,
    shieldHp: type.shieldHp || 0,
    shieldMax: type.shieldHp || 0,
    spawnAt: run.elapsed,
    hitUntil: 0,
    ...extra,
  };
  if (e.move === 'charge') {
    e.state = 'enter';
    e.targetY = 70 + Math.random() * 90;
  }
  return e;
}

function spawnWave() {
  const { W } = canvasSize();
  const cfg = view.config;
  const kind = pickEnemyType(run.stage);
  const type = cfg.enemyTypes[kind];
  if (kind === 'formation') {
    // 5機が一列に並んで蛇行してくる。
    const gid = run.nextId++;
    const n = type.groupSize || 5;
    const baseX = 60 + Math.random() * (W - 120 - type.w);
    const phase = Math.random() * TAU;
    run.groups[gid] = { total: n, killed: 0, failed: false };
    for (let i = 0; i < n; i += 1) {
      run.enemies.push(spawnEnemy(kind, baseX, -type.h - i * 28, { groupId: gid, phase: phase - i * 0.55 }));
    }
    return;
  }
  const x = Math.random() * (W - type.w);
  run.enemies.push(spawnEnemy(kind, x, -type.h));
}

function dropItem(x, y, type = null) {
  const t = type || pickItemType(view.config);
  run.items.push({ x: x - ITEM_SIZE / 2, y: y - ITEM_SIZE / 2, w: ITEM_SIZE, h: ITEM_SIZE, type: t });
}

function randomWeaponItem() {
  const weapons = view.config.items.types.filter((t) => t.weapon);
  return weapons[Math.floor(Math.random() * weapons.length)];
}

// 敵を倒す。cause: 'shot'（弾）/ 'crash'（体当たり・スター）/ 'bomb'。
function killEnemy(e, cause) {
  if (e.dead) return;
  e.dead = true;
  e.hp = 0;
  run.kills += 1;
  const cx = e.x + e.w / 2;
  const cy = e.y + e.h / 2;
  boom(cx, cy, Math.max(e.w, e.h) * 0.9, '#fbbf24');

  const type = view.config.enemyTypes[e.kind];
  if (type.splitInto) {
    for (const dir of [-1, 1]) {
      const child = view.config.enemyTypes[type.splitInto];
      run.spawnQueue.push(spawnEnemy(type.splitInto, cx - child.w / 2, cy - child.h / 2, { vx: dir * 70 }));
    }
  }
  if (type.burst && cause !== 'bomb') {
    const sp = (run.stage.enemyBulletSpeed || view.config.enemyBulletSpeed) * 0.55;
    for (let i = 0; i < type.burst; i += 1) {
      const a = (i / type.burst) * TAU;
      shoot(cx, cy, Math.cos(a) * sp, Math.sin(a) * sp, 8, 'spark');
    }
  }

  if (e.groupId) {
    const g = run.groups[e.groupId];
    g.killed += 1;
    if (g.killed >= g.total && !g.failed) {
      dropItem(cx, cy);
      setPickup('編隊を全滅！ アイテムゲット');
    }
  } else if (shouldDropItem(e, view.config)) {
    dropItem(cx, cy);
  }
}

// ---- 自機がやられる ----

function damagePlayer(amount) {
  run.lives -= amount;
  run.damageCount += amount;
  run.invincibleUntil = run.elapsed + view.config.invincibleMs;
}

// 弾・体当たり・予告攻撃に当たったとき。シールドがあれば1回だけ防ぐ（ノーミスのまま）。
function takeHit() {
  if (run.shield > 0) {
    run.shield = 0;
    run.invincibleUntil = run.elapsed + 800;
    boom(run.player.x, run.player.y - 13, 34, '#38bdf8');
    setPickup('シールドで防いだ！');
    return;
  }
  damagePlayer(1);
}

// ---- アイテム ----

function collectItem(type) {
  const cfg = view.config;
  const now = run.elapsed;
  if (type.weapon) {
    run.weapon = nextWeapon(run.weapon, type.weapon, cfg.items.weaponMaxLevel);
    setPickup(`${type.name} Lv${run.weapon.level}`);
    return;
  }
  switch (type.effect) {
    case 'shield':
      run.shield = 1;
      break;
    case 'bomb':
      detonateBomb();
      break;
    case 'magnet':
    case 'slow':
    case 'star':
      run[`${type.effect}Until`] = now + type.durationMs;
      break;
    default: {
      const applied = applyItem(run.stats, run.lives, type, cfg);
      run.stats = applied.stats;
      run.lives = applied.lives;
    }
  }
  setPickup(type.name);
}

// ボム：画面のザコと敵の弾・予告攻撃を一掃し、ボスと中ボスにもダメージ。
function detonateBomb() {
  const cfg = view.config;
  for (const e of run.enemies) killEnemy(e, 'bomb');
  run.ebullets = [];
  run.hazards = [];
  for (const target of [run.midboss, run.boss]) {
    if (!target) continue;
    target.hp -= Math.max(1, Math.round(target.maxHp * cfg.items.bombBossDamageRatio));
    target.hitUntil = run.elapsed + 120;
  }
  run.flashUntil = run.elapsed + 260;
}

// ---- 自機の攻撃 ----

function fireWeapon(now) {
  const s = run.stats;
  if (now < run.nextFireAt) return;
  run.nextFireAt = now + weaponFireInterval(run.weapon, s);
  for (const shot of weaponShots(run.weapon, s)) {
    run.bullets.push({
      x: run.player.x + shot.dx - shot.w / 2,
      y: run.player.y - 28 - shot.h / 2,
      w: shot.w, h: shot.h, vx: shot.vx, vy: shot.vy,
      power: shot.power, pierce: shot.pierce, homing: shot.homing,
      spread: run.weapon.kind === 'spread',
      hitIds: shot.pierce ? new Set() : null,
    });
  }
}

function updateEscorts(now) {
  const s = run.stats;
  run.escorts = [];
  for (let i = 0; i < s.escortLevel; i += 1) {
    const angle = now / 500 + (i * TAU) / 3; // 3体分の位置を120度ずつ固定で割り当てる
    const ex = run.player.x + Math.cos(angle) * 28;
    const ey = run.player.y - 13 + Math.sin(angle) * 17;
    run.escorts.push({ x: ex, y: ey });
    if (now >= run.nextEscortFireAt[i]) {
      run.nextEscortFireAt[i] = now + 500;
      run.bullets.push({ x: ex - 2, y: ey - 8, w: 5, h: 8, vx: 0, vy: -s.bulletSpeed, power: 1, escort: true });
    }
  }
}

// ホーミング弾がねらう、いちばん近い相手。
function nearestTarget(x, y) {
  let best = null;
  let bestD = Infinity;
  const consider = (t) => {
    if (!t || t.hp <= 0 || t.dead) return;
    const d = Math.hypot(t.x + t.w / 2 - x, t.y + t.h / 2 - y);
    if (d < bestD) { bestD = d; best = t; }
  };
  run.enemies.forEach(consider);
  consider(run.midboss);
  consider(run.boss);
  return best;
}

function updateBullets(dt) {
  const { W, H } = canvasSize();
  for (const b of run.bullets) {
    if (b.homing) {
      const t = nearestTarget(b.x + b.w / 2, b.y + b.h / 2);
      if (t) {
        const speed = Math.hypot(b.vx, b.vy);
        const cur = Math.atan2(b.vy, b.vx);
        const want = Math.atan2(t.y + t.h / 2 - (b.y + b.h / 2), t.x + t.w / 2 - (b.x + b.w / 2));
        let diff = want - cur;
        while (diff > Math.PI) diff -= TAU;
        while (diff < -Math.PI) diff += TAU;
        const turn = Math.max(-6 * dt, Math.min(6 * dt, diff));
        b.vx = Math.cos(cur + turn) * speed;
        b.vy = Math.sin(cur + turn) * speed;
      }
    }
    b.prevX = b.x;
    b.prevY = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
  run.bullets = run.bullets.filter((b) => b.y + b.h > -10 && b.y < H && b.x > -20 && b.x < W + 20);
}

// 自機の弾が、ザコ・中ボス・ボスに当たったか。
// 速い弾が敵をすり抜けないよう、前のフレームからの移動範囲まで含めて判定する。
function resolveShots(now) {
  for (const b of run.bullets) {
    const px = b.prevX ?? b.x;
    const py = b.prevY ?? b.y;
    const sweep = {
      x: Math.min(px, b.x), y: Math.min(py, b.y),
      w: Math.abs(b.x - px) + b.w, h: Math.abs(b.y - py) + b.h,
    };
    for (const e of run.enemies) {
      if (e.dead || !hits(sweep, e)) continue;
      if (b.pierce && b.hitIds.has(e.id)) continue;
      // 盾持ち：まっすぐの弾は盾ではじかれる（盾がけずれる）。
      if (e.shieldHp > 0 && !isAngledShot(b)) {
        e.shieldHp -= 1;
        boom(b.x + b.w / 2, e.y + e.h, 10, '#38bdf8');
        b.dead = true;
        break;
      }
      e.hp -= b.power;
      e.hitUntil = now + 60;
      if (e.hp <= 0) killEnemy(e, 'shot');
      if (b.pierce) { b.hitIds.add(e.id); continue; }
      b.dead = true;
      break;
    }
    if (b.dead) continue;
    for (const [tag, target] of [['midboss', run.midboss], ['boss', run.boss]]) {
      if (!target || target.hp <= 0 || !hits(sweep, target)) continue;
      if (b.pierce && b.hitIds.has(tag)) continue;
      target.hp -= b.power;
      target.hitUntil = now + 60;
      boom(b.x + b.w / 2, b.y, 10, '#fde68a');
      if (b.pierce) b.hitIds.add(tag);
      else { b.dead = true; break; }
    }
  }
  run.bullets = run.bullets.filter((b) => !b.dead);
}

// ---- ザコ敵 ----

function updateEnemies(dt, now) {
  const { W, H } = canvasSize();
  const cfg = view.config;
  const sf = slowFactor();

  for (const e of run.enemies) {
    const type = cfg.enemyTypes[e.kind];
    if (e.move === 'charge') {
      if (e.state === 'enter') {
        e.y += e.speed * dt * sf;
        if (e.y >= e.targetY) {
          // 止まって狙いを決める。予告線の向きのまま突っ込むので、見てから逃げられる。
          e.state = 'aim';
          e.aimUntil = now + type.aimMs;
          [e.vx, e.vy] = aim(e.x + e.w / 2, e.y + e.h / 2, type.dashSpeed);
        }
      } else if (e.state === 'aim') {
        if (now >= e.aimUntil) e.state = 'dash';
      } else {
        e.x += e.vx * dt * sf;
        e.y += e.vy * dt * sf;
      }
    } else if (e.move === 'formation') {
      e.y += e.speed * dt * sf;
      e.x = e.baseX + Math.sin((now - e.spawnAt) / 450 + e.phase) * 60;
    } else {
      e.y += e.speed * dt * sf;
      if (e.vx) e.x += e.vx * dt * sf;
      if (e.zigzagAmp) {
        const sway = Math.sin(now / 220 + e.zigzagPhase) * e.zigzagAmp;
        e.x = Math.max(0, Math.min(W - e.w, e.baseX + sway));
      }
      if (e.kind === 'mine') e.x = e.baseX + Math.sin(now / 800 + e.zigzagPhase) * 18;
    }
  }

  // 画面の外へ出た敵。下へ抜けた「通り過ぎない敵」はダメージになる。
  // 上へ抜けるのは突撃が上向きに飛んだときだけ（編隊は画面の上に並んで待っているため）。
  let escaped = 0;
  for (const e of run.enemies) {
    const out = e.y > H + 10 || e.x + e.w < -40 || e.x > W + 40
      || (e.state === 'dash' && e.y + e.h < -20);
    if (!out || e.dead) continue;
    e.dead = true;
    if (e.groupId) run.groups[e.groupId].failed = true;
    if (e.y > H && !cfg.enemyTypes[e.kind].noEscapeDamage) escaped += 1;
  }
  if (escaped > 0) damagePlayer(escaped);

  // ザコの攻撃：まとめて何体かが下へ撃つ（機雷は撃たない）。
  const ebs = run.stage.enemyBulletSpeed || cfg.enemyBulletSpeed;
  const shooters = run.enemies.filter((e) => !e.dead && e.kind !== 'mine' && e.y > 0);
  if (now >= run.nextEnemyFireAt && shooters.length > 0) {
    run.nextEnemyFireAt = now + run.stage.enemyFireMs;
    const picked = shooters.sort(() => Math.random() - 0.5).slice(0, run.stage.enemyFireCount || 1);
    for (const e of picked) shoot(e.x + e.w / 2, e.y + e.h, 0, ebs, 8, 'normal');
  }
  // 狙撃タイプは、決まった間隔で自機をねらう。
  for (const e of run.enemies) {
    if (e.dead || e.nextAimedFireAt === null || now < e.nextAimedFireAt) continue;
    e.nextAimedFireAt = now + cfg.enemyTypes[e.kind].aimedFireMs;
    const [vx, vy] = aim(e.x + e.w / 2, e.y + e.h, ebs);
    shoot(e.x + e.w / 2, e.y + e.h, vx, vy, 8, 'aimed');
  }
}

// ---- 中ボス ----

function updateMidboss(dt, now) {
  const { W } = canvasSize();
  const cfg = view.config;
  const stage = run.stage;

  if (!run.midbossDone && run.phase === 'wave'
      && now - run.stageStartedAt >= stage.duration * cfg.midbossAt) {
    run.midbossDone = true;
    run.midboss = {
      x: W / 2 - MIDBOSS_W / 2, y: -MIDBOSS_H - 4, w: MIDBOSS_W, h: MIDBOSS_H,
      hp: stage.midboss.hp, maxHp: stage.midboss.hp,
      dir: 1, fireAt: now + 1400, leaveAt: now + cfg.midbossStayMs, hitUntil: 0,
    };
    setBanner(`⚠ 中ボス ${stage.midboss.name}`, 1400);
  }
  const m = run.midboss;
  if (!m) return;
  const sf = slowFactor();

  if (m.hp <= 0) {
    // 倒すと武器アイテムが確定で出る。
    run.kills += 1;
    boom(m.x + m.w / 2, m.y + m.h / 2, 60, '#fb923c');
    dropItem(m.x + m.w / 2 - 14, m.y + m.h / 2, randomWeaponItem());
    dropItem(m.x + m.w / 2 + 14, m.y + m.h / 2);
    setPickup('中ボスをやっつけた！');
    run.midboss = null;
    return;
  }

  if (now >= m.leaveAt) {
    m.y -= 80 * dt * sf; // 時間切れ：上へ帰っていく
    if (m.y + m.h < 0) run.midboss = null;
    return;
  }
  if (m.y < 46) m.y += 60 * dt * sf;
  m.x += 70 * m.dir * dt * sf;
  if (m.x <= 0) { m.x = 0; m.dir = 1; }
  if (m.x + m.w >= W) { m.x = W - m.w; m.dir = -1; }
  if (now >= m.fireAt && m.y >= 20) {
    m.fireAt = now + 1400;
    const ebs = stage.enemyBulletSpeed || cfg.enemyBulletSpeed;
    for (const off of [-0.25, 0, 0.25]) {
      const [vx, vy] = aim(m.x + m.w / 2, m.y + m.h, ebs, off);
      shoot(m.x + m.w / 2, m.y + m.h, vx, vy, 9, 'aimed');
    }
  }
}

// ---- ボス ----

function addHazard(kind, x, y, w, h, warnMs, activeMs) {
  const now = run.elapsed;
  run.hazards.push({ kind, x, y, w, h, warnUntil: now + warnMs, activeUntil: now + warnMs + activeMs });
}

// ボスごとの動きと攻撃。b.rage（HPが半分を切った）で激しくなる。
const BOSS_PATTERNS = {
  // 緑の守護者：大きな葉っぱ弾をゆっくり扇状にばらまく（入門）。
  leaves: {
    move(b, dt, sf, W) { bounce(b, run.stage.boss.speed * dt * sf, W); },
    attack(b, now, ebs, fireMs) {
      if (now < b.fireAt) return;
      b.fireAt = now + fireMs;
      const ways = run.stage.boss.ways + (b.rage ? 2 : 0);
      for (let i = 0; i < ways; i += 1) {
        const a = Math.PI / 2 + (i - (ways - 1) / 2) * (1.4 / (ways - 1));
        shoot(b.x + b.w / 2, b.y + b.h, Math.cos(a) * ebs * 0.7, Math.sin(a) * ebs * 0.7, 14, 'leaf');
      }
      if (b.rage) {
        const [vx, vy] = aim(b.x + b.w / 2, b.y + b.h, ebs);
        shoot(b.x + b.w / 2, b.y + b.h, vx, vy, 9, 'aimed');
      }
    },
  },
  // 雲の主：扇状の弾＋予告線のあとに縦の雷。
  thunder: {
    move(b, dt, sf, W) { bounce(b, run.stage.boss.speed * dt * sf, W); },
    attack(b, now, ebs, fireMs) {
      const { W, H } = canvasSize();
      if (now >= b.fireAt) {
        b.fireAt = now + fireMs;
        const ways = run.stage.boss.ways;
        for (let i = 0; i < ways; i += 1) {
          const a = Math.PI / 2 + (i - (ways - 1) / 2) * 0.3;
          shoot(b.x + b.w / 2, b.y + b.h, Math.cos(a) * ebs, Math.sin(a) * ebs, 9, 'normal');
        }
      }
      if (now >= b.subAt) {
        b.subAt = now + (b.rage ? 1800 : 2600);
        const top = b.y + b.h;
        const xs = [run.player.x];
        if (b.rage) xs.push(20 + Math.random() * (W - 40));
        for (const x of xs) addHazard('thunder', x - 13, top, 26, H - top, 800, 350);
      }
    },
  },
  // 雷竜：ジグザグに動きながら、自機ねらいの連射。
  zigzag: {
    move(b, dt, sf, W, now) {
      bounce(b, run.stage.boss.speed * 1.4 * dt * sf, W);
      b.y = b.baseY + Math.sin(now / 260) * 16;
    },
    attack(b, now, ebs, fireMs) {
      if (now < b.fireAt) return;
      b.fireAt = now + fireMs;
      const n = run.stage.boss.ways + (b.rage ? 2 : 0);
      for (let i = 0; i < n; i += 1) {
        const [vx, vy] = aim(b.x + b.w / 2, b.y + b.h, ebs * 1.05, (i - (n - 1) / 2) * 0.12);
        shoot(b.x + b.w / 2, b.y + b.h, vx, vy, 9, 'spark');
      }
    },
  },
  // 溶岩帝王：上から岩が降り、下から火柱（予告あり）。
  lava: {
    move(b, dt, sf, W) { bounce(b, run.stage.boss.speed * dt * sf, W); },
    attack(b, now, ebs, fireMs) {
      const { W, H } = canvasSize();
      if (now >= b.fireAt) {
        b.fireAt = now + fireMs;
        const n = run.stage.boss.ways + (b.rage ? 1 : 0);
        for (let i = 0; i < n; i += 1) {
          shoot(16 + Math.random() * (W - 32), -10, (Math.random() - 0.5) * 40, ebs * 0.8, 16, 'rock');
        }
      }
      if (now >= b.subAt) {
        b.subAt = now + (b.rage ? 1700 : 2400);
        addHazard('lava', run.player.x - 15, H * 0.35, 30, H * 0.65, 900, 500);
      }
    },
  },
  // 要塞中枢：回転する渦巻き弾幕＋ときどき自機ねらい。
  spiral: {
    move(b, dt, sf, W, now) {
      b.x = W / 2 - b.w / 2 + Math.sin(now / 900) * 40;
    },
    attack(b, now, ebs, fireMs) {
      if (now >= b.subAt) {
        b.subAt = now + (b.rage ? 110 : 140);
        const arms = b.rage ? 3 : run.stage.boss.ways;
        for (let i = 0; i < arms; i += 1) {
          const a = b.angle + (i * TAU) / arms;
          shoot(b.x + b.w / 2, b.y + b.h / 2, Math.cos(a) * ebs * 0.55, Math.sin(a) * ebs * 0.55, 8, 'spiral');
        }
        b.angle += 0.32;
      }
      if (now >= b.fireAt) {
        b.fireAt = now + fireMs;
        const [vx, vy] = aim(b.x + b.w / 2, b.y + b.h, ebs);
        shoot(b.x + b.w / 2, b.y + b.h, vx, vy, 10, 'aimed');
      }
    },
  },
};

function bounce(b, step, W) {
  b.x += step * b.dir;
  if (b.x <= 0) { b.x = 0; b.dir = 1; }
  if (b.x + b.w >= W) { b.x = W - b.w; b.dir = -1; }
}

function updateBoss(dt, now) {
  const { W } = canvasSize();
  const cfg = view.config;
  const stage = run.stage;

  if (run.phase === 'wave' && now - run.stageStartedAt >= stage.duration) {
    run.phase = 'boss';
    run.boss = {
      x: W / 2 - BOSS_W / 2, y: -BOSS_H, w: BOSS_W, h: BOSS_H, baseY: 26,
      hp: stage.boss.hp, maxHp: stage.boss.hp,
      dir: 1, fireAt: now + 1200, subAt: now + 2200, angle: 0,
      rage: false, hitUntil: 0,
    };
    setBanner(`⚠ ${stage.boss.name} 出現！`, 1600);
    document.getElementById('dx-boss-bar').hidden = false;
    document.getElementById('dx-boss-name').textContent = stage.boss.name;
  }
  const b = run.boss;
  if (!b) return;

  // 登場中は上から降りてくるだけ（上下にゆれるボスがいるので、位置ではなく旗で判定する）。
  if (!b.entered) {
    b.y += 50 * dt;
    if (b.y >= b.baseY) { b.y = b.baseY; b.entered = true; }
  } else {
    if (!b.rage && b.hp <= b.maxHp / 2) {
      b.rage = true;
      setBanner(`${stage.boss.name} が怒った！`, 1200);
    }
    const pattern = BOSS_PATTERNS[stage.boss.pattern] || BOSS_PATTERNS.leaves;
    pattern.move(b, dt, slowFactor(), W, now);
    // 弾の速さにはスローを掛けない（弾の移動のほうで遅くしているので二重になる）。
    const ebs = stage.enemyBulletSpeed || cfg.enemyBulletSpeed;
    pattern.attack(b, now, ebs, stage.boss.fireMs * (b.rage ? 0.7 : 1));
  }
  document.getElementById('dx-boss-hp-fill').style.width = `${Math.max(0, (b.hp / b.maxHp) * 100)}%`;
}

// ---- 1フレームの更新 ----

function update(dt) {
  const { W, H } = canvasSize();
  const cfg = view.config;
  const stage = run.stage;
  const s = run.stats;
  const now = run.elapsed;
  const sf = slowFactor();

  // 自機の移動：指の位置へ少しずつ寄る（左右だけでなく前後にも動ける）。
  const half = 12;
  const maxStep = s.playerSpeed * 2.2 * dt;
  const approach = (cur, target, lo, hi) => {
    const t = Math.max(lo, Math.min(hi, target));
    const diff = t - cur;
    return cur + (Math.abs(diff) <= maxStep ? diff : Math.sign(diff) * maxStep);
  };
  if (touchX !== null) run.player.x = approach(run.player.x, touchX, half, W - half);
  if (touchY !== null) run.player.y = approach(run.player.y, touchY, PLAYER_TOP, H - 8);
  run.player.x = Math.max(half, Math.min(W - half, run.player.x));
  run.player.y = Math.max(PLAYER_TOP, Math.min(H - 8, run.player.y));

  fireWeapon(now);
  updateEscorts(now);
  updateBullets(dt);

  // ザコの出現（ボス戦中は出さない）。
  if (run.phase === 'wave' && now >= run.nextSpawnAt) {
    run.nextSpawnAt = now + stage.spawnMs;
    spawnWave();
  }

  updateEnemies(dt, now);
  updateMidboss(dt, now);
  updateBoss(dt, now);

  // 敵の弾の移動。
  for (const eb of run.ebullets) {
    eb.x += eb.vx * dt * sf;
    eb.y += eb.vy * dt * sf;
  }
  run.ebullets = run.ebullets.filter((eb) => eb.y < H && eb.y + eb.h > -30 && eb.x > -30 && eb.x < W + 30);
  run.hazards = run.hazards.filter((hz) => now < hz.activeUntil);

  resolveShots(now);

  // ボス撃破 → ステージクリア（1プレイはここで終わり）。
  if (run.boss && run.boss.hp <= 0 && run.phase === 'boss') {
    const b = run.boss;
    run.boss = null;
    run.midboss = null;
    run.phase = 'clear';
    run.kills += 1;
    run.clearedIndex = Math.max(run.clearedIndex, run.stageIndex + 1);
    run.ebullets = [];
    run.hazards = [];
    for (const e of run.enemies) { e.dead = true; }
    boom(b.x + b.w / 2, b.y + b.h / 2, 110, '#fb923c');
    boom(b.x + 10, b.y + 12, 50, '#fde047');
    boom(b.x + b.w - 10, b.y + b.h - 8, 50, '#f87171');
    setBanner(`第${run.stageIndex + 1}面 クリア！`, 2000);
    run.endAt = now + 2000;
    document.getElementById('dx-boss-bar').hidden = true;
  }
  if (run.phase === 'clear' && now >= run.endAt && !run.over) {
    run.over = true;
    endRun(true);
    return;
  }

  // アイテムの落下（マグネット中は自機へ吸い寄せられる）と取得。
  const magnet = now < run.magnetUntil;
  for (const it of run.items) {
    if (magnet) {
      const dx = run.player.x - (it.x + it.w / 2);
      const dy = run.player.y - 13 - (it.y + it.h / 2);
      const d = Math.max(1, Math.hypot(dx, dy));
      it.x += (dx / d) * 280 * dt;
      it.y += (dy / d) * 280 * dt;
    } else {
      it.y += cfg.items.fallSpeed * dt;
    }
  }
  const pbox = { x: run.player.x - half, y: run.player.y - 22, w: half * 2, h: 22 };
  const grabbed = run.items.filter((it) => hits(pbox, it));
  for (const it of grabbed) collectItem(it.type);
  run.items = run.items.filter((it) => !grabbed.includes(it) && it.y < H);

  // 自機の当たり判定。
  const star = now < run.starUntil;
  const guarded = now < run.invincibleUntil;
  const crashed = run.enemies.filter((e) => !e.dead && hits(pbox, e));
  let hit = false;
  if (crashed.length > 0) {
    if (star) {
      for (const e of crashed) killEnemy(e, 'crash');
    } else if (!guarded) {
      // 体当たりアイテムがあれば、ぶつかった敵から先にノーダメージで倒す。
      const rammed = crashed.slice(0, run.ramCharges);
      const unrammed = crashed.slice(run.ramCharges);
      run.ramCharges -= rammed.length;
      for (const e of rammed) killEnemy(e, 'crash');
      for (const e of unrammed) {
        e.dead = true;
        boom(e.x + e.w / 2, e.y + e.h / 2, e.w, '#f87171');
      }
      if (unrammed.length > 0) hit = true;
    }
  }
  if (!star && !guarded) {
    const hitBullets = run.ebullets.filter((eb) => hits(pbox, eb));
    if (hitBullets.length > 0) {
      run.ebullets = run.ebullets.filter((eb) => !hitBullets.includes(eb));
      hit = true;
    }
    const inFire = run.hazards.some((hz) => now >= hz.warnUntil && hits(pbox, hz));
    if (inFire) hit = true;
  }
  if (hit) takeHit();

  // 分裂などで生まれた敵を加え、倒れた敵を片付ける。
  run.enemies = run.enemies.filter((e) => !e.dead).concat(run.spawnQueue);
  run.spawnQueue = [];
  run.booms = run.booms.filter((bm) => bm.until > now);

  run.score = computeScore(stage, currentProgress(cfg), run.damageCount, cfg);

  // HUD
  document.getElementById('dx-hud-score').textContent = run.score;
  document.getElementById('dx-hud-power').textContent =
    `${WEAPON_ICON[run.weapon.kind]}${WEAPON_LABEL[run.weapon.kind]}${run.weapon.kind === 'normal' ? '' : `Lv${run.weapon.level}`}`;
  document.getElementById('dx-hud-lives').textContent = '❤'.repeat(Math.max(0, run.lives));
  const hudRam = document.getElementById('dx-hud-ram');
  hudRam.hidden = run.ramCharges <= 0;
  hudRam.textContent = `💢${run.ramCharges}`;

  if (run.lives <= 0 && !run.over) {
    run.over = true;
    endRun(false);
  }
}

function currentProgress(cfg) {
  if (run.phase === 'boss') {
    const ratio = run.boss ? run.boss.hp / run.boss.maxHp : 0;
    return stageProgress({ phase: 'boss', bossHpRatio: ratio }, cfg);
  }
  const waveRatio = (run.elapsed - run.stageStartedAt) / run.stage.duration;
  return stageProgress({ phase: run.phase, waveRatio }, cfg);
}

// ---- 描画 ----

function activeEffects(now) {
  const list = [];
  if (run.shield > 0) list.push({ text: '🛡️' });
  const sec = (until) => Math.ceil((until - now) / 1000);
  if (now < run.starUntil) list.push({ text: `⭐${sec(run.starUntil)}` });
  if (now < run.slowUntil) list.push({ text: `⏳${sec(run.slowUntil)}` });
  if (now < run.magnetUntil) list.push({ text: `🧲${sec(run.magnetUntil)}` });
  return list;
}

function draw() {
  const canvas = document.getElementById('dx-canvas');
  const ctx = canvas.getContext('2d');
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  const W = canvas.width / SCALE;
  const H = canvas.height / SCALE;
  const now = run.elapsed;

  drawBackground(ctx, W, H, now, run.stage.bgTheme, now < run.slowUntil);
  for (const hz of run.hazards) drawHazard(ctx, hz, now);
  for (const it of run.items) drawItem(ctx, it, now);
  for (const e of run.enemies) drawChargeWarning(ctx, e, now);
  for (const e of run.enemies) drawEnemy(ctx, e, now);
  if (run.midboss) drawMidboss(ctx, run.midboss, now);
  if (run.boss) drawBoss(ctx, run.boss, run.stage.boss.pattern, now);
  for (const b of run.bullets) drawPlayerBullet(ctx, b);
  for (const es of run.escorts) drawEscort(ctx, es.x, es.y, now);

  const blinking = now < run.invincibleUntil && Math.floor(now / 100) % 2 === 0;
  if (!blinking) {
    drawPlayer(ctx, run.player.x, run.player.y, now, { shield: run.shield > 0, star: now < run.starUntil });
  }

  // 敵の弾は見落とさないよう最前面に。
  for (const eb of run.ebullets) drawEnemyBullet(ctx, eb);
  for (const bm of run.booms) drawBoom(ctx, bm, now);
  if (now < run.flashUntil) drawFlash(ctx, W, H, (run.flashUntil - now) / 260 * 0.8);

  drawEffects(ctx, activeEffects(now));
  if (run.pickupUntil > now) drawPickupText(ctx, W, H, run.pickupText);
  if (run.bannerUntil > now) drawBanner(ctx, W, H, run.bannerText);
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
