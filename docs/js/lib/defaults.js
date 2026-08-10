// 初回起動時にシードするデフォルトデータ。data/*.json が無ければ投入する。

// シューティングゲームの既定パラメータ。すべてここで調整できる。
// 機体性能 = 永続強化（upgrades）＋ 拾ったアイテム。出撃は一律 playCost コイン。
export const DEFAULT_SHOOTER = {
  playCost: 30,           // 1プレイのコイン
  base: {
    lives: 3,             // 初期ライフ
    power: 1,             // 弾の威力
    fireIntervalMs: 380,  // 連射間隔（小さいほど速い）
    bulletSpeed: 380,     // 弾の速さ（px/秒）
    playerSpeed: 200,     // 自機の移動速度（px/秒）
  },
  invincibleMs: 1200,     // 被弾後の無敵時間
  enemyBulletSpeed: 150,  // 敵の弾の速さ（px/秒）の既定値（各ステージで上書きされる）
  // 敵の種類。ステージごとの enemyMix でどの種類がどれくらい出るか決まる。
  // dropChance: 倒したときにアイテムを落とす確率。zigzagAmp: 左右に揺れる幅(px)。
  // aimedFireMs: この間隔で自機を狙って弾を撃つ（gunnerのみ）。
  enemyTypes: {
    normal: { name: 'ふつう', hp: 1, speedMul: 1.0, sprite: 'enemyNormal', dropChance: 0.14 },
    tough: { name: 'かたい', hp: 3, speedMul: 0.75, sprite: 'enemyTough', dropChance: 0.45 },
    swift: { name: 'すばやい', hp: 1, speedMul: 1.55, sprite: 'enemySwift', zigzagAmp: 70, dropChance: 0.12 },
    gunner: { name: '狙撃', hp: 2, speedMul: 0.85, sprite: 'enemyGunner', aimedFireMs: 2200, dropChance: 0.3 },
  },
  // 5つのステージ。だんだん敵が速く・多く・よく撃つようになり、種類も増える。
  // duration: ボスが出るまでの時間(ms)。clearScore: ノーミスでクリアしたときの満点。
  // enemyMix: 出現する敵の種類と重み。enemyFireCount: 1回の攻撃で何体が同時に撃つか。
  // bgTheme: ステージごとの背景の見た目。boss.sprite: ボスのドット絵。
  stages: [
    {
      name: '緑の草原', bgTheme: 'meadow',
      enemySpeed: 85, spawnMs: 950,
      enemyFireMs: 2000, enemyFireCount: 1, enemyBulletSpeed: 165,
      enemyMix: [
        { type: 'normal', weight: 8 },
        { type: 'tough', weight: 2 },
      ],
      duration: 72000, clearScore: 10000,
      boss: { name: '緑の守護者', sprite: 'bossMeadow', hp: 160, fireMs: 900, speed: 90, ways: 3 },
    },
    {
      name: '雲の海', bgTheme: 'clouds',
      enemySpeed: 105, spawnMs: 800,
      enemyFireMs: 1600, enemyFireCount: 1, enemyBulletSpeed: 185,
      enemyMix: [
        { type: 'normal', weight: 5 },
        { type: 'tough', weight: 2 },
        { type: 'swift', weight: 3 },
      ],
      duration: 84000, clearScore: 12000,
      boss: { name: '雲の主', sprite: 'bossClouds', hp: 260, fireMs: 750, speed: 110, ways: 4 },
    },
    {
      name: '稲妻の谷', bgTheme: 'storm',
      enemySpeed: 125, spawnMs: 680,
      enemyFireMs: 1300, enemyFireCount: 2, enemyBulletSpeed: 205,
      enemyMix: [
        { type: 'normal', weight: 4 },
        { type: 'tough', weight: 2 },
        { type: 'swift', weight: 3 },
        { type: 'gunner', weight: 2 },
      ],
      duration: 96000, clearScore: 15000,
      boss: { name: '雷竜', sprite: 'bossStorm', hp: 380, fireMs: 620, speed: 130, ways: 4 },
    },
    {
      name: '炎の火山', bgTheme: 'volcano',
      enemySpeed: 145, spawnMs: 560,
      enemyFireMs: 1050, enemyFireCount: 2, enemyBulletSpeed: 225,
      enemyMix: [
        { type: 'normal', weight: 3 },
        { type: 'tough', weight: 3 },
        { type: 'swift', weight: 2 },
        { type: 'gunner', weight: 3 },
      ],
      duration: 108000, clearScore: 18000,
      boss: { name: '溶岩帝王', sprite: 'bossVolcano', hp: 520, fireMs: 520, speed: 150, ways: 5 },
    },
    {
      name: '宇宙要塞', bgTheme: 'space',
      enemySpeed: 165, spawnMs: 460,
      enemyFireMs: 850, enemyFireCount: 3, enemyBulletSpeed: 245,
      enemyMix: [
        { type: 'normal', weight: 2 },
        { type: 'tough', weight: 3 },
        { type: 'swift', weight: 2 },
        { type: 'gunner', weight: 4 },
      ],
      duration: 120000, clearScore: 20000,
      boss: { name: '要塞中枢', sprite: 'bossFortress', hp: 700, fireMs: 420, speed: 170, ways: 6 },
    },
  ],
  // 得点の決まり方：ステージの満点 × 進み具合 −（被弾ごとの減点）。
  // 進み具合はボス出現までで半分、ボスの体力を削りきると満点になる。
  scoring: {
    damagePenaltyRatio: 0.08, // 1回被弾するごとに満点の8%を減点
    wavePhaseRatio: 0.5,      // ボス出現までで稼げる割合
  },
  // 永続強化（買うとずっと残る）。レベルごとのコイン。
  upgrades: {
    power: { name: 'ショット強化', icon: '💥', desc: '弾の威力が上がる', costs: [40, 90, 180], perLevel: 1 },
    rapid: { name: '連射速度', icon: '⚡', desc: '弾を速く撃てる', costs: [50, 110, 220], perLevel: -50 },
    life: { name: 'ライフ増加', icon: '❤️', desc: 'ライフが1つ増える', costs: [60, 140, 260], perLevel: 1 },
    escort: { name: '護衛機', icon: '🛰️', desc: '機体の周りを飛び、自動で弾を撃つ小さな護衛機がつく', costs: [500], perLevel: 1 },
  },
  // 出撃前に買う消耗アイテム。体当たりした敵をノーダメージで倒せる（1回で1つ消費）。
  ramItem: { cost: 10, max: 5 },
  fireIntervalMinMs: 90,  // 連射間隔の下限
  // 敵を倒すと、たまに落とすパワーアップアイテム（そのプレイの間ずっと効く）。
  items: {
    dropChanceNormal: 0.14,  // 敵ごとの dropChance が無いときの既定値
    fallSpeed: 90,           // 落ちる速さ（px/秒）
    maxLives: 6,             // ライフの上限
    types: [
      { id: 'power', name: '威力アップ', sprite: 'itemPower', weight: 3, power: 1 },
      { id: 'rapid', name: '連射アップ', sprite: 'itemRapid', weight: 3, fireDelta: -60 },
      { id: 'life', name: '体力回復', sprite: 'itemLife', weight: 2, lives: 1 },
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

// デイリーボーナス（毎日アプリを開くともらえる）。
// 連続日数が伸びるほど基本コインが増え（capDaysで頭打ち）、
// おまけの当たり（bonusCoins）も出やすくなる。milestones の日はさらに特別ボーナス。
export const DEFAULT_LOGIN_BONUS = {
  baseCoins: 5,
  perDayBonus: 2,
  capDays: 14,
  bonusChanceBase: 0.15,
  bonusChancePerDay: 0.03,
  bonusChanceMax: 0.6,
  bonusCoins: 20,
  milestones: [7, 14, 30, 60, 100],
  milestoneBonusCoins: 50,
};

export const DEFAULT_LOGIN_STATE = {
  streak: 0,
  longestStreak: 0,
  lastClaimDate: null,
  totalClaims: 0,
};

// シューティングの記録と永続強化。
export const DEFAULT_SHOOTER_STATE = {
  upgrades: { power: 0, rapid: 0, life: 0, escort: 0 },
  highScore: 0,
  totalKills: 0,
  plays: 0,
  cleared: 0,   // クリア済みの最大ステージ番号（1始まり。0なら未クリア）
};

export const DEFAULT_CONFIG = {
  shooter: DEFAULT_SHOOTER,
  pet: DEFAULT_PET,
  loginBonus: DEFAULT_LOGIN_BONUS,
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
