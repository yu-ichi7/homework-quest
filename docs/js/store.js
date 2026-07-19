// localStorage を使ったデータストア。
// 旧Expressサーバーの routes/ と同じ意味論をブラウザ内で提供する。
// データは端末内（localStorage）にのみ保存される。

import {
  DEFAULT_CONFIG, DEFAULT_CHILDREN, DEFAULT_TASKS, DEFAULT_GAME_STATE,
} from './lib/defaults.js';
import { recomputeChild } from './lib/progress.js';
import { expandForDay, withCompletionState } from './lib/taskExpand.js';
import { computeStreak } from './lib/streak.js';
import { todayStr, addDays, weekKey, monthKey } from './lib/dates.js';
import { goalView, isGoalAchieved } from './lib/goals.js';
import {
  balance, locate, totalTiles, effectiveMoveCost,
  applyMove, buyItem, equipItem,
} from './lib/game.js';

export const WEEKDAY_JP = ['日', '月', '火', '水', '木', '金', '土'];

const KEY = 'homework-quest:data';
const DATA_VERSION = 2;

function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function currentKey(period, today) {
  return period === 'week' ? weekKey(today) : monthKey(today);
}

function seed() {
  const now = new Date().toISOString();
  return {
    version: DATA_VERSION,
    children: DEFAULT_CHILDREN.map((c) => ({ ...c, createdAt: now })),
    tasks: DEFAULT_TASKS.map((t) => ({ ...t, createdAt: now })),
    completions: [],
    goals: [],
    game: { ...DEFAULT_GAME_STATE, equipped: { ...DEFAULT_GAME_STATE.equipped } },
    config: DEFAULT_CONFIG,
  };
}

// 旧バージョンのデータに、目標・ゲーム欄を後付けする（非破壊マイグレーション）。
function ensureShape(data) {
  let changed = false;
  if (!data.config) { data.config = DEFAULT_CONFIG; changed = true; }
  if (!data.config.game) { data.config.game = DEFAULT_CONFIG.game; changed = true; }
  if (!data.config.goalDefaults) { data.config.goalDefaults = DEFAULT_CONFIG.goalDefaults; changed = true; }
  if (!Array.isArray(data.goals)) { data.goals = []; changed = true; }

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

  if (data.version !== DATA_VERSION) { data.version = DATA_VERSION; changed = true; }
  return { data, changed };
}

function load() {
  try {
    const text = localStorage.getItem(KEY);
    if (text) {
      const parsed = JSON.parse(text);
      if (parsed && Array.isArray(parsed.children)) {
        const { data, changed } = ensureShape(parsed);
        if (changed) save(data);
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

// ---- 今日のタスク ----

export function getToday(childId, date = todayStr()) {
  const data = load();
  const expanded = expandForDay(data.tasks, childId, date);
  const items = withCompletionState(expanded, data.completions, childId, date);
  return { date, childId, items };
}

// ---- 達成（チェック / 取り消し） ----

// チェック時。completion 追加 → child を達成ログから再計算。
// あわせてコイン加算・数値目標の達成ボーナスも処理する。
export function addCompletion({ taskId, childId, date = todayStr() }) {
  const data = load();
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task) throw new Error('task not found');
  const child = data.children.find((c) => c.id === childId);
  if (!child) throw new Error('child not found');

  // 二重達成防止（同じ子・タスク・日付）。
  const existing = data.completions.find(
    (c) => c.taskId === taskId && c.childId === childId && c.date === date,
  );
  if (existing) {
    return { completion: existing, child, leveledUp: false, newBadges: [], coinsGained: 0, goalsAchieved: [] };
  }

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

  // 数値目標の達成ボーナス（未払いのみ、期間一致のもの）。
  const goalsAchieved = [];
  for (const g of data.goals) {
    if (g.kind !== 'points' || g.bonusPaid) continue;
    if (g.periodKey !== currentKey(g.period, date)) continue;
    if (isGoalAchieved(g, data.completions)) {
      g.bonusPaid = true;
      const bonus = data.config.game.goalBonus?.[g.period] || 0;
      data.game.coinsEarned += bonus;
      goalsAchieved.push({ goal: g, bonus });
    }
  }

  save(data);

  const leveledUp = child.level > before.level;
  const newBadges = data.config.badges.filter(
    (b) => child.badges.includes(b.id) && !before.badges.includes(b.id),
  );
  return { completion, child, leveledUp, newBadges, coinsGained: completion.points, goalsAchieved };
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

// ---- 目標（週 / 月） ----

export function getGoalsView(today = todayStr()) {
  const data = load();
  return data.goals
    .filter((g) => g.periodKey === currentKey(g.period, today))
    .map((g) => goalView(g, data.completions));
}

export function addGoal(body, today = todayStr()) {
  const period = body.period === 'month' ? 'month' : 'week';
  const kind = body.kind === 'freetext' ? 'freetext' : 'points';
  const goal = {
    id: uuid(),
    period,
    kind,
    title: String(body.title || '').trim(),
    target: kind === 'points' ? (Number(body.target) || 0) : null,
    periodKey: currentKey(period, today),
    doneManual: false,
    bonusPaid: false,
    createdAt: new Date().toISOString(),
  };
  if (!goal.title) throw new Error('目標を入力してください');
  if (kind === 'points' && goal.target <= 0) throw new Error('目標ポイントを入力してください');
  const data = load();
  data.goals.push(goal);
  save(data);
  return goal;
}

export function deleteGoal(id) {
  const data = load();
  const idx = data.goals.findIndex((g) => g.id === id);
  if (idx < 0) throw new Error('goal not found');
  data.goals.splice(idx, 1);
  save(data);
}

// 自由記述目標の手動チェック（トグル）。初めて達成した時だけボーナス。
export function checkGoal(id) {
  const data = load();
  const g = data.goals.find((x) => x.id === id);
  if (!g) throw new Error('goal not found');
  if (g.kind !== 'points') {
    let bonus = 0;
    if (!g.doneManual) {
      g.doneManual = true;
      if (!g.bonusPaid) {
        g.bonusPaid = true;
        bonus = data.config.game.goalBonus?.[g.period] || 0;
        data.game.coinsEarned = (data.game.coinsEarned || 0) + bonus;
      }
    } else {
      g.doneManual = false;
    }
    save(data);
    return { goal: g, bonus };
  }
  return { goal: g, bonus: 0 };
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
    config: data.config,
    game: g,
  };
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
    goals: Array.isArray(obj.goals) ? obj.goals : [],
    game: obj.game,
    config: obj.config && Array.isArray(obj.config.levels) ? obj.config : DEFAULT_CONFIG,
  };
  const { data } = ensureShape(base);
  save(data);
  return data;
}
