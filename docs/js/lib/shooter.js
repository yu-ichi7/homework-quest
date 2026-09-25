// シューティングの純粋ロジック。localStorage やDOMには触れない。
// 見た目（機体・敵・ボスの描画）は ../shooterArt.js が担当する。

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
    escortLevel: up.escort || 0,
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

// ---- 武器 ----

export const WEAPON_LABEL = {
  normal: 'ノーマル', spread: '拡散', laser: 'レーザー', homing: 'ホーミング',
};

// 武器アイテムを取ったときの次の武器。
// 同じ種類ならレベルが上がり、ちがう種類なら今のレベルのまま持ち替える
// （どの武器を拾っても弱くならないようにするため）。
export function nextWeapon(current, kind, maxLevel = 3) {
  if (current.kind === kind) return { kind, level: Math.min(maxLevel, current.level + 1) };
  return { kind, level: Math.max(1, current.level) };
}

// 武器ごとの連射間隔（ms）。
export function weaponFireInterval(weapon, stats) {
  const mul = { normal: 1, spread: 1.1, laser: 0.9, homing: 1.2 }[weapon.kind] || 1;
  return Math.round(stats.fireIntervalMs * mul);
}

// 1回の発射で出る弾の一覧。dx は自機中心からの横ずれ、vx/vy は速度(px/秒)。
// pierce: 敵を貫通する。homing: 近くの敵へ曲がっていく。
export function weaponShots(weapon, stats) {
  const sp = stats.bulletSpeed;
  const p = stats.power;
  const lv = weapon.level || 1;
  switch (weapon.kind) {
    case 'spread': {
      const ways = 1 + lv * 2; // 3 → 5 → 7 方向
      const step = 0.17;       // 約10度ずつ開く
      return Array.from({ length: ways }, (_, i) => {
        const a = (i - (ways - 1) / 2) * step;
        return { dx: 0, vx: Math.sin(a) * sp, vy: -Math.cos(a) * sp, w: 5, h: 7, power: p };
      });
    }
    case 'laser': {
      const beam = (dx) => ({
        dx, vx: 0, vy: -sp * 1.5, w: 4 + lv * 2, h: 24,
        power: lv >= 2 ? Math.ceil(p * 1.5) : p, pierce: true,
      });
      return lv >= 3 ? [beam(-7), beam(7)] : [beam(0)];
    }
    case 'homing': {
      return Array.from({ length: lv }, (_, i) => {
        const a = (i - (lv - 1) / 2) * 0.5;
        return {
          dx: 0, vx: Math.sin(a) * sp * 0.6, vy: -Math.cos(a) * sp * 0.6,
          w: 6, h: 6, power: p, homing: true,
        };
      });
    }
    default:
      return [{ dx: 0, vx: 0, vy: -sp, w: 6, h: 9, power: p }];
  }
}

// 盾持ちの盾をすり抜けられる弾か（斜めに飛ぶ弾・ホーミングは横から当たる扱い）。
export function isAngledShot(bullet) {
  return Boolean(bullet.homing) || Math.abs(bullet.vx || 0) > 40;
}

// ---- 当たり判定 ----

// 矩形どうしの重なり（AABB）。
export function hits(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
