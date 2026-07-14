import { computeLevel } from './levels.js';
import { computeStreak } from './streak.js';
import { evaluateBadges } from './badges.js';

// 達成ログ（completions）を「正」として、その子の xp / level / badges を
// 再計算する。POST/DELETE どちらの後でも同じ関数を通すことで、
// 加算・減算のズレが起きないようにする。
export function recomputeChild(child, completions, config) {
  const mine = completions.filter((c) => c.childId === child.id);
  const xp = mine.reduce((sum, c) => sum + (c.points || 0), 0);
  const level = computeLevel(xp, config.levels).level;
  const streak = computeStreak(mine);
  const badges = evaluateBadges(config.badges, {
    totalCompletions: mine.length,
    streak,
    level,
    xp,
  });
  return { ...child, xp, level, badges };
}
