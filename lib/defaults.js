// 初回起動時にシードするデフォルトデータ。data/*.json が無ければ投入する。

export const DEFAULT_CONFIG = {
  levels: [
    { level: 1, minXp: 0, name: '駆け出し' },
    { level: 2, minXp: 30, name: '見習い' },
    { level: 3, minXp: 80, name: '一人前' },
    { level: 4, minXp: 160, name: 'ベテラン' },
    { level: 5, minXp: 280, name: 'エキスパート' },
    { level: 6, minXp: 450, name: '達人' },
    { level: 7, minXp: 700, name: 'マスター' },
    { level: 8, minXp: 1000, name: 'レジェンド' },
  ],
  badges: [
    { id: 'first-clear', name: '初めの一歩', icon: '🌱', desc: '初めてタスクを達成した', rule: { type: 'total', count: 1 } },
    { id: 'clear-10', name: 'コツコツ', icon: '🔟', desc: '合計10回達成した', rule: { type: 'total', count: 10 } },
    { id: 'clear-50', name: '頑張り屋', icon: '💪', desc: '合計50回達成した', rule: { type: 'total', count: 50 } },
    { id: 'clear-100', name: '強者', icon: '🏆', desc: '合計100回達成した', rule: { type: 'total', count: 100 } },
    { id: 'streak-3', name: '三日坊主脱出', icon: '🔥', desc: '3日連続で達成した', rule: { type: 'streak', days: 3 } },
    { id: 'streak-7', name: '1週間継続', icon: '⭐', desc: '7日連続で達成した', rule: { type: 'streak', days: 7 } },
    { id: 'streak-14', name: '2週間の鉄人', icon: '🥇', desc: '14日連続で達成した', rule: { type: 'streak', days: 14 } },
    { id: 'level-5', name: 'エキスパート', icon: '🎖️', desc: 'レベル5に到達した', rule: { type: 'level', level: 5 } },
  ],
};

// 一人用。名前・色は「設定」画面で変更できる。
export const DEFAULT_CHILDREN = [
  { id: 'child-1', name: '自分', color: '#6366f1', xp: 0, level: 1, badges: [], createdAt: null },
];

// 定番ルーティンのサンプル。曜日 0=日..6=土。
export const DEFAULT_TASKS = [
  { id: 'seed-hw', childId: 'all', title: '宿題', icon: '📚', points: 10, kind: 'routine', days: [1, 2, 3, 4, 5], active: true, createdAt: null },
  { id: 'seed-dishes', childId: 'all', title: '食器下げ', icon: '🍽️', points: 5, kind: 'routine', days: [0, 1, 2, 3, 4, 5, 6], active: true, createdAt: null },
  { id: 'seed-bath', childId: 'all', title: '風呂掃除', icon: '🛁', points: 8, kind: 'routine', days: [0, 3, 6], active: true, createdAt: null },
  { id: 'seed-read', childId: 'all', title: '読書', icon: '📖', points: 5, kind: 'routine', days: [1, 2, 3, 4, 5], active: true, createdAt: null },
];
