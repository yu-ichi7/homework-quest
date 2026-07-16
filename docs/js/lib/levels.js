// XP からレベルを算出する。levels は [{ level, minXp, name }] を minXp 昇順で。

export function computeLevel(xp, levels) {
  let current = levels[0];
  for (const lv of levels) {
    if (xp >= lv.minXp) current = lv;
    else break;
  }
  return current;
}

// レベルバー表示用の進捗情報。
export function levelProgress(xp, levels) {
  const current = computeLevel(xp, levels);
  const next = levels.find((lv) => lv.minXp > current.minXp) || null;
  const base = current.minXp;
  const target = next ? next.minXp : current.minXp;
  const span = target - base;
  return {
    level: current.level,
    name: current.name,
    xp,
    currentMin: base,
    nextMin: next ? next.minXp : null,
    xpIntoLevel: xp - base,
    xpForNext: next ? target - xp : 0,
    // 次レベルが無い（最高到達）場合は 1（満タン）。
    ratio: next && span > 0 ? Math.min(1, (xp - base) / span) : 1,
    isMax: !next,
  };
}
