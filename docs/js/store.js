// localStorage を使ったデータストア。
// 旧Expressサーバーの routes/ と同じ意味論をブラウザ内で提供する。
// データは端末内（localStorage）にのみ保存される。

import {
  DEFAULT_CONFIG, DEFAULT_CHILDREN, DEFAULT_TASKS, DEFAULT_GAME_STATE,
} from './lib/defaults.js';
import { recomputeChild } from './lib/progress.js';
import { expandForDay, withCompletionState } from './lib/taskExpand.js';
import {
  computeStreak, taskStreak, taskTotalCount, taskCountByDate,
} from './lib/streak.js';
import { todayStr, addDays } from './lib/dates.js';
import {
  balance, locate, totalTiles, effectiveMoveCost, heroAttack, defeatCost,
  applyMove, buyItem, equipItem,
} from './lib/game.js';
import {
  createPet, applyDecay, feed, play, checkEvolution, cleanPoop, SPECIES,
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
    game: { ...DEFAULT_GAME_STATE, equipped: { ...DEFAULT_GAME_STATE.equipped } },
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
  if (!data.config.game) { data.config.game = DEFAULT_CONFIG.game; changed = true; }
  else {
    // 既存の config.game に、後から増えた設定キー（baseAtk等）を補完する。
    for (const [k, v] of Object.entries(DEFAULT_CONFIG.game)) {
      if (data.config.game[k] === undefined) { data.config.game[k] = v; changed = true; }
    }
  }
  if (!data.config.pet) { data.config.pet = DEFAULT_CONFIG.pet; changed = true; }
  else {
    for (const [k, v] of Object.entries(DEFAULT_CONFIG.pet)) {
      if (data.config.pet[k] === undefined) { data.config.pet[k] = v; changed = true; }
    }
  }

  if (!data.game) {
    // これまでの達成ぶんを、冒険の初期コインとして引き継ぐ。
    const earned = (data.completions || []).reduce((s, c) => s + (c.points || 0), 0);
    data.game = {
      ...DEFAULT_GAME_STATE,
      equipped: { ...DEFAULT_GAME_STATE.equipped },
      coinsEarned: earned,
    };
    changed = true;
  } else {
    for (const [k, v] of Object.entries(DEFAULT_GAME_STATE)) {
      if (data.game[k] === undefined) {
        data.game[k] = Array.isArray(v) ? [] : (v && typeof v === 'object' ? { ...v } : v);
        changed = true;
      }
    }
    if (!data.game.equipped) { data.game.equipped = { ...DEFAULT_GAME_STATE.equipped }; changed = true; }
  }

  if (data.pet === undefined) { data.pet = null; changed = true; }
  if (data.pet && data.pet.poopCount === undefined) { data.pet.poopCount = 0; changed = true; }
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

// ---- 冒険（RPG） ----

export function getGameView() {
  const data = load();
  const g = data.game;
  const loc = locate(g.position, data.config);
  return {
    balance: balance(g),
    coinsEarned: g.coinsEarned || 0,
    coinsSpent: g.coinsSpent || 0,
    position: g.position,
    area: loc.area,
    areaIndex: loc.areaIndex,
    localTile: loc.localTile,
    isComplete: loc.isComplete,
    moveCost: effectiveMoveCost(g, data.config),
    totalTiles: totalTiles(data.config),
    inventory: g.inventory || [],
    equipped: g.equipped || {},
    shop: data.config.game.shop,
    heroAttack: heroAttack(g, data.config),
    config: data.config,
    game: g,
  };
}

// あるモンスターを倒すのに今いくらかかるか（装備で安くなる）。
export function monsterDefeatCost(monster) {
  const data = load();
  return defeatCost(monster, data.game, data.config);
}

// コインを払ってモンスターを倒す。装備のこうげき力ぶんコストが安くなる。
export function defeatMonster(monster) {
  const data = load();
  const cost = defeatCost(monster, data.game, data.config);
  if (balance(data.game) < cost) return { ok: false, reason: 'not-enough', cost };
  data.game.coinsSpent = (data.game.coinsSpent || 0) + cost;
  if (!data.game.defeatedMonsters.includes(monster.id)) {
    data.game.defeatedMonsters.push(monster.id);
  }
  const reward = monster.reward || {};
  if (reward.coins) data.game.coinsEarned = (data.game.coinsEarned || 0) + reward.coins;
  if (reward.item && !data.game.inventory.includes(reward.item)) {
    data.game.inventory.push(reward.item);
  }
  save(data);
  return { ok: true, cost, reward, game: data.game };
}

export function advance() {
  const data = load();
  const res = applyMove(data.game, data.config);
  if (res.moved) { data.game = res.game; save(data); }
  return res;
}

export function buy(itemId) {
  const data = load();
  const res = buyItem(data.game, data.config, itemId);
  if (res.ok) { data.game = res.game; save(data); }
  return res;
}

export function equip(itemId) {
  const data = load();
  data.game = equipItem(data.game, data.config, itemId);
  save(data);
  return data.game;
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
    cleanCost: data.config.pet.cleanCost,
    careToEvolve: data.config.pet.careToEvolve,
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

export function feedPet() {
  const data = load();
  if (!data.pet) return { ok: false, reason: 'no-pet' };
  const cost = data.config.pet.feedCost;
  if (balance(data.game) < cost) return { ok: false, reason: 'not-enough', cost };
  const { pet: fed, counted } = feed(data.pet);
  if (!counted) return { ok: false, reason: 'full' };
  data.game.coinsSpent = (data.game.coinsSpent || 0) + cost;
  const { pet: evolvedPet, evolved } = checkEvolution(fed, data.config.pet);
  data.pet = evolvedPet;
  save(data);
  return { ok: true, pet: data.pet, evolved };
}

export function playPet() {
  const data = load();
  if (!data.pet) return { ok: false, reason: 'no-pet' };
  const { pet: played, counted } = play(data.pet);
  if (!counted) return { ok: false, reason: 'full' };
  const { pet: evolvedPet, evolved } = checkEvolution(played, data.config.pet);
  data.pet = evolvedPet;
  save(data);
  return { ok: true, pet: data.pet, evolved };
}

// うんちを1つ、コインを払って掃除する。
export function cleanPetPoop() {
  const data = load();
  if (!data.pet) return { ok: false, reason: 'no-pet' };
  const cost = data.config.pet.cleanCost;
  if (balance(data.game) < cost) return { ok: false, reason: 'not-enough', cost };
  const { pet: cleaned, cleaned: didClean } = cleanPoop(data.pet);
  if (!didClean) return { ok: false, reason: 'clean' };
  data.game.coinsSpent = (data.game.coinsSpent || 0) + cost;
  data.pet = cleaned;
  save(data);
  return { ok: true, pet: data.pet };
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
    pet: obj.pet ?? null,
    petAlbum: Array.isArray(obj.petAlbum) ? obj.petAlbum : [],
    iceCream: obj.iceCream && typeof obj.iceCream === 'object' ? obj.iceCream : { earned: 0, used: 0 },
    config: obj.config && Array.isArray(obj.config.levels) ? obj.config : DEFAULT_CONFIG,
  };
  const { data } = ensureShape(base);
  save(data);
  return data;
}
