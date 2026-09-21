import { getRhythmView, startRhythmRun, finishRhythmRun } from './store.js';
import {
  buildBeatmap, expandMelody, beatToSec, songLengthSec,
  noteFreq, judgeHit, computeRhythmScore,
} from './lib/rhythm.js';

// 画面の配置（canvas は 320x460）。
const JUDGE_X = 64;      // 判定の輪の中心
const LANE_Y = 150;      // ノーツが流れる高さ
const LANE_H = 66;
const NOTE_R = 17;
const ZONE_TOP = 248;    // 下半分のタップ案内
const ZONE_BOTTOM = 438;

const LEAD_IN_SEC = 2.0;   // 「スタート」から1音目までの助走
const LOOKAHEAD_SEC = 0.2; // 音をどれだけ先まで予約するか
const TAIL_SEC = 1.6;      // 最後の音のあと、結果を出すまでの余韻

let view = null;
let run = null;
let rafId = null;
let selectedSong = 0;

// Web Audio はユーザー操作のあとでないと鳴らせないので、初回の「演奏する」で作る。
const audio = { ctx: null, master: null, active: [] };

function init() {
  document.getElementById('rhythm-start-btn').onclick = handleStart;
  document.getElementById('rhythm-quit').onclick = () => quitRun();
  wireInput();
  document.addEventListener('game-tab-changed', (e) => {
    if (e.detail.tab === 'rhythm') { if (run) startLoop(); } else { stopLoop(); }
  });
  // アプリを離れたら音を止める（戻ったとき曲だけ進んでいるのを防ぐ）。
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && run) quitRun();
  });
  render();
}

// ---- 画面（演奏外） ----

function render() {
  view = getRhythmView();
  document.getElementById('rhythm-coin').textContent = view.balance;
  document.getElementById('rhythm-plays').textContent = view.plays;
  document.getElementById('rhythm-cost').textContent = view.playCost;
  if (view.songs[selectedSong]?.locked) selectedSong = view.cleared;
  renderSongs();
}

function renderSongs() {
  const el = document.getElementById('song-list');
  el.innerHTML = '';
  for (const s of view.songs) {
    const card = document.createElement('button');
    card.className = 'stage-card'
      + (s.index === selectedSong ? ' active' : '')
      + (s.locked ? ' locked' : '');
    card.disabled = s.locked;
    card.innerHTML = `
      <div class="stage-no">${s.locked ? '🔒' : `${s.index + 1}曲目`}</div>
      <div class="stage-name">${s.locked ? '？？？' : s.name}</div>
      <div class="stage-boss">${s.locked ? '' : `♩${s.bpm}`}</div>
      <div class="stage-score">${s.locked ? '' : (s.best > 0 ? `最高 ${s.best}` : `満点 ${s.fullScore}`)}</div>
      ${s.fullCombo ? '<div class="stage-clear">フルコンボ</div>' : (s.cleared ? '<div class="stage-clear">クリア</div>' : '')}`;
    card.onclick = () => { selectedSong = s.index; renderSongs(); };
    el.appendChild(card);
  }
}

// ---- 音（チップチューン合成） ----

function ensureAudio() {
  if (!audio.ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    audio.ctx = new Ctx();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.9;
    audio.master.connect(audio.ctx.destination);
  }
  if (audio.ctx.state === 'suspended') audio.ctx.resume();
  return true;
}

// when（AudioContext の時刻・秒）に、durSec だけ鳴る音を予約する。
function playTone(freq, when, durSec, type = 'square', gain = 0.1) {
  if (!audio.ctx) return;
  const at = Math.max(when, audio.ctx.currentTime);
  const osc = audio.ctx.createOscillator();
  const g = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  // カクッと立ち上げてスッと切る（8bitらしい音の形）。
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + durSec);
  osc.connect(g);
  g.connect(audio.master);
  osc.start(at);
  osc.stop(at + durSec + 0.05);
  audio.active.push(osc);
  osc.onended = () => {
    const i = audio.active.indexOf(osc);
    if (i >= 0) audio.active.splice(i, 1);
  };
}

function stopAllTones() {
  for (const osc of [...audio.active]) {
    try { osc.stop(); } catch { /* すでに止まっている */ }
  }
  audio.active.length = 0;
}

// 叩いたときの手応え（低い＝ドン／高い＝カッ）。
function playHitSound(type) {
  if (!audio.ctx) return;
  const now = audio.ctx.currentTime;
  if (type === 'don') playTone(160, now, 0.1, 'triangle', 0.22);
  else playTone(1100, now, 0.06, 'square', 0.14);
}

// 曲の音を先まで予約しておく（メインスレッドが詰まっても音は崩れない）。
function scheduleAudio() {
  const horizon = songTime() + LOOKAHEAD_SEC;
  while (run.nextMelody < run.melody.length) {
    const ev = run.melody[run.nextMelody];
    if (ev.sec > horizon) break;
    playTone(ev.freq, run.audioStart + ev.sec, ev.durSec, 'square', 0.09);
    run.nextMelody += 1;
  }
  // 拍ごとの低い刻み。リズムを体で取りやすくするため。
  while (run.nextBeat <= run.totalBeats) {
    const sec = run.nextBeat * run.beatSec;
    if (sec > horizon) break;
    playTone(98, run.audioStart + sec, 0.1, 'triangle', 0.1);
    run.nextBeat += 1;
  }
}

// 曲の中の現在位置（秒）。負の間は助走（カウントダウン）。
// 音声クロックを使うので、映像がカクついても音とノーツはズレない。
function songTime() {
  if (!audio.ctx) return (performance.now() - run.wallStart) / 1000 - LEAD_IN_SEC;
  return audio.ctx.currentTime - run.audioStart;
}

// ---- 演奏 ----

function handleStart() {
  if (run) return;
  const res = startRhythmRun(selectedSong);
  const msg = document.getElementById('rhythm-msg');
  if (!res.ok) {
    msg.textContent = res.reason === 'not-enough' ? `🪙が足りません（${res.cost}コイン必要）`
      : res.reason === 'locked' ? 'この曲はまだ開いていません' : '';
    return;
  }
  msg.textContent = '';
  ensureAudio();

  const { song, config } = res;
  const beatSec = beatToSec(1, song.bpm);
  run = {
    songIndex: res.songIndex,
    song,
    config,
    notes: buildBeatmap(song, config),
    melody: expandMelody(song).map((n) => ({
      sec: beatToSec(n.beat, song.bpm),
      freq: noteFreq(n.name),
      durSec: Math.min(beatToSec(n.dur, song.bpm) * 0.9, 0.6),
    })),
    beatSec,
    totalBeats: song.lengthBeats * (song.repeat || 1),
    lengthSec: songLengthSec(song),
    nextMelody: 0,
    nextBeat: 0,
    counts: { perfect: 0, great: 0, miss: 0, total: 0 },
    combo: 0,
    maxCombo: 0,
    score: 0,
    lastJudge: null,
    hitFlash: null,
    over: false,
    audioStart: (audio.ctx ? audio.ctx.currentTime : 0) + LEAD_IN_SEC,
    wallStart: performance.now(),
  };
  run.counts.total = run.notes.length;

  document.getElementById('rhythm-song-name').textContent = song.name;
  openOverlay();
  render();
  startLoop();
}

function openOverlay() {
  document.getElementById('rhythm-overlay').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeOverlay() {
  document.getElementById('rhythm-overlay').hidden = true;
  document.body.style.overflow = '';
}

function endRun() {
  const { song, songIndex, counts, maxCombo, score, config } = run;
  const fullCombo = counts.miss === 0 && counts.total > 0;
  const allPerfect = counts.perfect === counts.total && counts.total > 0;
  run = null;
  stopLoop();
  stopAllTones();
  closeOverlay();

  const res = finishRhythmRun({ songIndex, score, fullCombo });
  render();

  let emoji = '🎵';
  let title = '演奏おわり！';
  if (allPerfect) { emoji = '🌟'; title = 'オールパーフェクト！'; }
  else if (fullCombo) { emoji = '🎉'; title = 'フルコンボ！'; }
  else if (res.isNewRecord) { emoji = '🏆'; title = '最高得点を更新！'; }
  else if (!res.cleared) { emoji = '😿'; title = 'もう一息！'; }

  const unlockMsg = res.unlockedNew ? '\n新しい曲が開いた！' : '';
  const clearMsg = res.cleared ? '' : `\n（満点の${Math.round(config.clearRatio * 100)}%でクリア）`;
  showModal(emoji, title,
    `得点 ${score} ／ 満点 ${song.clearScore}\n`
    + `パーフェクト ${counts.perfect} ・ グレート ${counts.great} ・ ミス ${counts.miss}\n`
    + `最大コンボ ${maxCombo}${unlockMsg}${clearMsg}`);
}

function quitRun() {
  if (!run) { closeOverlay(); return; }
  endRun();
}

// ---- 入力（画面の左半分＝ドン／右半分＝カッ） ----

function wireInput() {
  const canvas = document.getElementById('rhythm-canvas');
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!run) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    hit(x < canvas.width / 2 ? 'don' : 'ka');
  });
  window.addEventListener('keydown', (e) => {
    if (!run || e.repeat) return;
    if (e.key === 'f' || e.key === 'd' || e.key === 'ArrowLeft') hit('don');
    if (e.key === 'j' || e.key === 'k' || e.key === 'ArrowRight') hit('ka');
  });
}

function hit(type) {
  const now = songTime();
  const windowSec = run.config.judge.windowMs / 1000;
  // いちばん近い、まだ判定していないノーツを探す。
  let target = null;
  let bestDiff = Infinity;
  for (const n of run.notes) {
    if (n.judged) continue;
    const diff = Math.abs(n.sec - now);
    if (diff > windowSec) continue;
    if (diff < bestDiff) { bestDiff = diff; target = n; }
  }
  playHitSound(type);
  run.hitFlash = { type, until: now + 0.1 };
  if (!target) return; // 空打ちはおとがめなし（コンボも切れない）

  target.judged = true;
  const result = target.type === type ? judgeHit(bestDiff * 1000, run.config) : 'miss';
  applyResult(target, result, now);
}

function applyResult(note, result, now) {
  note.result = result;
  run.counts[result] += 1;
  if (result === 'miss') run.combo = 0;
  else {
    run.combo += 1;
    run.maxCombo = Math.max(run.maxCombo, run.combo);
  }
  run.lastJudge = { result, until: now + 0.5 };
  run.score = computeRhythmScore(run.song, run.counts, run.config);
}

// ---- ゲームループ ----

function startLoop() {
  if (rafId) return;
  rafId = requestAnimationFrame(loop);
}

function stopLoop() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}

function loop() {
  if (run) {
    update();
    if (run) draw();
  }
  rafId = requestAnimationFrame(loop);
}

function update() {
  const now = songTime();
  scheduleAudio();

  // 叩かれないまま通り過ぎたノーツはミス。
  const lateSec = run.config.judge.windowMs / 1000;
  for (const n of run.notes) {
    if (!n.judged && n.sec < now - lateSec) {
      n.judged = true;
      applyResult(n, 'miss', now);
    }
  }

  document.getElementById('rhythm-score').textContent = run.score;
  document.getElementById('rhythm-combo').textContent = `${run.combo} コンボ`;

  if (!run.over && now > run.lengthSec + TAIL_SEC) {
    run.over = true;
    endRun();
  }
}

// ---- 描画 ----

function draw() {
  const canvas = document.getElementById('rhythm-canvas');
  const ctx = canvas.getContext('2d');
  const now = songTime();
  const pxPerSec = (canvas.width - JUDGE_X) / run.config.leadSec;

  // 背景（拍に合わせてほんの少し明るくなる）。
  const beatPhase = ((now / run.beatSec) % 1 + 1) % 1;
  const pulse = now >= 0 ? Math.max(0, 1 - beatPhase * 3) : 0;
  ctx.fillStyle = `rgb(${14 + pulse * 16}, ${16 + pulse * 14}, ${34 + pulse * 20})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ノーツが流れるレーン。
  ctx.fillStyle = '#1e2545';
  ctx.fillRect(0, LANE_Y - LANE_H / 2, canvas.width, LANE_H);
  ctx.fillStyle = '#39406b';
  ctx.fillRect(0, LANE_Y - LANE_H / 2, canvas.width, 2);
  ctx.fillRect(0, LANE_Y + LANE_H / 2 - 2, canvas.width, 2);

  // 判定の輪。
  const flashing = run.hitFlash && run.hitFlash.until > now;
  ctx.beginPath();
  ctx.arc(JUDGE_X, LANE_Y, NOTE_R + 4, 0, Math.PI * 2);
  ctx.fillStyle = flashing
    ? (run.hitFlash.type === 'don' ? 'rgba(239,68,68,0.55)' : 'rgba(59,130,246,0.55)')
    : 'rgba(255,255,255,0.10)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#8b93c7';
  ctx.stroke();

  // ノーツ（右から左へ流れてくる）。
  for (const n of run.notes) {
    if (n.judged) continue;
    const x = JUDGE_X + (n.sec - now) * pxPerSec;
    if (x < -NOTE_R * 2 || x > canvas.width + NOTE_R * 2) continue;
    ctx.beginPath();
    ctx.arc(x, LANE_Y, NOTE_R, 0, Math.PI * 2);
    ctx.fillStyle = n.type === 'don' ? '#ef4444' : '#3b82f6';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = n.type === 'don' ? '#fca5a5' : '#93c5fd';
    ctx.stroke();
  }

  // 判定の文字。
  if (run.lastJudge && run.lastJudge.until > now) {
    const label = { perfect: 'パーフェクト', great: 'グレート', miss: 'ミス' }[run.lastJudge.result];
    const color = { perfect: '#fbbf24', great: '#4ade80', miss: '#9aa4b2' }[run.lastJudge.result];
    ctx.fillStyle = color;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, canvas.width / 2, LANE_Y - LANE_H / 2 - 14);
  }

  // コンボ。
  if (run.combo >= 3) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${run.combo}`, canvas.width / 2, LANE_Y + LANE_H / 2 + 46);
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillStyle = '#9aa4b2';
    ctx.fillText('コンボ', canvas.width / 2, LANE_Y + LANE_H / 2 + 66);
  }

  // 下半分のタップ案内。
  drawZone(ctx, 8, canvas.width / 2 - 6, '#ef4444', 'ドン', flashing && run.hitFlash.type === 'don');
  drawZone(ctx, canvas.width / 2 + 6, canvas.width - 8, '#3b82f6', 'カッ', flashing && run.hitFlash.type === 'ka');

  // 助走中のカウントダウン。
  if (now < 0) {
    const count = Math.ceil(-now);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, canvas.height / 2 - 40, canvas.width, 80);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(count), canvas.width / 2, canvas.height / 2 + 16);
  }
}

function drawZone(ctx, left, right, color, label, active) {
  ctx.fillStyle = active ? color : 'rgba(255,255,255,0.06)';
  ctx.globalAlpha = active ? 0.55 : 1;
  roundRect(ctx, left, ZONE_TOP, right - left, ZONE_BOTTOM - ZONE_TOP, 16);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  roundRect(ctx, left, ZONE_TOP, right - left, ZONE_BOTTOM - ZONE_TOP, 16);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, (left + right) / 2, (ZONE_TOP + ZONE_BOTTOM) / 2 + 9);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
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
