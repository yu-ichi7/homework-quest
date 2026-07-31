// シューティングの純粋ロジック。localStorage やDOMには触れない。
import { rowsToCells } from './game.js';

// ---- ドット絵 ----

const SPRITES_SHOOTER = {
  // 自機（下向きに構えた飛行機）
  player: [
    '...ww...',
    '...ww...',
    '..wbbw..',
    '.wbbbbw.',
    'wwbbbbww',
    'w.wbbw.w',
    '...ww...',
    '..w..w..',
  ],
  // ふつうの敵
  enemy: [
    '..r..r..',
    '.rrrrrr.',
    'rrkrrkrr',
    'rrrrrrrr',
    '.rrrrrr.',
    '..r..r..',
  ],
  // かたい敵
  enemyTough: [
    '.v.vv.v.',
    'vvvvvvvv',
    'vv0vv0vv',
    'vvvvvvvv',
    'vvvvvvvv',
    '.vv..vv.',
  ],
  bullet: [
    '.0.',
    '000',
    '.0.',
  ],
  boom: [
    '.o.o.o.',
    'o.000.o',
    '.00000.',
    'o.000.o',
    '.o.o.o.',
  ],
  // パワーアップアイテム（色で見分ける）
  itemPower: [
    '.oooooo.',
    'o0oooo0o',
    'oo0oo0oo',
    'ooo00ooo',
    'oo0oo0oo',
    'o0oooo0o',
    '.oooooo.',
  ],
  itemRapid: [
    '.llllll.',
    'lll00lll',
    'll00llll',
    'l000000l',
    'llll00ll',
    'lll00lll',
    '.llllll.',
  ],
  itemLife: [
    '.rr..rr.',
    'rrrrrrrr',
    'rrwrrwrr',
    'rrrrrrrr',
    '.rrrrrr.',
    '..rrrr..',
    '...rr...',
  ],
};

export function shooterSpriteToCells(key) {
  return rowsToCells(SPRITES_SHOOTER[key]);
}

// ---- 機体性能（永続強化 ＋ そのプレイのブースト） ----

export function planeStats(upgrades, tier, config) {
  const up = upgrades || {};
  const t = tier || { power: 0, fireDelta: 0, lives: 0 };
  const u = config.upgrades;
  const power = config.base.power + (up.power || 0) * u.power.perLevel + (t.power || 0);
  const fire = config.base.fireIntervalMs
    + (up.rapid || 0) * u.rapid.perLevel
    + (t.fireDelta || 0);
  const lives = config.base.lives + (up.life || 0) * u.life.perLevel + (t.lives || 0);
  return {
    power: Math.max(1, power),
    fireIntervalMs: Math.max(config.fireIntervalMinMs, fire),
    lives: Math.max(1, lives),
    bulletSpeed: config.base.bulletSpeed,
    playerSpeed: config.base.playerSpeed,
  };
}

// 次のレベルのコイン（最大まで買っていれば null）。
export function nextUpgradeCost(kind, level, config) {
  const costs = config.upgrades[kind]?.costs || [];
  return level < costs.length ? costs[level] : null;
}

export function maxUpgradeLevel(kind, config) {
  return (config.upgrades[kind]?.costs || []).length;
}

// ---- 難易度カーブ ----

// 経過時間（ms）から、敵の落下速度・出現間隔・かたい敵の割合を返す。
export function difficultyAt(elapsedMs, config) {
  const minutes = elapsedMs / 60000;
  const e = config.enemy;
  return {
    speed: e.baseSpeed + e.speedPerMin * minutes,
    spawnMs: Math.max(e.spawnMinMs, e.baseSpawnMs - e.spawnSpeedUpPerMin * minutes),
    toughChance: Math.min(0.5, e.toughChancePerMin * minutes),
  };
}

// ---- アイテム ----

// 重み付き抽選でアイテムの種類を1つ選ぶ。rand は 0〜1（テストしやすいよう外から渡せる）。
export function pickItemType(config, rand = Math.random()) {
  const types = config.items.types;
  const total = types.reduce((s, t) => s + (t.weight || 1), 0);
  let point = rand * total;
  for (const t of types) {
    point -= (t.weight || 1);
    if (point < 0) return t;
  }
  return types[types.length - 1];
}

// この敵を倒したとき、アイテムを落とすか。
export function shouldDropItem(enemy, config, rand = Math.random()) {
  const chance = enemy.tough ? config.items.dropChanceTough : config.items.dropChanceNormal;
  return rand < chance;
}

// アイテムを取ったときの、機体性能への反映（純粋関数）。
export function applyItem(stats, lives, type, config) {
  const next = { ...stats };
  let nextLives = lives;
  if (type.power) next.power += type.power;
  if (type.fireDelta) {
    next.fireIntervalMs = Math.max(config.fireIntervalMinMs, next.fireIntervalMs + type.fireDelta);
  }
  if (type.lives) nextLives = Math.min(config.items.maxLives, nextLives + type.lives);
  return { stats: next, lives: nextLives };
}

// ---- 当たり判定 ----

// 矩形どうしの重なり（AABB）。
export function hits(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
