import { dayOfWeek } from './dates.js';

// tasks.json から、ある子・ある日付に「今日やること」を展開する。
// routine: days に今日の曜日を含むもの。 spot: date が今日のもの。
// childId 指定のタスクに加え、childId==="all"（きょうだい共通）も対象。
export function expandForDay(tasks, childId, dateStr) {
  const dow = dayOfWeek(dateStr);
  return tasks.filter((t) => {
    if (t.active === false) return false;
    if (t.childId !== 'all' && t.childId !== childId) return false;
    if (t.kind === 'routine') return Array.isArray(t.days) && t.days.includes(dow);
    if (t.kind === 'spot') return t.date === dateStr;
    return false;
  });
}

// 展開したタスクに、その日の達成状況（completions）を合成する。
export function withCompletionState(expanded, completions, childId, dateStr) {
  return expanded.map((t) => {
    const done = completions.find(
      (c) => c.taskId === t.id && c.childId === childId && c.date === dateStr,
    );
    return {
      id: t.id,
      title: t.title,
      icon: t.icon,
      points: t.points,
      kind: t.kind,
      childId: t.childId,
      done: Boolean(done),
      completionId: done ? done.id : null,
    };
  });
}
