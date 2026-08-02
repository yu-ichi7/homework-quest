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
  // ふつうの敵機（オレンジ。ハート型アイテムと紛らわしくないよう、
  // 丸い体ではなく機首を下にした飛行機のシルエットにしてある）
  enemyNormal: [
    '.c..c..c.',
    'cc.ccc.cc',
    '.ckkkkkc.',
    '..ckkkc..',
    '...ccc...',
    '....c....',
    '....c....',
  ],
  // かたい敵（大型の爆撃機。両脇に黄色いエンジンが2つ）
  enemyTough: [
    '..v....v..',
    '.vv....vv.',
    'vvvvvvvvvv',
    'vvllvvllvv',
    'vvvvvvvvvv',
    '.vvvvvvvv.',
    '..vvvvvv..',
    '...vvvv...',
  ],
  // すばやい敵（小さく細い機体。左右に揺れながら降りてくる）
  enemySwift: [
    '...u...',
    '..uuu..',
    '.uuuuu.',
    'uu.u.uu',
    '.u...u.',
    '...u...',
  ],
  // 狙い撃ちしてくる敵（銀色の機体。赤い銃口が目立つ）
  enemyGunner: [
    '....e....',
    '...eee...',
    '..erere..',
    '.eeeeeee.',
    'ee.rrr.ee',
    '.ee...ee.',
    '..e...e..',
  ],
  bullet: [
    '.0.',
    '000',
    '.0.',
  ],
  // 敵の弾（下向き）
  enemyBullet: [
    '.v.',
    'vvv',
    'vrv',
    '.v.',
  ],
  // ボス（ステージごとに色違い。形は共通で、テーマカラーだけ変えている）
  bossMeadow: [
    '..kk....kk..',
    '.kggk..kggk.',
    'kggggkkggggk',
    'ggyggggggygg',
    'ggggkkkkgggg',
    'ggkggggggkgg',
    '.gggggggggg.',
    '..gg.gg.gg..',
    '...k.....k..',
  ],
  bossClouds: [
    '..kk....kk..',
    '.kuuk..kuuk.',
    'kuuuukkuuuuk',
    'uuwuuuuuuwuu',
    'uuuukkkkuuuu',
    'uukuuuuuukuu',
    '.uuuuuuuuuu.',
    '..uu.uu.uu..',
    '...k.....k..',
  ],
  bossStorm: [
    '..kk....kk..',
    '.kvvk..kvvk.',
    'kvvvvkkvvvvk',
    'vvlvvvvvvlvv',
    'vvvvkkkkvvvv',
    'vvkvvvvvvkvv',
    '.vvvvvvvvvv.',
    '..vv.vv.vv..',
    '...k.....k..',
  ],
  bossVolcano: [
    '..kk....kk..',
    '.krrk..krrk.',
    'krrrrkkrrrrk',
    'rrcrrrrrrcrr',
    'rrrrkkkkrrrr',
    'rrkrrrrrrkrr',
    '.rrrrrrrrrr.',
    '..rr.rr.rr..',
    '...k.....k..',
  ],
  bossFortress: [
    '..kk....kk..',
    '.keek..keek.',
    'keeeekkeeeek',
    'eereeeeeeree',
    'eeeekkkkeeee',
    'eekeeeeeekee',
    '.eeeeeeeeee.',
    '..ee.ee.ee..',
    '...k.....k..',
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

// ---- 機体性能（永続強化から算出。あとは拾ったアイテムで伸びる） ----

export function planeStats(upgrades, config) {
  const up = upgrades || {};
  const u = config.upgrades;
  const power = config.base.power + (up.power || 0) * u.power.perLevel;
  const fire = config.base.fireIntervalMs + (up.rapid || 0) * u.rapid.perLevel;
  const lives = config.base.lives + (up.life || 0) * u.life.perLevel;
  return {
    power: Math.max(1, power),
    fireIntervalMs: Math.max(config.fireIntervalMinMs, fire),
    lives: Math.max(1, lives),
    bulletSpeed: config.base.bulletSpeed,
    playerSpeed: config.base.playerSpeed,
  };
}

// ---- ステージ ----

export function stageAt(index, config) {
  return config.stages[Math.max(0, Math.min(index, config.stages.length - 1))];
}

// index（0始まり）のステージが遊べるか。cleared はクリア済みの最大ステージ番号（1始まり）。
export function isStageUnlocked(index, cleared) {
  return index <= (cleared || 0);
}

// ---- 得点 ----

// 進み具合（0〜1）。ボス出現までで wavePhaseRatio まで、ボスの体力を削りきると 1。
export function stageProgress({ phase, waveRatio = 0, bossHpRatio = 1 }, config) {
  const w = config.scoring.wavePhaseRatio;
  if (phase === 'clear') return 1;
  if (phase === 'boss') return w + (1 - w) * Math.min(1, Math.max(0, 1 - bossHpRatio));
  return w * Math.min(1, Math.max(0, waveRatio));
}

// 得点 ＝ ステージの満点 × 進み具合 −（被弾ごとの減点）。
// ノーミスでボスを倒すと、ちょうど満点になる。
export function computeScore(stage, progress, damageCount, config) {
  const full = stage.clearScore;
  const penalty = full * config.scoring.damagePenaltyRatio * (damageCount || 0);
  return Math.max(0, Math.round(full * progress - penalty));
}

// 次のレベルのコイン（最大まで買っていれば null）。
export function nextUpgradeCost(kind, level, config) {
  const costs = config.upgrades[kind]?.costs || [];
  return level < costs.length ? costs[level] : null;
}

export function maxUpgradeLevel(kind, config) {
  return (config.upgrades[kind]?.costs || []).length;
}

// ---- 敵 ----

// そのステージの敵の混成（enemyMix）から重み付き抽選で1種類選ぶ。
// rand は 0〜1（テストしやすいよう外から渡せる）。
export function pickEnemyType(stage, rand = Math.random()) {
  const mix = stage.enemyMix || [{ type: 'normal', weight: 1 }];
  const total = mix.reduce((s, m) => s + (m.weight || 1), 0);
  let point = rand * total;
  for (const m of mix) {
    point -= (m.weight || 1);
    if (point < 0) return m.type;
  }
  return mix[mix.length - 1].type;
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

// この敵を倒したとき、アイテムを落とすか（落とす確率は敵の種類ごとに決まる）。
export function shouldDropItem(enemy, config, rand = Math.random()) {
  return rand < (enemy.dropChance ?? config.items.dropChanceNormal);
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
