import { todayStr, addDays, dayOfWeek } from './dates.js';

// completions（その子の達成ログ）から連続達成日数を計算する。
// 「今日」に達成があればそこから、なければ「昨日」から遡って数える
// （その日はまだ手をつけていないだけ、という扱いにして途切れさせない）。
export function computeStreak(completions, today = todayStr()) {
  const days = new Set(completions.map((c) => c.date));
  if (days.size === 0) return 0;

  let cursor;
  if (days.has(today)) cursor = today;
  else if (days.has(addDays(today, -1))) cursor = addDays(today, -1);
  else return 0;

  let count = 0;
  while (days.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

// ---- タスク別の継続 ----

// dateStr 当日を含めて、それ以前で最初にくる「予定曜日」の日付を返す。
function prevScheduledOnOrBefore(dateStr, days) {
  let cursor = dateStr;
  for (let i = 0; i < 7; i += 1) {
    if (days.includes(dayOfWeek(cursor))) return cursor;
    cursor = addDays(cursor, -1);
  }
  return null;
}

// dateStr より前で最初にくる「予定曜日」の日付を返す。
function prevScheduledBefore(dateStr, days) {
  return prevScheduledOnOrBefore(addDays(dateStr, -1), days);
}

// そのタスクを今まで何回達成したか（累計）。
export function taskTotalCount(task, completions) {
  return completions.filter((c) => c.taskId === task.id).length;
}

// そのタスクの「予定日ベースの連続達成数」。
// routine は task.days の曜日だけをさかのぼって数える。今日が予定日でまだ未達成でも
// 途切れ扱いにせず、一つ前の予定日から数え始める（グレース）。
// spot は達成済みなら1、なければ0。
export function taskStreak(task, completions, today = todayStr()) {
  const doneDates = new Set(
    completions.filter((c) => c.taskId === task.id).map((c) => c.date),
  );
  if (doneDates.size === 0) return 0;

  if (task.kind !== 'routine' || !Array.isArray(task.days) || task.days.length === 0) {
    return doneDates.size > 0 ? 1 : 0;
  }

  let cursor = prevScheduledOnOrBefore(today, task.days);
  if (cursor === today && !doneDates.has(today)) {
    cursor = prevScheduledBefore(today, task.days);
  }

  let count = 0;
  while (cursor && doneDates.has(cursor)) {
    count += 1;
    cursor = prevScheduledBefore(cursor, task.days);
  }
  return count;
}

// 炎の見た目の段階（0=なし, 1=小, 2=中, 3=大）。
export function flameTier(streak) {
  if (streak >= 7) return 3;
  if (streak >= 3) return 2;
  if (streak >= 1) return 1;
  return 0;
}
