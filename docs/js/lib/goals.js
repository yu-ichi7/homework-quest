// 週/月の目標ロジック。純粋関数。
import { weekKey, monthKey } from './dates.js';

// その目標の期間に該当する completions の合計ポイント。
export function goalProgress(goal, completions) {
  const keyFn = goal.period === 'week' ? weekKey : monthKey;
  return completions
    .filter((c) => keyFn(c.date) === goal.periodKey)
    .reduce((s, c) => s + (c.points || 0), 0);
}

// 達成しているか。points=目標到達 / freetext=手動チェック。
export function isGoalAchieved(goal, completions) {
  if (goal.kind === 'freetext') return Boolean(goal.doneManual);
  return goalProgress(goal, completions) >= (goal.target || 0);
}

// 表示用に進捗を合成する。
export function goalView(goal, completions) {
  const current = goal.kind === 'points' ? goalProgress(goal, completions) : 0;
  const achieved = isGoalAchieved(goal, completions);
  const ratio = goal.kind === 'points' && goal.target > 0
    ? Math.min(1, current / goal.target)
    : (achieved ? 1 : 0);
  return { ...goal, current, achieved, ratio };
}
