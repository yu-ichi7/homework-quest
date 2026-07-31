// 初回起動時にシードするデフォルトデータ。data/*.json が無ければ投入する。

// シューティングゲームの既定パラメータ。すべてここで調整できる。
// 機体性能 = 永続強化（upgrades）＋ 拾ったアイテム。出撃は一律 playCost コイン。
export const DEFAULT_SHOOTER = {
  playCost: 50,           // 1プレイのコイン
  base: {
    lives: 3,             // 初期ライフ
    power: 1,             // 弾の威力
    fireIntervalMs: 380,  // 連射間隔（小さいほど速い）
    bulletSpeed: 380,     // 弾の速さ（px/秒）
    playerSpeed: 200,     // 自機の移動速度（px/秒）
  },
  invincibleMs: 1200,     // 被弾後の無敵時間
  enemyBulletSpeed: 150,  // 敵の弾の速さ（px/秒）
  // 5つのステージ。だんだん敵が速く・多く・よく撃つようになる。
  // duration: ボスが出るまでの時間(ms)。
  stages: [
    {
      name: 'そよかぜ草原', enemySpeed: 70, spawnMs: 1250, toughChance: 0.05,
      enemyFireMs: 2800, duration: 24000, clearBonus: 100,
      boss: { name: 'みどりの守り手', hp: 40, fireMs: 1500, speed: 55, ways: 1 },
    },
    {
      name: 'くもの海', enemySpeed: 85, spawnMs: 1050, toughChance: 0.15,
      enemyFireMs: 2300, duration: 28000, clearBonus: 200,
      boss: { name: 'くもの主', hp: 70, fireMs: 1250, speed: 70, ways: 2 },
    },
    {
      name: 'いなずま谷', enemySpeed: 100, spawnMs: 900, toughChance: 0.25,
      enemyFireMs: 1900, duration: 32000, clearBonus: 300,
      boss: { name: 'かみなり竜', hp: 110, fireMs: 1050, speed: 85, ways: 2 },
    },
    {
      name: 'ほのお火山', enemySpeed: 118, spawnMs: 780, toughChance: 0.38,
      enemyFireMs: 1600, duration: 36000, clearBonus: 400,
      boss: { name: 'マグマ帝王', hp: 160, fireMs: 900, speed: 100, ways: 3 },
    },
    {
      name: 'うちゅう要塞', enemySpeed: 138, spawnMs: 660, toughChance: 0.5,
      enemyFireMs: 1300, duration: 40000, clearBonus: 600,
      boss: { name: '要塞コア', hp: 230, fireMs: 750, speed: 115, ways: 3 },
    },
  ],
  // 永続強化（買うとずっと残る）。レベルごとのコイン。
  upgrades: {
    power: { name: 'ショット強化', icon: '💥', desc: '弾の威力が上がる', costs: [40, 90, 180], perLevel: 1 },
    rapid: { name: '連射速度', icon: '⚡', desc: '弾を速く撃てる', costs: [50, 110, 220], perLevel: -50 },
    life: { name: 'ライフ増加', icon: '❤️', desc: 'ライフが1つ増える', costs: [60, 140, 260], perLevel: 1 },
  },
  enemy: {
    toughHp: 3,
    normalHp: 1,
    scoreNormal: 10,
    scoreTough: 30,
    scoreBoss: 500,
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
  cleared: 0,   // クリア済みの最大ステージ番号（1始まり。0なら未クリア）
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
