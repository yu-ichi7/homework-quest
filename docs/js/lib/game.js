// 冒険（RPG）の純粋ロジック。localStorage やDOMには触れない。
// 盤面は「エリアを一列に並べたマップ」。position は先頭からの総マス数（0起点）。

// ---- コイン残高 ----

export function balance(game) {
  return Math.max(0, (game.coinsEarned || 0) - (game.coinsSpent || 0));
}

// ---- 盤面の座標計算 ----

export function areasWithOffsets(config) {
  let offset = 0;
  return config.game.areas.map((a) => {
    const start = offset;
    offset += a.length;
    return { ...a, start, end: start + a.length - 1 };
  });
}

export function totalTiles(config) {
  return config.game.areas.reduce((s, a) => s + a.length, 0);
}

// position が今いるマス。どのエリアの何番目か・全クリアかを返す。
export function locate(position, config) {
  const areas = areasWithOffsets(config);
  const last = totalTiles(config) - 1;
  const clamped = Math.max(0, Math.min(position, last));
  const idx = areas.findIndex((a) => clamped >= a.start && clamped <= a.end);
  const areaIndex = idx < 0 ? areas.length - 1 : idx;
  const area = areas[areaIndex];
  return {
    areaIndex,
    area,
    localTile: clamped - area.start,
    isComplete: position >= last,
  };
}

// あるマスに宝箱/モンスターがあるか。
export function tileInfo(area, localTile, openedChests = [], defeatedMonsters = []) {
  const chest = (area.chests || []).find((c) => c.tile === localTile) || null;
  const monster = (area.monsters || []).find((m) => m.tile === localTile) || null;
  const chestId = chest ? `${area.id}:${localTile}` : null;
  const monsterId = monster ? `${area.id}:${localTile}` : null;
  return {
    chest,
    chestId,
    chestOpened: chestId ? openedChests.includes(chestId) : false,
    monster,
    monsterId,
    monsterDefeated: monsterId ? defeatedMonsters.includes(monsterId) : false,
  };
}

// ---- 装備の効果 ----

export function equippedItems(game, config) {
  return Object.values(game.equipped || {})
    .filter(Boolean)
    .map((id) => config.game.shop.find((s) => s.id === id))
    .filter(Boolean);
}

export function effectiveMoveCost(game, config) {
  const delta = equippedItems(game, config).reduce(
    (s, it) => s + (it.effect?.moveCostDelta || 0), 0,
  );
  return Math.max(1, config.game.moveCost + delta);
}

export function chestCoinBonus(game, config) {
  return equippedItems(game, config).reduce(
    (s, it) => s + (it.effect?.chestBonus || 0), 0,
  );
}

// 装備込みのこうげき力（基本＋装備の atk 合計）。相手を倒すコストを下げるのに使う。
export function heroAttack(game, config) {
  const items = equippedItems(game, config);
  const atk = items.reduce((s, it) => s + (it.atk || 0), 0);
  return config.game.baseAtk + atk;
}

// モンスターを倒すのに必要なコイン数。こうげき力ぶん安くなるが、下限あり。
export function defeatCost(monster, game, config) {
  const floor = Math.ceil(monster.cost * (config.game.monsterMinCostRatio ?? 0.25));
  return Math.max(floor, monster.cost - heroAttack(game, config));
}

// ---- 進む ----

// 1マス進む。純粋関数として新しい game と、起きたことをまとめて返す。
// 返り値 moved=false のときは reason に理由（'not-enough' / 'complete'）。
export function applyMove(game, config) {
  const cost = effectiveMoveCost(game, config);
  const last = totalTiles(config) - 1;

  if (game.position >= last) {
    return { game, moved: false, reason: 'complete' };
  }
  if (balance(game) < cost) {
    return { game, moved: false, reason: 'not-enough', cost };
  }

  const fromArea = locate(game.position, config).areaIndex;
  const next = {
    ...game,
    coinsSpent: (game.coinsSpent || 0) + cost,
    position: game.position + 1,
    openedChests: [...(game.openedChests || [])],
    inventory: [...(game.inventory || [])],
  };

  const loc = locate(next.position, config);
  const info = tileInfo(loc.area, loc.localTile, next.openedChests, game.defeatedMonsters || []);

  const result = {
    game: next, moved: true, cost,
    position: next.position,
    area: loc.area,
    localTile: loc.localTile,
    chestReward: null,
    monsterEncounter: (info.monster && !info.monsterDefeated)
      ? { ...info.monster, id: info.monsterId }
      : null,
    areaCleared: loc.areaIndex > fromArea ? locate(next.position, config).area : null,
    completed: next.position >= last,
  };

  // 宝箱（未開封のみ）。
  if (info.chest && !info.chestOpened) {
    next.openedChests.push(info.chestId);
    const reward = info.chest.reward || {};
    if (typeof reward.coins === 'number') {
      const coins = reward.coins + chestCoinBonus(game, config);
      next.coinsEarned = (next.coinsEarned || 0) + coins;
      result.chestReward = { kind: 'coins', coins };
    } else if (reward.item) {
      if (!next.inventory.includes(reward.item)) next.inventory.push(reward.item);
      const item = config.game.shop.find((s) => s.id === reward.item);
      result.chestReward = { kind: 'item', item };
    }
  }

  return result;
}

// ---- ショップ / 装備 ----

export function buyItem(game, config, itemId) {
  const item = config.game.shop.find((s) => s.id === itemId);
  if (!item) return { game, ok: false, reason: 'no-item' };
  if ((game.inventory || []).includes(itemId)) return { game, ok: false, reason: 'owned' };
  if (balance(game) < item.cost) return { game, ok: false, reason: 'not-enough' };
  const next = {
    ...game,
    coinsSpent: (game.coinsSpent || 0) + item.cost,
    inventory: [...(game.inventory || []), itemId],
  };
  return { game: next, ok: true, item };
}

// 装備の付け替え。同じものを再度選ぶと外す（トグル）。
export function equipItem(game, config, itemId) {
  const item = config.game.shop.find((s) => s.id === itemId);
  if (!item || !(game.inventory || []).includes(itemId)) return game;
  const equipped = { ...(game.equipped || {}) };
  equipped[item.slot] = equipped[item.slot] === itemId ? null : itemId;
  return { ...game, equipped };
}

// ---- レトロドット・スプライト ----
// '.' は透明。その他の文字は PALETTE の色。各行は同じ幅にすること。

// pet.js のペットスプライトもこのパレットを共用する（p/t/c/u/l がペット用）。
export const PALETTE = {
  k: '#2b2b2b', h: '#7a4a24', s: '#f1c9a5', b: '#3b6fe0',
  y: '#d9a441', n: '#8a5a2b', '0': '#f5e08a', r: '#e0483b',
  e: '#9aa4b2', w: '#ffffff', g: '#3aa655',
  p: '#f4a6c6', t: '#d6789f', c: '#e8944c', u: '#7ec8e3', l: '#f2c94c',
};

export const SPRITES = {
  hero: [
    '..kkkk..',
    '.khhhhk.',
    '.hssssh.',
    '.hskksh.',
    '.hssssh.',
    '..kbbk..',
    '.kbbbbk.',
    'kb.bb.bk',
    '.k....k.',
    '.k....k.',
  ],
  chest: [
    '.kkkkkk.',
    'kyyyyyyk',
    'kynnnyyk',
    'kyy00yyk',
    'kynnnyyk',
    'kyyyyyyk',
    '.kkkkkk.',
    '........',
  ],
  chestOpen: [
    'kyyyyyyk',
    'k......k',
    'k......k',
    '.kkkkkk.',
    'kynnnyyk',
    'kyyyyyyk',
    '.kkkkkk.',
    '........',
  ],
  flag: [
    'k.......',
    'krrrr...',
    'krrrrr..',
    'krrrr...',
    'k.......',
    'k.......',
    'k.......',
    'kk......',
    'kkk.....',
    'kkkk....',
  ],
  swordWood: [
    '......e.', '.....ee.', '....ee..', '...ee...',
    '..ee....', '.nee....', 'nn......', 'n.......',
  ],
  swordIron: [
    '......w.', '.....we.', '....we..', '...we...',
    '..we....', '.yee....', 'yy......', 'y.......',
  ],
  armorLeather: [
    '.knnk...', 'knnnnk..', 'knnnnk..', 'knnnnk..',
    '.knnk...', '........', '........', '........',
  ],
  armorPlate: [
    '.keek...', 'keeeek..', 'keeeek..', 'keeeek..',
    '.keek...', '........', '........', '........',
  ],
  bootsSwift: [
    '........', '........', 'kn......', 'kn......',
    'kn......', 'knnn....', 'knnnn...', 'kkkkk...',
  ],
  bootsWind: [
    '........', '..w.....', 'kn.w....', 'kn......',
    'kn.w....', 'knnn....', 'knnnn...', 'kkkkk...',
  ],
  monster: [
    '.kgggk..',
    'kggggggk',
    'gg0gg0gg',
    'gggggggg',
    'gkggggkg',
    '.gg..gg.',
    '.k....k.',
  ],
};

// ドット絵の行配列 → 描画用セル配列 [{x,y,color}]。他の種族/スプライト辞書からも再利用できる。
export function rowsToCells(rows) {
  if (!rows) return { cells: [], w: 0, h: 0 };
  const cells = [];
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch !== '.' && PALETTE[ch]) cells.push({ x, y, color: PALETTE[ch] });
    });
  });
  return { cells, w: rows[0].length, h: rows.length };
}

// スプライト文字列 → 描画用セル配列 [{x,y,color}]。
export function spriteToCells(name) {
  return rowsToCells(SPRITES[name]);
}

// 装備を反映したヒーローの見た目（純粋関数）。
// よろいで胴体の色が変わり、くつを履くと足元に色がつく。ぶきは呼び出し側で別途、
// 横に添えて描く（spriteToCells('swordWood') 等をそのまま使う）。
export function heroCells(equipped, shop) {
  const base = rowsToCells(SPRITES.hero);
  const armor = equipped?.armor ? shop.find((s) => s.id === equipped.armor) : null;
  const boots = equipped?.boots ? shop.find((s) => s.id === equipped.boots) : null;

  let cells = base.cells.map((c) => ({ ...c }));
  if (armor?.tint) {
    cells = cells.map((c) => (c.color === PALETTE.b ? { ...c, color: armor.tint } : c));
  }
  if (boots?.tint) {
    // 足もと（列1-2, 5-6 / 行8-9）を装備色で塗りつぶす。
    const footCells = [];
    for (const y of [8, 9]) {
      for (const x of [1, 2, 5, 6]) {
        footCells.push({ x, y, color: boots.tint });
      }
    }
    cells = [...cells, ...footCells];
  }
  return { cells, w: base.w, h: base.h };
}

// 冒険マップの「ウネウネ道」用：タイル番号から縦方向のうねりオフセットを返す（純粋関数）。
export function pathWaveY(tile, amplitude = 14, frequency = 0.7) {
  return Math.sin(tile * frequency) * amplitude;
}

// アイドルアニメーション用の上下オフセット（px）。t は performance.now() 等の経過ms。
// 純粋関数：サイン波を丸めた小さな整数を返すだけ（呼び出し側でrAFループを回す）。
export function idleOffset(t, amplitude = 1, periodMs = 900) {
  return Math.round(Math.sin((t / periodMs) * Math.PI * 2) * amplitude);
}
