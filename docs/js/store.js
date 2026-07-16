// localStorage を使ったデータストア。
// 旧Expressサーバーの routes/ と同じ意味論をブラウザ内で提供する。
// データは端末内（localStorage）にのみ保存される。

import { DEFAULT_CONFIG, DEFAULT_CHILDREN, DEFAULT_TASKS } from './lib/defaults.js';
import { recomputeChild } from './lib/progress.js';
import { expandForDay, withCompletionState } from './lib/taskExpand.js';
import { computeStreak } from './lib/streak.js';
import { todayStr, addDays } from './lib/dates.js';

export const WEEKDAY_JP = ['日', '月', '火', '水', '木', '金', '土'];

const KEY = 'homework-quest:data';
const DATA_VERSION = 1;

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
    config: DEFAULT_CONFIG,
  };
}

function load() {
  try {
    const text = localStorage.getItem(KEY);
    if (text) {
      const data = JSON.parse(text);
      if (data && Array.isArray(data.children)) return data;
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
// レベルアップ / 新バッジを検出して返し、画面のお祝い演出に使う。
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
  if (existing) return { completion: existing, child, leveledUp: false, newBadges: [] };

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
  save(data);

  const leveledUp = child.level > before.level;
  const newBadges = data.config.badges.filter(
    (b) => child.badges.includes(b.id) && !before.badges.includes(b.id),
  );
  return { completion, child, leveledUp, newBadges };
}

// チェック外し（誤タップ取り消し）。completion 削除 → child 再計算。
export function removeCompletion(id) {
  const data = load();
  const idx = data.completions.findIndex((c) => c.id === id);
  if (idx < 0) throw new Error('completion not found');
  const [removed] = data.completions.splice(idx, 1);

  const child = data.children.find((c) => c.id === removed.childId);
  if (child) Object.assign(child, recomputeChild(child, data.completions, data.config));
  save(data);
  return { ok: true, child };
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
  const data = {
    version: obj.version || DATA_VERSION,
    children: obj.children,
    tasks: obj.tasks,
    completions: obj.completions,
    config: obj.config && Array.isArray(obj.config.levels) ? obj.config : DEFAULT_CONFIG,
  };
  save(data);
  return data;
}
