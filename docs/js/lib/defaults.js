// 初回起動時にシードするデフォルトデータ。data/*.json が無ければ投入する。

// シューティングゲームの既定パラメータ。すべてここで調整できる。
// 機体性能 = 永続強化（upgrades）＋ プレイごとのブースト（boostTiers）。
export const DEFAULT_SHOOTER = {
  base: {
    lives: 3,             // 初期ライフ
    power: 1,             // 弾の威力
    fireIntervalMs: 380,  // 連射間隔（小さいほど速い）
    bulletSpeed: 380,     // 弾の速さ（px/秒）
    playerSpeed: 200,     // 自機の移動速度（px/秒）
  },
  // プレイ開始時に選ぶブースト。多く払うほどそのプレイだけ強くなる。
  boostTiers: [
    { id: 'normal', name: 'ふつう', cost: 10, power: 0, fireDelta: 0, lives: 0, desc: '基本の機体で出撃' },
    { id: 'strong', name: 'つよい', cost: 30, power: 1, fireDelta: -80, lives: 1, desc: '弾が強く・連射も速い・ライフ+1' },
    { id: 'max', name: 'さいきょう', cost: 60, power: 2, fireDelta: -150, lives: 2, desc: 'フルパワーで出撃！ライフ+2' },
  ],
  // 永続強化（買うとずっと残る）。レベルごとのコイン。
  upgrades: {
    power: { name: 'ショット強化', icon: '💥', desc: '弾の威力が上がる', costs: [40, 90, 180], perLevel: 1 },
    rapid: { name: '連射速度', icon: '⚡', desc: '弾を速く撃てる', costs: [50, 110, 220], perLevel: -50 },
    life: { name: 'ライフ増加', icon: '❤️', desc: 'ライフが1つ増える', costs: [60, 140, 260], perLevel: 1 },
  },
  // 敵の出方。時間が経つほど速く・多くなる。
  enemy: {
    baseSpeed: 70,        // 落下速度（px/秒）
    speedPerMin: 45,      // 1分ごとに増える落下速度
    baseSpawnMs: 1100,    // 出現間隔
    spawnMinMs: 320,      // 出現間隔の下限
    spawnSpeedUpPerMin: 260, // 1分ごとに縮む出現間隔
    toughChancePerMin: 0.18, // 硬い敵が出る確率の増え方（上限0.5）
    toughHp: 3,
    normalHp: 1,
    scoreNormal: 10,
    scoreTough: 30,
  },
  fireIntervalMinMs: 90,  // 連射間隔の下限
  // 敵を倒すと、たまに落とすパワーアップアイテム（そのプレイの間ずっと効く）。
  items: {
    dropChanceNormal: 0.16,  // ふつうの敵が落とす確率
    dropChanceTough: 0.5,    // かたい敵が落とす確率
    fallSpeed: 90,           // 落ちる速さ（px/秒）
    maxLives: 6,             // ライフの上限
    types: [
      { id: 'power', name: 'パワーアップ', sprite: 'itemPower', weight: 3, power: 1 },
      { id: 'rapid', name: 'れんしゃアップ', sprite: 'itemRapid', weight: 3, fireDelta: -60 },
      { id: 'life', name: 'ライフ回復', sprite: 'itemLife', weight: 2, lives: 1 },
    ],
  },
};

// ペット育成（たまごっち系）の既定パラメータ。
// お腹・仲良し度は 1日4回（朝6時・昼12時・午後3時・夕方6時）に少しずつ減る。
export const DEFAULT_PET = {
  feedCost: 8,                                  // ごはん1回のコイン
  treatCost: 15,                                // ごちそう1回のコイン
  treatEffect: { hunger: 50, happiness: 30, care: 2 }, // ごちそうの回復量とお世話カウント
  cleanCost: 3,                                 // おそうじ1回のコイン
  checkpoints: [6, 12, 15, 18],                 // 減衰が起きる時刻（時）
  decayPerCheckpoint: { hunger: 8, happiness: 3 }, // 1チェックポイントごとの減り
  neglectThreshold: 30,                         // これ未満なら「放置」チェックポイント
  growthToEvolve: [40, 70],                     // stage0→1, stage1→2 に必要な成長ポイント
  // アクションごとの成長ポイント。満腹（Full）でも餌はあげられるが伸びは小さい。
  growthPerAction: { feed: 3, feedFull: 1, treat: 8, treatFull: 3, play: 2, clean: 1 },
  formNeglectLimit: 5,                          // 放置チェックポイントがこれ以下なら「元気」
  poopPerDay: 1,                                // 1日（朝6時）ごとに増えるうんちの数
  maxPoop: 5,                                   // うんちの上限
  poopHappinessPenalty: 1,                      // うんち1つあたり、仲良し度の減りが増える量
};

export const DEFAULT_GAME_STATE = {
  coinsEarned: 0,
  coinsSpent: 0,
};

// シューティングの記録と永続強化。
export const DEFAULT_SHOOTER_STATE = {
  upgrades: { power: 0, rapid: 0, life: 0 },
  highScore: 0,
  totalKills: 0,
  plays: 0,
};

export const DEFAULT_CONFIG = {
  shooter: DEFAULT_SHOOTER,
  pet: DEFAULT_PET,
  iceCreamStreak: 10, // このタスクが何連続に達するごとにアイスクリームバッジ1個
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
