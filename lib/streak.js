import { todayStr, addDays } from './dates.js';

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
