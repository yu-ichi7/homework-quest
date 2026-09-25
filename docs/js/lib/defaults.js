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
    escort: { name: '護衛機', icon: '🛰️', desc: '機体の周りを飛び、自動で弾を撃つ小さな護衛機が増える（最大3体）', costs: [500, 500, 500], perLevel: 1 },
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

// シューティングDX（リニューアル版）の既定パラメータ。元のシューティングとは別のゲームとして遊ぶ。
// 武器の持ち替え・特殊アイテム・10種類の敵・中ボス・攻撃パターンの違うボスがある。
// 見た目はドット絵ではなく shooterArt.js が図形で描く。
// 永続強化（upgrades）は元のシューティングとは別に持つ（DXは強化0から始まる）。
export const DEFAULT_SHOOTER_DX = {
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
  // w/h: 当たり判定の大きさ(px)。見た目は shooterArt.js が種類ごとに描く。
  // dropChance: 倒したときにアイテムを落とす確率。zigzagAmp: 左右に揺れる幅(px)。
  // aimedFireMs: この間隔で自機を狙って弾を撃つ。move: 動き方（省略時はまっすぐ落ちる）。
  // noEscapeDamage: 画面の外へ抜けてもダメージにならない（通り過ぎるだけの敵）。
  enemyTypes: {
    normal: { name: 'ふつう', hp: 1, speedMul: 1.0, w: 26, h: 22, dropChance: 0.14 },
    tough: { name: 'かたい', hp: 3, speedMul: 0.75, w: 34, h: 26, dropChance: 0.45 },
    swift: { name: 'すばやい', hp: 1, speedMul: 1.55, w: 22, h: 18, zigzagAmp: 70, dropChance: 0.12 },
    gunner: { name: '狙撃', hp: 2, speedMul: 0.85, w: 26, h: 22, aimedFireMs: 2200, dropChance: 0.3 },
    // いったん止まって狙いを定め、自機めがけて急降下する。
    charger: {
      name: '突撃', hp: 2, speedMul: 0.9, w: 26, h: 24, move: 'charge',
      aimMs: 600, dashSpeed: 330, dropChance: 0.25, noEscapeDamage: true,
    },
    // 倒すと小さい子機2体に分かれる。
    splitter: { name: '分裂', hp: 2, speedMul: 0.8, w: 28, h: 22, splitInto: 'mini', dropChance: 0.2 },
    mini: { name: '子機', hp: 1, speedMul: 1.3, w: 16, h: 14, dropChance: 0.05, noEscapeDamage: true },
    // 正面（まっすぐの弾）をはじく盾を持つ。斜めの弾・ホーミングは効く。はじくと盾がけずれる。
    shielded: { name: '盾持ち', hp: 2, speedMul: 0.7, w: 30, h: 26, shieldHp: 6, dropChance: 0.35 },
    // 5機が列になって蛇行してくる。全滅させるとアイテム確定。
    formation: {
      name: '編隊', hp: 1, speedMul: 1.0, w: 20, h: 16, move: 'formation',
      groupSize: 5, dropChance: 0, noEscapeDamage: true,
    },
    // ゆっくり漂い、壊すと周りに弾をばらまく。
    mine: { name: '機雷', hp: 3, speedMul: 0.45, w: 22, h: 22, burst: 8, dropChance: 0.2 },
  },
  // 5つのステージ。だんだん敵が速く・多く・よく撃つようになり、種類も増える。
  // duration: ボスが出るまでの時間(ms)。clearScore: ノーミスでクリアしたときの満点。
  // enemyMix: 出現する敵の種類と重み。enemyFireCount: 1回の攻撃で何体が同時に撃つか。
  // bgTheme: ステージごとの背景の見た目。
  // midboss: ステージの途中（duration の midbossAt 割合の時点）に1体だけ出る中ボス。
  // boss.pattern: ボスの攻撃パターン（shooterDx.js の BOSS_PATTERNS）。HPが半分を切ると怒りモード。
  stages: [
    {
      name: '緑の草原', bgTheme: 'meadow',
      enemySpeed: 85, spawnMs: 950,
      enemyFireMs: 2000, enemyFireCount: 1, enemyBulletSpeed: 165,
      enemyMix: [
        { type: 'normal', weight: 7 },
        { type: 'tough', weight: 2 },
        { type: 'formation', weight: 1 },
      ],
      duration: 72000, clearScore: 10000,
      midboss: { name: '森の番兵', hp: 40 },
      boss: { name: '緑の守護者', pattern: 'leaves', hp: 160, fireMs: 900, speed: 90, ways: 5 },
    },
    {
      name: '雲の海', bgTheme: 'clouds',
      enemySpeed: 105, spawnMs: 800,
      enemyFireMs: 1600, enemyFireCount: 1, enemyBulletSpeed: 185,
      enemyMix: [
        { type: 'normal', weight: 4 },
        { type: 'tough', weight: 2 },
        { type: 'swift', weight: 2 },
        { type: 'charger', weight: 1 },
        { type: 'splitter', weight: 1 },
        { type: 'formation', weight: 1 },
      ],
      duration: 84000, clearScore: 12000,
      midboss: { name: '雲の番兵', hp: 60 },
      boss: { name: '雲の主', pattern: 'thunder', hp: 260, fireMs: 1000, speed: 110, ways: 4 },
    },
    {
      name: '稲妻の谷', bgTheme: 'storm',
      enemySpeed: 125, spawnMs: 680,
      enemyFireMs: 1300, enemyFireCount: 2, enemyBulletSpeed: 205,
      enemyMix: [
        { type: 'normal', weight: 3 },
        { type: 'tough', weight: 2 },
        { type: 'swift', weight: 2 },
        { type: 'gunner', weight: 2 },
        { type: 'charger', weight: 2 },
        { type: 'splitter', weight: 1 },
        { type: 'shielded', weight: 1 },
        { type: 'formation', weight: 1 },
      ],
      duration: 96000, clearScore: 15000,
      midboss: { name: '雷の番兵', hp: 90 },
      boss: { name: '雷竜', pattern: 'zigzag', hp: 380, fireMs: 700, speed: 130, ways: 3 },
    },
    {
      name: '炎の火山', bgTheme: 'volcano',
      enemySpeed: 145, spawnMs: 560,
      enemyFireMs: 1050, enemyFireCount: 2, enemyBulletSpeed: 225,
      enemyMix: [
        { type: 'normal', weight: 2 },
        { type: 'tough', weight: 2 },
        { type: 'swift', weight: 2 },
        { type: 'gunner', weight: 2 },
        { type: 'charger', weight: 2 },
        { type: 'splitter', weight: 2 },
        { type: 'shielded', weight: 2 },
        { type: 'mine', weight: 1 },
        { type: 'formation', weight: 1 },
      ],
      duration: 108000, clearScore: 18000,
      midboss: { name: '炎の番兵', hp: 120 },
      boss: { name: '溶岩帝王', pattern: 'lava', hp: 520, fireMs: 900, speed: 120, ways: 3 },
    },
    {
      name: '宇宙要塞', bgTheme: 'space',
      enemySpeed: 165, spawnMs: 460,
      enemyFireMs: 850, enemyFireCount: 3, enemyBulletSpeed: 245,
      enemyMix: [
        { type: 'normal', weight: 1 },
        { type: 'tough', weight: 2 },
        { type: 'swift', weight: 2 },
        { type: 'gunner', weight: 3 },
        { type: 'charger', weight: 2 },
        { type: 'splitter', weight: 2 },
        { type: 'shielded', weight: 2 },
        { type: 'mine', weight: 2 },
        { type: 'formation', weight: 1 },
      ],
      duration: 120000, clearScore: 20000,
      midboss: { name: '要塞の番兵', hp: 160 },
      boss: { name: '要塞中枢', pattern: 'spiral', hp: 700, fireMs: 1500, speed: 60, ways: 2 },
    },
  ],
  midbossAt: 0.45,   // ボス出現までの時間のこの割合の時点で中ボスが出る
  midbossStayMs: 15000, // 倒せないまま、この時間がたつと中ボスは帰っていく
  // 得点の決まり方：ステージの満点 × 進み具合 −（被弾ごとの減点）。
  // 進み具合はボス出現までで半分、ボスの体力を削りきると満点になる。
  scoring: {
    damagePenaltyRatio: 0.08, // 1回被弾するごとに満点の8%を減点
    wavePhaseRatio: 0.5,      // ボス出現までで稼げる割合
  },
  // 永続強化（買うとずっと残る）。種類・値段は元のシューティングと同じだが、レベルはDX専用。
  upgrades: DEFAULT_SHOOTER.upgrades,
  // 出撃前に買う消耗アイテム。体当たりした敵をノーダメージで倒せる（1回で1つ消費）。
  ramItem: { cost: 10, max: 5 },
  fireIntervalMinMs: 90,  // 連射間隔の下限
  // 敵を倒すと、たまに落とすアイテム（効果はそのプレイの間だけ）。
  // weapon: 武器を持ち替える／同じ武器ならレベルアップ（最大 weaponMaxLevel）。
  // effect: 取った瞬間に発動する特殊効果。durationMs はその効果の続く時間。
  // label / icon と color は見た目（shooterArt.js が丸いバッジとして描く）。
  items: {
    dropChanceNormal: 0.14,  // 敵ごとの dropChance が無いときの既定値
    fallSpeed: 90,           // 落ちる速さ（px/秒）
    maxLives: 6,             // ライフの上限
    weaponMaxLevel: 3,
    bombBossDamageRatio: 0.08, // ボムがボス・中ボスに与えるダメージ（最大HPに対する割合）
    types: [
      { id: 'spread', name: '拡散ショット', weapon: 'spread', label: '拡', color: '#ef4444', weight: 2.2 },
      { id: 'laser', name: 'レーザー', weapon: 'laser', label: '光', color: '#3b82f6', weight: 2.2 },
      { id: 'homing', name: 'ホーミング', weapon: 'homing', label: '追', color: '#22c55e', weight: 2.2 },
      { id: 'rapid', name: '連射アップ', icon: '⚡', color: '#f59e0b', weight: 2, fireDelta: -50 },
      { id: 'life', name: '体力回復', icon: '❤️', color: '#fb7185', weight: 1.5, lives: 1 },
      { id: 'shield', name: 'シールド', icon: '🛡️', color: '#38bdf8', weight: 1.5, effect: 'shield' },
      { id: 'bomb', name: 'ボム', icon: '💣', color: '#a855f7', weight: 1, effect: 'bomb' },
      { id: 'magnet', name: 'マグネット', icon: '🧲', color: '#f472b6', weight: 1, effect: 'magnet', durationMs: 10000 },
      { id: 'slow', name: 'スロー', icon: '⏳', color: '#facc15', weight: 1, effect: 'slow', durationMs: 5000 },
      { id: 'star', name: '無敵スター', icon: '⭐', color: '#fde047', weight: 0.6, effect: 'star', durationMs: 5000 },
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

// シューティングDXの記録と永続強化（元のシューティングとは別。0から始まる）。
export const DEFAULT_SHOOTER_DX_STATE = {
  upgrades: { power: 0, rapid: 0, life: 0, escort: 0 },
  highScore: 0,
  totalKills: 0,
  plays: 0,
  cleared: 0,
};

// リズムゲーム。曲は音声ファイルではなく、Web Audio のオシレーターで
// その場で鳴らす（＝ファイル不要・著作権問題なし・音とノーツが絶対にズレない）。
// 旋律はすべて著作権の切れた童謡・クラシック。
// melody の書式は [拍, 音名, 長さ(拍)]。density が大きいほどノーツが細かく拾われる。
export const DEFAULT_RHYTHM = {
  playCost: 20,           // 1回演奏するのに払うコイン
  kaFromNote: 'G4',       // これ以上の高さの音は「カッ（青・右）」になる
  leadSec: 2.0,           // ノーツが画面に見えている時間（秒）
  greatRatio: 0.6,        // great は perfect の何割ぶんの得点か
  clearRatio: 0.6,        // 満点の何割でクリア（次の曲が開く）か
  judge: { perfectMs: 75, greatMs: 150, windowMs: 200 },
  songs: [
    {
      id: 'frog', name: 'かえるの合唱', bpm: 96,
      density: 1, repeat: 2, lengthBeats: 28, clearScore: 10000,
      melody: [
        [0, 'C4', 1], [1, 'D4', 1], [2, 'E4', 1], [3, 'F4', 1],
        [4, 'E4', 1], [5, 'D4', 1], [6, 'C4', 2],
        [8, 'E4', 1], [9, 'F4', 1], [10, 'G4', 1], [11, 'A4', 1],
        [12, 'G4', 1], [13, 'F4', 1], [14, 'E4', 2],
        [16, 'C4', 1], [17, 'C4', 1], [18, 'C4', 1], [19, 'C4', 1],
        [20, 'C4', 0.5], [20.5, 'C4', 0.5], [21, 'D4', 0.5], [21.5, 'D4', 0.5],
        [22, 'E4', 0.5], [22.5, 'E4', 0.5], [23, 'F4', 0.5], [23.5, 'F4', 0.5],
        [24, 'E4', 1], [25, 'D4', 1], [26, 'C4', 2],
      ],
    },
    {
      id: 'twinkle', name: 'きらきら星', bpm: 108,
      density: 1, repeat: 1, lengthBeats: 48, clearScore: 12000,
      melody: [
        [0, 'C4', 1], [1, 'C4', 1], [2, 'G4', 1], [3, 'G4', 1],
        [4, 'A4', 1], [5, 'A4', 1], [6, 'G4', 2],
        [8, 'F4', 1], [9, 'F4', 1], [10, 'E4', 1], [11, 'E4', 1],
        [12, 'D4', 1], [13, 'D4', 1], [14, 'C4', 2],
        [16, 'G4', 1], [17, 'G4', 1], [18, 'F4', 1], [19, 'F4', 1],
        [20, 'E4', 1], [21, 'E4', 1], [22, 'D4', 2],
        [24, 'G4', 1], [25, 'G4', 1], [26, 'F4', 1], [27, 'F4', 1],
        [28, 'E4', 1], [29, 'E4', 1], [30, 'D4', 2],
        [32, 'C4', 1], [33, 'C4', 1], [34, 'G4', 1], [35, 'G4', 1],
        [36, 'A4', 1], [37, 'A4', 1], [38, 'G4', 2],
        [40, 'F4', 1], [41, 'F4', 1], [42, 'E4', 1], [43, 'E4', 1],
        [44, 'D4', 1], [45, 'D4', 1], [46, 'C4', 2],
      ],
    },
    {
      id: 'saints', name: '聖者の行進', bpm: 120,
      density: 1, repeat: 1, lengthBeats: 48, clearScore: 15000,
      melody: [
        [0, 'C4', 1], [1, 'E4', 1], [2, 'F4', 1], [3, 'G4', 4],
        [8, 'C4', 1], [9, 'E4', 1], [10, 'F4', 1], [11, 'G4', 4],
        [16, 'C4', 1], [17, 'E4', 1], [18, 'F4', 1], [19, 'G4', 2],
        [21, 'E4', 1], [22, 'C4', 1], [23, 'E4', 1], [24, 'D4', 3],
        [28, 'E4', 2], [30, 'E4', 1], [31, 'D4', 1],
        [32, 'C4', 1], [33, 'C4', 1], [34, 'E4', 1], [35, 'G4', 2],
        [37, 'G4', 1], [38, 'F4', 1], [39, 'E4', 1], [40, 'F4', 1],
        [41, 'G4', 1], [42, 'E4', 1], [43, 'C4', 1], [44, 'D4', 1], [45, 'C4', 3],
      ],
    },
    {
      id: 'elise', name: 'エリーゼのために', bpm: 126,
      density: 2, repeat: 2, lengthBeats: 24, clearScore: 18000,
      melody: [
        [0, 'E5', 0.5], [0.5, 'D#5', 0.5], [1, 'E5', 0.5], [1.5, 'D#5', 0.5],
        [2, 'E5', 0.5], [2.5, 'B4', 0.5], [3, 'D5', 0.5], [3.5, 'C5', 0.5],
        [4, 'A4', 1.5], [5.5, 'C4', 0.5], [6, 'E4', 0.5], [6.5, 'A4', 0.5],
        [7, 'B4', 1.5], [8.5, 'E4', 0.5], [9, 'G#4', 0.5], [9.5, 'B4', 0.5],
        [10, 'C5', 1.5], [11.5, 'E4', 0.5],
        [12, 'E5', 0.5], [12.5, 'D#5', 0.5], [13, 'E5', 0.5], [13.5, 'D#5', 0.5],
        [14, 'E5', 0.5], [14.5, 'B4', 0.5], [15, 'D5', 0.5], [15.5, 'C5', 0.5],
        [16, 'A4', 1.5], [17.5, 'C4', 0.5], [18, 'E4', 0.5], [18.5, 'A4', 0.5],
        [19, 'B4', 1.5], [20.5, 'E4', 0.5], [21, 'C5', 0.5], [21.5, 'B4', 0.5],
        [22, 'A4', 2],
      ],
    },
  ],
};

// リズムゲームの記録。best は曲IDごとの最高得点。
export const DEFAULT_RHYTHM_STATE = {
  plays: 0,
  cleared: 0,   // クリア済みの曲数（0なら1曲目だけ遊べる）
  best: {},
};

export const DEFAULT_CONFIG = {
  shooter: DEFAULT_SHOOTER,
  shooterDx: DEFAULT_SHOOTER_DX,
  rhythm: DEFAULT_RHYTHM,
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
