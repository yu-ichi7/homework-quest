// localStorage を使ったデータストア。
// 旧Expressサーバーの routes/ と同じ意味論をブラウザ内で提供する。
// データは端末内（localStorage）にのみ保存される。

import {
  DEFAULT_CONFIG, DEFAULT_CHILDREN, DEFAULT_TASKS, DEFAULT_GAME_STATE,
  DEFAULT_SHOOTER_STATE,
} from './lib/defaults.js';
import { recomputeChild } from './lib/progress.js';
import { expandForDay, withCompletionState } from './lib/taskExpand.js';
import {
  computeStreak, taskStreak, taskTotalCount, taskCountByDate,
} from './lib/streak.js';
import { todayStr, addDays } from './lib/dates.js';
import { balance } from './lib/game.js';
import { planeStats, nextUpgradeCost, maxUpgradeLevel } from './lib/shooter.js';
import {
  createPet, applyDecay, feed, treat, play, checkEvolution, cleanPoop, SPECIES,
} from './lib/pet.js';

export const WEEKDAY_JP = ['日', '月', '火', '水', '木', '金', '土'];

const KEY = 'homework-quest:data';
const DATA_VERSION = 2;

function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function seed() {
  const now = new Date().toISOString();
  return {
    version: DATA_VERSION,
    children: DEFAULT_CHILDREN.map((c) => ({ ...c, createdAt: now })),
    tasks: DEFAULT_TASKS.map((t) => ({ ...t, createdAt: now })),
    completions: [],
    game: { ...DEFAULT_GAME_STATE },
    shooter: {
      ...DEFAULT_SHOOTER_STATE,
      upgrades: { ...DEFAULT_SHOOTER_STATE.upgrades },
    },
    pet: null,
    petAlbum: [],
    iceCream: { earned: 0, used: 0 },
    config: DEFAULT_CONFIG,
  };
}

// 旧バージョンのデータに、ゲーム・ペット欄を後付けする（非破壊マイグレーション）。
function ensureShape(data) {
  let changed = false;
  if (!data.config) { data.config = DEFAULT_CONFIG; changed = true; }
  // 冒険をやめてシューティングにしたので、古い config.game は捨てて shooter を用意する。
  if (data.config.game) { delete data.config.game; changed = true; }
  if (!data.config.shooter) { data.config.shooter = DEFAULT_CONFIG.shooter; changed = true; }
  else {
    for (const [k, v] of Object.entries(DEFAULT_CONFIG.shooter)) {
      if (data.config.shooter[k] === undefined) { data.config.shooter[k] = v; changed = true; }
    }
  }
  // シューティングの記録・永続強化。
  if (!data.shooter) {
    data.shooter = {
      ...DEFAULT_SHOOTER_STATE,
      upgrades: { ...DEFAULT_SHOOTER_STATE.upgrades },
    };
    changed = true;
  } else if (!data.shooter.upgrades) {
    data.shooter.upgrades = { ...DEFAULT_SHOOTER_STATE.upgrades };
    changed = true;
  }
  if (!data.config.pet) { data.config.pet = DEFAULT_CONFIG.pet; changed = true; }
  else {
    for (const [k, v] of Object.entries(DEFAULT_CONFIG.pet)) {
      if (data.config.pet[k] === undefined) { data.config.pet[k] = v; changed = true; }
    }
    // ごはんの旧価格（5）は新価格へ引き上げる（一度きりのマイグレーション）。
    if (data.config.pet.feedCost === 5) { data.config.pet.feedCost = DEFAULT_CONFIG.pet.feedCost; changed = true; }
    // お腹の減りが旧設定（4）なら新しい速さへ（成長ポイント制に合わせた調整）。
    if (data.config.pet.decayPerCheckpoint?.hunger === 4) {
      data.config.pet.decayPerCheckpoint.hunger = DEFAULT_CONFIG.pet.decayPerCheckpoint.hunger;
      changed = true;
    }
  }

  if (!data.game) {
    // これまでの達成ぶんを、初期コインとして引き継ぐ。
    const earned = (data.completions || []).reduce((s, c) => s + (c.points || 0), 0);
    data.game = { ...DEFAULT_GAME_STATE, coinsEarned: earned };
    changed = true;
  } else {
    for (const [k, v] of Object.entries(DEFAULT_GAME_STATE)) {
      if (data.game[k] === undefined) { data.game[k] = v; changed = true; }
    }
  }

  if (data.pet === undefined) { data.pet = null; changed = true; }
  if (data.pet && data.pet.poopCount === undefined) { data.pet.poopCount = 0; changed = true; }
  // 旧「お世話回数」から成長ポイントへ移行（1回のお世話 ≒ 成長3）。
  if (data.pet && data.pet.growth === undefined) {
    data.pet.growth = (data.pet.careCount || 0) * 3;
    delete data.pet.careCount;
    changed = true;
  }
  if (!Array.isArray(data.petAlbum)) { data.petAlbum = []; changed = true; }
  if (!data.iceCream || typeof data.iceCream !== 'object') { data.iceCream = { earned: 0, used: 0 }; changed = true; }
  if (data.config.iceCreamStreak === undefined) { data.config.iceCreamStreak = DEFAULT_CONFIG.iceCreamStreak; changed = true; }

  if (data.version !== DATA_VERSION) { data.version = DATA_VERSION; changed = true; }
  return { data, changed };
}

// 前回読み込み以降に過ぎた時刻チェックポイントぶん、ペットの状態を減衰させる。
function tickPet(data, now) {
  if (!data.pet) return false;
  const before = data.pet;
  const after = applyDecay(before, now, data.config.pet);
  if (after === before) return false;
  data.pet = after;
  return true;
}

function load() {
  const now = new Date();
  try {
    const text = localStorage.getItem(KEY);
    if (text) {
      const parsed = JSON.parse(text);
      if (parsed && Array.isArray(parsed.children)) {
        const { data, changed } = ensureShape(parsed);
        const ticked = tickPet(data, now);
        if (changed || ticked) save(data);
        return data;
      }
    }
  } catch (err) {
    console.error('データの読み込みに失敗。初期化します', err);
  }
  const data = seed();
  save(data);
  return data;
}

function save(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

// ---- children ----

export function getChildren() {
  return load().children;
}

export function getConfig() {
  return load().config;
}

export function updateChild(id, { name, color }) {
  const data = load();
  const child = data.children.find((c) => c.id === id);
  if (!child) throw new Error('child not found');
  if (typeof name === 'string' && name.trim()) child.name = name.trim();
  if (typeof color === 'string') child.color = color;
  save(data);
  return child;
}

// ---- tasks ----

export function getTasks() {
  return load().tasks;
}

export function addTask(body) {
  const kind = body.kind === 'spot' ? 'spot' : 'routine';
  const task = {
    id: uuid(),
    childId: body.childId || 'all',
    title: String(body.title || '').trim(),
    icon: body.icon || '⭐',
    points: Number(body.points) || 0,
    kind,
    days: kind === 'routine' ? (Array.isArray(body.days) ? body.days.map(Number) : []) : undefined,
    date: kind === 'spot' ? (body.date || todayStr()) : undefined,
    active: true,
    createdAt: new Date().toISOString(),
  };
  if (!task.title) throw new Error('タスク名を入力してください');
  if (kind === 'routine' && task.days.length === 0) throw new Error('曜日を1つ以上選んでください');
  const data = load();
  data.tasks.push(task);
  save(data);
  return task;
}

export function deleteTask(id) {
  const data = load();
  const idx = data.tasks.findIndex((t) => t.id === id);
  if (idx < 0) throw new Error('task not found');
  data.tasks.splice(idx, 1);
  save(data);
}

// タスクの内容を修正する（削除→再作成しなくてよいように）。
export function updateTask(id, body) {
  const data = load();
  const task = data.tasks.find((t) => t.id === id);
  if (!task) throw new Error('task not found');

  const kind = body.kind === 'spot' ? 'spot' : 'routine';
  const title = String(body.title || '').trim();
  if (!title) throw new Error('タスク名を入力してください');

  task.title = title;
  task.icon = body.icon || '⭐';
  task.points = Number(body.points) || 0;
  task.kind = kind;
  if (kind === 'routine') {
    const days = Array.isArray(body.days) ? body.days.map(Number) : [];
    if (days.length === 0) throw new Error('曜日を1つ以上選んでください');
    task.days = days;
    task.date = undefined;
  } else {
    task.date = body.date || todayStr();
    task.days = undefined;
  }
  save(data);
  return task;
}

// タスク履歴ページ用。対象タスクと、日別の達成回数マップ・炎・累計・目標をまとめて返す。
export function getTaskHistory(taskId, today = todayStr()) {
  const data = load();
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task) return null;
  return {
    task,
    countByDate: taskCountByDate(task, data.completions),
    streak: taskStreak(task, data.completions, today),
    total: taskTotalCount(task, data.completions),
    todayCount: (taskCountByDate(task, data.completions)[today]) || 0,
    today,
  };
}

// 記録ページ用。全タスクの継続・累計・最後にやった日をまとめて返す。
export function getTaskSummaries(today = todayStr()) {
  const data = load();
  return data.tasks.map((task) => {
    const counts = taskCountByDate(task, data.completions);
    const dates = Object.keys(counts).sort();
    return {
      id: task.id,
      title: task.title,
      icon: task.icon,
      kind: task.kind,
      streak: taskStreak(task, data.completions, today),
      total: taskTotalCount(task, data.completions),
      lastDone: dates.length > 0 ? dates[dates.length - 1] : null,
    };
  });
}

// ---- 今日のタスク ----

export function getToday(childId, date = todayStr()) {
  const data = load();
  const expanded = expandForDay(data.tasks, childId, date);
  const items = withCompletionState(expanded, data.completions, childId, date);
  // その日の達成回数（何回タップしたか）と継続（炎カウンター）を合成する。
  const enriched = items.map((item) => {
    const task = data.tasks.find((t) => t.id === item.id);
    const dayComps = data.completions.filter(
      (c) => c.taskId === item.id && c.childId === childId && c.date === date,
    );
    const doneCount = dayComps.length;
    return {
      ...item,
      doneCount,
      done: doneCount >= 1,
      lastCompletionId: doneCount > 0 ? dayComps[dayComps.length - 1].id : null,
      streak: task ? taskStreak(task, data.completions, date) : 0,
      total: task ? taskTotalCount(task, data.completions) : 0,
    };
  });
  return { date, childId, items: enriched };
}

// ---- 達成（チェック / 取り消し） ----

// チェック時。completion 追加 → child を達成ログから再計算。あわせてコインも加算する。
export function addCompletion({ taskId, childId, date = todayStr() }) {
  const data = load();
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task) throw new Error('task not found');
  const child = data.children.find((c) => c.id === childId);
  if (!child) throw new Error('child not found');

  // 何回でも達成できる（タップするたびに1回ぶん記録・ポイント加算）。

  // アイス発行のため、追加前のこのタスクのストリークを控えておく。
  const streakBefore = taskStreak(task, data.completions, date);

  const completion = {
    id: uuid(),
    taskId,
    childId,
    date,
    title: task.title,
    icon: task.icon,
    points: task.points,
    completedAt: new Date().toISOString(),
  };
  data.completions.push(completion);

  const before = { level: child.level, badges: child.badges };
  Object.assign(child, recomputeChild(child, data.completions, data.config));

  // コイン加算（消費型の獲得側）。
  data.game.coinsEarned = (data.game.coinsEarned || 0) + completion.points;

  // 10連続に達するごとにアイスクリームバッジを発行（追加前後のストリーク差で数える）。
  const streakAfter = taskStreak(task, data.completions, date);
  const per = data.config.iceCreamStreak || 10;
  const iceCreamsGained = Math.max(
    0, Math.floor(streakAfter / per) - Math.floor(streakBefore / per),
  );
  if (iceCreamsGained > 0) {
    data.iceCream.earned = (data.iceCream.earned || 0) + iceCreamsGained;
  }

  save(data);

  const leveledUp = child.level > before.level;
  const newBadges = data.config.badges.filter(
    (b) => child.badges.includes(b.id) && !before.badges.includes(b.id),
  );
  return {
    ok: true, completion, child, leveledUp, newBadges,
    coinsGained: completion.points, iceCreamsGained,
  };
}

// チェック外し（誤タップ取り消し）。completion 削除 → child 再計算。コインも戻す。
export function removeCompletion(id) {
  const data = load();
  const idx = data.completions.findIndex((c) => c.id === id);
  if (idx < 0) throw new Error('completion not found');
  const [removed] = data.completions.splice(idx, 1);

  const child = data.children.find((c) => c.id === removed.childId);
  if (child) Object.assign(child, recomputeChild(child, data.completions, data.config));

  // コイン獲得側を戻す（0未満にはしない）。使ったぶんは戻さない。
  data.game.coinsEarned = Math.max(0, (data.game.coinsEarned || 0) - (removed.points || 0));

  save(data);
  return { ok: true, child };
}

// ---- シューティング ----

export function getShooterView() {
  const data = load();
  const cfg = data.config.shooter;
  const s = data.shooter;
  // 永続強化の一覧（今のレベル・次のコイン・最大レベル）。
  const upgrades = Object.entries(cfg.upgrades).map(([kind, u]) => ({
    kind,
    name: u.name,
    icon: u.icon,
    desc: u.desc,
    level: s.upgrades[kind] || 0,
    maxLevel: maxUpgradeLevel(kind, cfg),
    nextCost: nextUpgradeCost(kind, s.upgrades[kind] || 0, cfg),
  }));
  // ブーストごとの出撃性能（画面で見比べられるように）。
  const boostTiers = cfg.boostTiers.map((t) => ({
    ...t,
    stats: planeStats(s.upgrades, t, cfg),
  }));
  return {
    balance: balance(data.game),
    highScore: s.highScore || 0,
    totalKills: s.totalKills || 0,
    plays: s.plays || 0,
    upgrades,
    boostTiers,
    config: cfg,
  };
}

// コインを払って出撃する。戻り値の stats がそのプレイの機体性能。
export function startRun(tierId) {
  const data = load();
  const cfg = data.config.shooter;
  const tier = cfg.boostTiers.find((t) => t.id === tierId);
  if (!tier) return { ok: false, reason: 'no-tier' };
  if (balance(data.game) < tier.cost) return { ok: false, reason: 'not-enough', cost: tier.cost };
  data.game.coinsSpent = (data.game.coinsSpent || 0) + tier.cost;
  save(data);
  return { ok: true, cost: tier.cost, tier, stats: planeStats(data.shooter.upgrades, tier, cfg) };
}

// ゲームオーバー時。ハイスコアと累計を更新する。
export function finishRun({ score = 0, kills = 0 } = {}) {
  const data = load();
  const s = data.shooter;
  const isNewRecord = score > (s.highScore || 0);
  if (isNewRecord) s.highScore = score;
  s.totalKills = (s.totalKills || 0) + kills;
  s.plays = (s.plays || 0) + 1;
  save(data);
  return { isNewRecord, highScore: s.highScore, totalKills: s.totalKills, plays: s.plays };
}

// 永続強化を1レベル買う。
export function buyUpgrade(kind) {
  const data = load();
  const cfg = data.config.shooter;
  const level = data.shooter.upgrades[kind] || 0;
  const cost = nextUpgradeCost(kind, level, cfg);
  if (cost === null) return { ok: false, reason: 'max' };
  if (balance(data.game) < cost) return { ok: false, reason: 'not-enough', cost };
  data.game.coinsSpent = (data.game.coinsSpent || 0) + cost;
  data.shooter.upgrades[kind] = level + 1;
  save(data);
  return { ok: true, cost, kind, level: level + 1 };
}

// ---- ペット（育成） ----

export function getPetView() {
  const data = load();
  return {
    balance: balance(data.game),
    pet: data.pet,
    album: data.petAlbum,
    species: SPECIES,
    feedCost: data.config.pet.feedCost,
    treatCost: data.config.pet.treatCost,
    cleanCost: data.config.pet.cleanCost,
    growthToEvolve: data.config.pet.growthToEvolve,
  };
}

export function adoptPet(speciesId) {
  const data = load();
  if (data.pet) throw new Error('すでにペットを育てています');
  if (!SPECIES.some((s) => s.id === speciesId)) throw new Error('species not found');
  data.pet = createPet(speciesId);
  save(data);
  return data.pet;
}

// ごはん。満腹でもあげられる（成長は小さくなる）＝たくさんあげるほど早く育つ。
export function feedPet() {
  const data = load();
  if (!data.pet) return { ok: false, reason: 'no-pet' };
  const cost = data.config.pet.feedCost;
  if (balance(data.game) < cost) return { ok: false, reason: 'not-enough', cost };
  const { pet: fed, gained, wasFull } = feed(data.pet, data.config.pet);
  data.game.coinsSpent = (data.game.coinsSpent || 0) + cost;
  const { pet: evolvedPet, evolved } = checkEvolution(fed, data.config.pet);
  data.pet = evolvedPet;
  save(data);
  return { ok: true, pet: data.pet, evolved, gained, wasFull };
}

// ごちそう。コインは多めにかかるが、両ステータスが大きく回復し成長も大きい。
export function treatPet() {
  const data = load();
  if (!data.pet) return { ok: false, reason: 'no-pet' };
  const cost = data.config.pet.treatCost;
  if (balance(data.game) < cost) return { ok: false, reason: 'not-enough', cost };
  const { pet: treated, gained, wasFull } = treat(data.pet, data.config.pet);
  data.game.coinsSpent = (data.game.coinsSpent || 0) + cost;
  const { pet: evolvedPet, evolved } = checkEvolution(treated, data.config.pet);
  data.pet = evolvedPet;
  save(data);
  return { ok: true, pet: data.pet, evolved, gained, wasFull };
}

// あそぶ（無料）。仲良し度が満タンのときは成長しない（無限成長を防ぐ）。
export function playPet() {
  const data = load();
  if (!data.pet) return { ok: false, reason: 'no-pet' };
  const { pet: played, counted, gained } = play(data.pet, data.config.pet);
  if (!counted) return { ok: false, reason: 'full' };
  const { pet: evolvedPet, evolved } = checkEvolution(played, data.config.pet);
  data.pet = evolvedPet;
  save(data);
  return { ok: true, pet: data.pet, evolved, gained };
}

// うんちを1つ、コインを払って掃除する。
export function cleanPetPoop() {
  const data = load();
  if (!data.pet) return { ok: false, reason: 'no-pet' };
  const cost = data.config.pet.cleanCost;
  if (balance(data.game) < cost) return { ok: false, reason: 'not-enough', cost };
  const { pet: cleanedPet, cleaned: didClean, gained } = cleanPoop(data.pet, data.config.pet);
  if (!didClean) return { ok: false, reason: 'clean' };
  data.game.coinsSpent = (data.game.coinsSpent || 0) + cost;
  const { pet: evolvedPet, evolved } = checkEvolution(cleanedPet, data.config.pet);
  data.pet = evolvedPet;
  save(data);
  return { ok: true, pet: data.pet, evolved, gained };
}

export function graduatePet() {
  const data = load();
  if (!data.pet || data.pet.stage < 2) throw new Error('まだ卒業できません');
  data.petAlbum.push({
    species: data.pet.species,
    form: data.pet.form,
    matured: new Date().toISOString(),
  });
  data.pet = null;
  save(data);
  return { album: data.petAlbum };
}

// ---- アイスクリームバッジ ----

export function getIceCream() {
  const data = load();
  const earned = data.iceCream.earned || 0;
  const used = data.iceCream.used || 0;
  return { earned, used, available: Math.max(0, earned - used) };
}

// アイスを1つ「割って」使う（演出のみ）。
export function useIceCream() {
  const data = load();
  const earned = data.iceCream.earned || 0;
  const used = data.iceCream.used || 0;
  if (earned - used <= 0) return { ok: false, reason: 'none', earned, used, available: 0 };
  data.iceCream.used = used + 1;
  save(data);
  return { ok: true, earned, used: data.iceCream.used, available: earned - data.iceCream.used };
}

// ---- 集計（記録ページ用） ----

export function getStats(childId, today = todayStr()) {
  const data = load();
  const mine = data.completions.filter((c) => c.childId === childId);

  const streak = computeStreak(mine, today);

  // 直近7日の日別（達成数・ポイント）。
  const last7 = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = addDays(today, -i);
    const dayItems = mine.filter((c) => c.date === d);
    last7.push({
      date: d,
      count: dayItems.length,
      points: dayItems.reduce((s, c) => s + (c.points || 0), 0),
    });
  }

  const week = last7.reduce(
    (acc, d) => ({ count: acc.count + d.count, points: acc.points + d.points }),
    { count: 0, points: 0 },
  );

  const month = today.slice(0, 7); // YYYY-MM
  const monthItems = mine.filter((c) => c.date.startsWith(month));
  const monthAgg = {
    count: monthItems.length,
    points: monthItems.reduce((s, c) => s + (c.points || 0), 0),
  };

  // 達成日ごとの集計（カレンダーのマーク用）: { 'YYYY-MM-DD': { count, points } }
  const byDate = {};
  for (const c of mine) {
    if (!byDate[c.date]) byDate[c.date] = { count: 0, points: 0 };
    byDate[c.date].count += 1;
    byDate[c.date].points += c.points || 0;
  }

  return { childId, today, streak, last7, week, month: monthAgg, byDate };
}

// ---- バックアップ ----

export function exportData() {
  return load();
}

// バックアップJSONの復元。最低限の形チェックをして保存する。
export function importData(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('ファイルの形式が違います');
  if (!Array.isArray(obj.children) || !Array.isArray(obj.tasks) || !Array.isArray(obj.completions)) {
    throw new Error('バックアップファイルではないようです');
  }
  const base = {
    version: DATA_VERSION,
    children: obj.children,
    tasks: obj.tasks,
    completions: obj.completions,
    game: obj.game,
    shooter: obj.shooter,
    pet: obj.pet ?? null,
    petAlbum: Array.isArray(obj.petAlbum) ? obj.petAlbum : [],
    iceCream: obj.iceCream && typeof obj.iceCream === 'object' ? obj.iceCream : { earned: 0, used: 0 },
    config: obj.config && Array.isArray(obj.config.levels) ? obj.config : DEFAULT_CONFIG,
  };
  const { data } = ensureShape(base);
  save(data);
  return data;
}
