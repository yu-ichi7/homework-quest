// ゲーム共通の純粋ロジック（コイン残高・ドット絵）。localStorage やDOMには触れない。
// シューティング（lib/shooter.js）とペット（lib/pet.js）の両方から使う。

// ---- コイン残高 ----

export function balance(game) {
  return Math.max(0, (game.coinsEarned || 0) - (game.coinsSpent || 0));
}

// ---- レトロドット・スプライト ----
// '.' は透明。その他の文字は PALETTE の色。各行は同じ幅にすること。

// pet.js / shooter.js のスプライトもこのパレットを共用する。
export const PALETTE = {
  k: '#2b2b2b', h: '#7a4a24', s: '#f1c9a5', b: '#3b6fe0',
  y: '#d9a441', n: '#8a5a2b', '0': '#f5e08a', r: '#e0483b',
  e: '#9aa4b2', w: '#ffffff', g: '#3aa655',
  p: '#f4a6c6', t: '#d6789f', c: '#e8944c', u: '#7ec8e3', l: '#f2c94c',
  v: '#a78bfa', o: '#fb923c',
};

// ドット絵の行配列 → 描画用セル配列 [{x,y,color}]。各スプライト辞書から再利用できる。
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

// アイドルアニメーション用の上下オフセット（px）。t は performance.now() 等の経過ms。
// 純粋関数：サイン波を丸めた小さな整数を返すだけ（呼び出し側でrAFループを回す）。
export function idleOffset(t, amplitude = 1, periodMs = 900) {
  return Math.round(Math.sin((t / periodMs) * Math.PI * 2) * amplitude);
}
