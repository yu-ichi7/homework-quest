// 初回起動時にシードするデフォルトデータ。data/*.json が無ければ投入する。

// RPG（冒険）の既定パラメータ。すべてここで調整できる。
// 盤面は「エリアを一列に並べたマップ」。position は先頭からの総マス数。
// chests/events の tile はエリア内のローカル番号（0起点）。
// sprite はアイテムの見た目（game.js の SPRITES 名）。effect は装備効果。
export const DEFAULT_GAME = {
  moveCost: 5,            // 1マス進むのに必要なコイン
  baseAtk: 5,              // ヒーローの素のこうげき力
  baseDef: 0,              // ヒーローの素のぼうぎょ力
  baseHp: 25,              // バトル時のたいりょく
  areas: [
    {
      id: 'plains', name: 'はじまりの草原', theme: 'grass', length: 8,
      chests: [
        { tile: 3, reward: { coins: 15 } },
        { tile: 6, reward: { item: 'boots-swift' } },
      ],
      events: [
        { tile: 1, text: '道ばたのネコがついてきた。' },
        { tile: 5, text: '小川のせせらぎで少し休んだ。' },
      ],
      monsters: [
        { tile: 4, name: 'いたずらモグラ', hp: 18, atk: 2, reward: { coins: 12 } },
      ],
    },
    {
      id: 'forest', name: 'ひかりの森', theme: 'forest', length: 10,
      chests: [
        { tile: 2, reward: { coins: 20 } },
        { tile: 5, reward: { item: 'armor-leather' } },
        { tile: 8, reward: { coins: 30 } },
      ],
      events: [
        { tile: 4, text: '木もれ日がきらきらしている。' },
        { tile: 7, text: 'フクロウが道をおしえてくれた。' },
      ],
      monsters: [
        { tile: 6, name: 'まよいオオカミ', hp: 28, atk: 3, reward: { coins: 22 } },
      ],
    },
    {
      id: 'castle', name: 'そらの城', theme: 'sky', length: 12,
      chests: [
        { tile: 3, reward: { coins: 30 } },
        { tile: 7, reward: { item: 'sword-iron' } },
        { tile: 11, reward: { coins: 50 } },
      ],
      events: [
        { tile: 2, text: '雲のかいだんがのびている。' },
        { tile: 9, text: '風がつよい。あと少しで頂上だ。' },
      ],
      monsters: [
        { tile: 5, name: 'そらのばんにん', hp: 42, atk: 4, reward: { coins: 45 } },
      ],
    },
  ],
  shop: [
    { id: 'sword-wood', name: '木のつるぎ', slot: 'weapon', cost: 30, sprite: 'swordWood', atk: 3, desc: 'かけだし冒険者の相棒。こうげき+3。' },
    { id: 'sword-iron', name: '鉄のつるぎ', slot: 'weapon', cost: 90, sprite: 'swordIron', atk: 8, desc: 'ずっしり頼れる一振り。こうげき+8。' },
    { id: 'armor-leather', name: '革のよろい', slot: 'armor', cost: 50, sprite: 'armorLeather', tint: '#8a5a2b', def: 2, effect: { chestBonus: 2 }, desc: '宝箱のコインが少し増える。ぼうぎょ+2。' },
    { id: 'armor-plate', name: '鋼のよろい', slot: 'armor', cost: 140, sprite: 'armorPlate', tint: '#9aa4b2', def: 5, effect: { chestBonus: 4 }, desc: '宝箱のコインがぐっと増える。ぼうぎょ+5。' },
    { id: 'boots-swift', name: 'はやあしのくつ', slot: 'boots', cost: 40, sprite: 'bootsSwift', tint: '#8a5a2b', effect: { moveCostDelta: -1 }, desc: '移動コストが 1 へる。' },
    { id: 'boots-wind', name: '風のブーツ', slot: 'boots', cost: 120, sprite: 'bootsWind', tint: '#7ec8e3', effect: { moveCostDelta: -2 }, desc: '移動コストが 2 へる。' },
  ],
};

// ペット育成（たまごっち系）の既定パラメータ。
export const DEFAULT_PET = {
  feedCost: 5,                              // ごはん1回のコイン
  cleanCost: 3,                             // おそうじ1回のコイン
  decayPerDay: { hunger: 8, happiness: 6 }, // 経過日ごとの自然な減り
  neglectThreshold: 30,                     // これ未満なら「放置日」扱い
  careToEvolve: [8, 14],                    // stage0→1, stage1→2 に必要なお世話回数
  formNeglectLimit: 1,                      // 放置日がこれ以下なら「元気」、超えたら「お疲れ気味」
  poopPerDay: 1,                            // 1日ごとに増えるうんちの数
  maxPoop: 5,                               // うんちの上限
  poopHappinessPenalty: 2,                  // うんち1つあたり、なかよし度の減りが増える量
};

export const DEFAULT_GAME_STATE = {
  coinsEarned: 0,
  coinsSpent: 0,
  position: 0,
  openedChests: [],       // 開けた宝箱の tileId（"areaId:tile"）
  defeatedMonsters: [],   // 倒したモンスターの tileId（"areaId:tile"）
  inventory: [],          // 所持アイテム id
  equipped: { weapon: null, armor: null, boots: null },
};

export const DEFAULT_CONFIG = {
  game: DEFAULT_GAME,
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
