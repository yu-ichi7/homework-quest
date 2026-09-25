// シューティングDX専用の純粋ロジック（武器）。localStorage やDOMには触れない。
// 敵・アイテム・得点などの共通ロジックは lib/shooter.js を使う。

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
