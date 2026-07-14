// ページ間で使う小さな共通ロジック。

// XP からレベル進捗を計算（サーバの lib/levels.js と同じ考え方）。
function levelProgress(xp, levels) {
  let current = levels[0];
  for (const lv of levels) {
    if (xp >= lv.minXp) current = lv;
    else break;
  }
  const next = levels.find((lv) => lv.minXp > current.minXp) || null;
  const span = next ? next.minXp - current.minXp : 0;
  return {
    level: current.level,
    name: current.name,
    xp,
    nextMin: next ? next.minXp : null,
    xpForNext: next ? next.minXp - xp : 0,
    ratio: next && span > 0 ? Math.min(1, (xp - current.minXp) / span) : 1,
    isMax: !next,
  };
}

// 選択中の子どもIDを localStorage で覚える。
const CHILD_KEY = 'hq.selectedChild';
const getSelectedChild = () => localStorage.getItem(CHILD_KEY);
const setSelectedChild = (id) => localStorage.setItem(CHILD_KEY, id);

const WEEKDAY_JP = ['日', '月', '火', '水', '木', '金', '土'];
