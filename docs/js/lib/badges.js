// バッジ判定。config.badges の rule を、その子の達成状況に対して評価する。
// rule.type:
//   total    … 累計達成回数 >= count
//   streak   … 連続達成日数 >= days
//   level    … 現在レベル >= level
//   points   … 累計XP >= xp
export function isBadgeEarned(badge, ctx) {
  const rule = badge.rule || {};
  switch (rule.type) {
    case 'total':
      return ctx.totalCompletions >= rule.count;
    case 'streak':
      return ctx.streak >= rule.days;
    case 'level':
      return ctx.level >= rule.level;
    case 'points':
      return ctx.xp >= rule.xp;
    default:
      return false;
  }
}

// 現在の状況で獲得済みであるべきバッジ id の一覧。
export function evaluateBadges(badges, ctx) {
  return badges.filter((b) => isBadgeEarned(b, ctx)).map((b) => b.id);
}
