import { addDays, dayOfWeek } from './dates.js';

// 「週に◯回（曜日は決めない）」の定番タスク。
// データは定番(routine)のまま timesPerWeek を足しただけ。days には全曜日を入れておくので、
// timesPerWeek を知らない古い版で開いても「毎日出るタスク」として壊れずに表示される。
// 週は月曜はじまり（月〜日）で数える。

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function isWeekly(task) {
  return task.kind === 'routine' && Number(task.timesPerWeek) >= 1;
}

// dateStr を含む週の月曜日。
export function weekStart(dateStr) {
  return addDays(dateStr, -((dayOfWeek(dateStr) + 6) % 7));
}

// dateStr を含む週（月〜日）に、そのタスクを何回やったか。childId を渡すとその子の分だけ。
// exceptDate を渡すと、その日の分は数えない。
export function weekCount(task, completions, dateStr, { childId, exceptDate } = {}) {
  const from = weekStart(dateStr);
  const to = addDays(from, 6);
  return completions.filter((c) => c.taskId === task.id
    && c.date >= from && c.date <= to
    && (!childId || c.childId === childId)
    && c.date !== exceptDate).length;
}
