// シューティングの見た目（描画）だけを受け持つ。ゲームの状態は変更しない。
// ドット絵ではなく、Canvas の図形・グラデーション・光で描く。
// 敵・ボスは当たり判定の箱（x, y, w, h）に収まるように描く。

const TAU = Math.PI * 2;

// ---- 小さな道具 ----

function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

// cx を中心に左右対称な多角形（右半分の点だけ渡す）。
function mirrorPoly(ctx, cx, half) {
  const right = half.map(([x, y]) => [cx + x, y]);
  const left = [...half].reverse().map(([x, y]) => [cx - x, y]);
  poly(ctx, [...right, ...left]);
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
}

function vGrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([at, color]) => g.addColorStop(at, color));
  return g;
}

function rGrad(ctx, x, y, r, stops) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  stops.forEach(([at, color]) => g.addColorStop(at, color));
  return g;
}

// 光るまる（外側のぼんやりした光＋内側の芯）。shadowBlur より軽い。
function glowDot(ctx, x, y, r, color, core = '#ffffff') {
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = color;
  circle(ctx, x, y, r * 1.9);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  circle(ctx, x, y, r);
  ctx.fill();
  ctx.fillStyle = core;
  circle(ctx, x, y, r * 0.45);
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- 背景 ----

const THEMES = {
  meadow: { top: '#0f2f1f', bottom: '#2f6b3f', far: 'rgba(120,200,120,0.18)', dot: '#bbf7d0', kind: 'hills' },
  clouds: { top: '#12305a', bottom: '#5b8fd6', far: 'rgba(255,255,255,0.20)', dot: '#ffffff', kind: 'clouds' },
  storm: { top: '#120b24', bottom: '#3b2a63', far: 'rgba(160,130,255,0.18)', dot: '#fde68a', kind: 'clouds' },
  volcano: { top: '#1a0707', bottom: '#6b1d0e', far: 'rgba(255,120,50,0.18)', dot: '#fdba74', kind: 'embers' },
  space: { top: '#02030a', bottom: '#141a3a', far: 'rgba(120,160,255,0.12)', dot: '#ffffff', kind: 'stars' },
  // 第6〜10面
  ocean: { top: '#031a33', bottom: '#0b5f7c', far: 'rgba(80,180,255,0.16)', dot: '#bae6fd', kind: 'bubbles' },
  ice: { top: '#0b1f3a', bottom: '#5fb4e6', far: 'rgba(255,255,255,0.18)', dot: '#ffffff', kind: 'snow' },
  desert: { top: '#3b1f0a', bottom: '#c2690a', far: 'rgba(254,215,170,0.20)', dot: '#fde68a', kind: 'hills' },
  nebula: { top: '#0a0014', bottom: '#3b0764', far: 'rgba(217,70,239,0.18)', dot: '#f5d0fe', kind: 'stars' },
  core: { top: '#1a1200', bottom: '#6b3a08', far: 'rgba(253,224,71,0.16)', dot: '#fef08a', kind: 'embers' },
};

export function drawBackground(ctx, w, h, now, theme, slow) {
  const t = THEMES[theme] || THEMES.space;
  ctx.fillStyle = vGrad(ctx, 0, h, [[0, t.top], [1, t.bottom]]);
  ctx.fillRect(0, 0, w, h);

  // 奥の景色（ゆっくり流れる）。
  ctx.fillStyle = t.far;
  for (let i = 0; i < 5; i += 1) {
    const y = ((i * 130) + now / 26) % (h + 160) - 80;
    const x = (i * 97) % w;
    if (t.kind === 'hills') {
      ctx.beginPath();
      ctx.ellipse(x, y, 120, 40, 0, 0, TAU);
      ctx.fill();
    } else if (t.kind === 'clouds') {
      for (let k = 0; k < 3; k += 1) {
        circle(ctx, x + k * 34 - 34, y + (k % 2) * 8, 26 + k * 4);
        ctx.fill();
      }
    } else {
      circle(ctx, x, y, 60);
      ctx.fill();
    }
  }

  // 手前の粒（星・火の粉・花びら・泡・雪）。火の粉と泡は下から上へ、雪は左右にゆれながら落ちる。
  ctx.fillStyle = t.dot;
  const count = t.kind === 'stars' ? 40 : 26;
  const rising = t.kind === 'embers' || t.kind === 'bubbles';
  const swaying = rising || t.kind === 'snow';
  for (let i = 0; i < count; i += 1) {
    const speed = 6 + (i % 4) * 3;
    const x = ((i * 83 + (swaying ? Math.sin(now / 700 + i) * 10 : 0)) % w + w) % w;
    const y = rising
      ? h - (((i * 61) + now / speed) % h)
      : ((i * 61) + now / speed) % h;
    ctx.globalAlpha = 0.35 + (i % 3) * 0.2;
    circle(ctx, x, y, 1 + (i % 3) * 0.6);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // スロー中はうっすら青くする。
  if (slow) {
    ctx.fillStyle = 'rgba(80,140,255,0.14)';
    ctx.fillRect(0, 0, w, h);
  }
}

// ---- 自機・護衛機 ----

// (x, y) は機体の下端中央。
export function drawPlayer(ctx, x, y, now, { shield = false, star = false } = {}) {
  const top = y - 26;
  const cy = y - 13;

  if (star) {
    const r = 26 + Math.sin(now / 60) * 3;
    ctx.fillStyle = rGrad(ctx, x, cy, r, [[0, 'rgba(255,240,120,0.75)'], [1, 'rgba(255,200,0,0)']]);
    circle(ctx, x, cy, r);
    ctx.fill();
  }

  // エンジンの炎（ゆらぐ）。
  const flame = 8 + Math.sin(now / 40) * 3;
  ctx.fillStyle = vGrad(ctx, y - 4, y + flame, [[0, '#fde68a'], [0.5, '#fb923c'], [1, 'rgba(239,68,68,0)']]);
  poly(ctx, [[x - 4, y - 4], [x + 4, y - 4], [x, y + flame]]);
  ctx.fill();

  // 主翼。
  ctx.fillStyle = vGrad(ctx, cy - 4, y, [[0, '#93c5fd'], [1, '#1d4ed8']]);
  mirrorPoly(ctx, x, [[0, cy - 6], [13, cy + 6], [13, cy + 10], [4, y - 4]]);
  ctx.fill();

  // 胴体。
  ctx.fillStyle = vGrad(ctx, top, y, [[0, '#ffffff'], [0.5, '#dbeafe'], [1, '#60a5fa']]);
  mirrorPoly(ctx, x, [[0, top], [4, top + 8], [5, y - 3], [0, y]]);
  ctx.fill();
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 操縦席のガラス。
  ctx.fillStyle = vGrad(ctx, top + 7, top + 15, [[0, '#e0f2fe'], [1, '#0ea5e9']]);
  ctx.beginPath();
  ctx.ellipse(x, top + 11, 2.6, 5, 0, 0, TAU);
  ctx.fill();

  if (shield) {
    ctx.strokeStyle = `rgba(56,189,248,${0.6 + Math.sin(now / 120) * 0.3})`;
    ctx.lineWidth = 2.5;
    circle(ctx, x, cy, 20);
    ctx.stroke();
    ctx.fillStyle = 'rgba(56,189,248,0.12)';
    ctx.fill();
  }
}

export function drawEscort(ctx, x, y, now) {
  glowDot(ctx, x, y, 4.5, '#60a5fa', '#e0f2fe');
  ctx.strokeStyle = 'rgba(191,219,254,0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 7, now / 150, now / 150 + Math.PI);
  ctx.stroke();
}

// ---- ザコ敵 ----

// 各敵は箱の中心 (cx, cy)・幅 w・高さ h に合わせて、機首を下（自機のほう）に向けて描く。
const ENEMY_DRAW = {
  normal(ctx, cx, cy, w, h) {
    const t = cy - h / 2;
    const b = cy + h / 2;
    ctx.fillStyle = vGrad(ctx, t, b, [[0, '#fdba74'], [1, '#c2410c']]);
    mirrorPoly(ctx, cx, [[0, b], [4, cy + 2], [w / 2, t + 4], [w / 2 - 3, t], [3, t + 3], [0, t]]);
    ctx.fill();
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 1, 2.5, 4.5, 0, 0, TAU);
    ctx.fill();
  },
  // 大型の爆撃機。まっすぐ横に張った主翼と長い胴体（丸い輪郭はハートに見えるので避ける）。
  tough(ctx, cx, cy, w, h) {
    const t = cy - h / 2;
    const b = cy + h / 2;
    ctx.fillStyle = vGrad(ctx, t, b, [[0, '#ddd6fe'], [1, '#6d28d9']]);
    // 尾翼
    mirrorPoly(ctx, cx, [[3, t + 3], [10, t], [10, t + 4], [3, t + 8]]);
    ctx.fill();
    // 主翼
    mirrorPoly(ctx, cx, [[4, cy - 5], [w / 2, cy - 1], [w / 2, cy + 3], [4, cy + 4]]);
    ctx.fill();
    ctx.strokeStyle = '#2e1065';
    ctx.lineWidth = 1;
    ctx.stroke();
    // 胴体
    ctx.fillStyle = vGrad(ctx, t, b, [[0, '#ede9fe'], [1, '#7c3aed']]);
    mirrorPoly(ctx, cx, [[0, b], [4, b - 6], [5, t + 4], [3, t], [0, t]]);
    ctx.fill();
    ctx.stroke();
    // 主翼のエンジン2つ
    glowDot(ctx, cx - w / 4, cy + 1, 3, '#fbbf24', '#fffbeb');
    glowDot(ctx, cx + w / 4, cy + 1, 3, '#fbbf24', '#fffbeb');
  },
  swift(ctx, cx, cy, w, h) {
    const t = cy - h / 2;
    const b = cy + h / 2;
    ctx.fillStyle = vGrad(ctx, t, b, [[0, '#a5f3fc'], [1, '#0891b2']]);
    mirrorPoly(ctx, cx, [[0, b], [3, cy], [w / 2, t], [2, t + 4], [0, t + 2]]);
    ctx.fill();
  },
  gunner(ctx, cx, cy, w, h) {
    const t = cy - h / 2;
    const b = cy + h / 2;
    ctx.fillStyle = vGrad(ctx, t, b, [[0, '#f1f5f9'], [1, '#64748b']]);
    mirrorPoly(ctx, cx, [[0, b], [5, cy + 3], [w / 2, cy], [w / 2, t + 3], [4, t], [0, t]]);
    ctx.fill();
    // 赤い銃口。
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(cx - w / 2 + 2, cy, 3, h / 2 - 1);
    ctx.fillRect(cx + w / 2 - 5, cy, 3, h / 2 - 1);
    glowDot(ctx, cx, cy - 1, 2.6, '#ef4444', '#fecaca');
  },
  charger(ctx, cx, cy, w, h, e, now) {
    const t = cy - h / 2;
    const b = cy + h / 2;
    const aiming = e.state === 'aim';
    ctx.fillStyle = vGrad(ctx, t, b, aiming
      ? [[0, '#fecaca'], [1, '#dc2626']]
      : [[0, '#fed7aa'], [1, '#ea580c']]);
    mirrorPoly(ctx, cx, [[0, b], [w / 2, t], [4, t + 6], [0, t + 3]]);
    ctx.fill();
    if (aiming && Math.floor(now / 90) % 2 === 0) {
      ctx.strokeStyle = 'rgba(248,113,113,0.9)';
      ctx.lineWidth = 2;
      circle(ctx, cx, cy, w / 2 + 3);
      ctx.stroke();
    }
  },
  splitter(ctx, cx, cy, w, h) {
    const r = h / 2 - 1;
    for (const dir of [-1, 1]) {
      const px = cx + dir * (w / 4);
      ctx.fillStyle = rGrad(ctx, px - 2, cy - 3, r + 2, [[0, '#bbf7d0'], [1, '#15803d']]);
      circle(ctx, px, cy, r);
      ctx.fill();
    }
    ctx.strokeStyle = '#052e16';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.stroke();
  },
  mini(ctx, cx, cy, w, h) {
    ctx.fillStyle = rGrad(ctx, cx - 1, cy - 2, h / 2 + 2, [[0, '#dcfce7'], [1, '#16a34a']]);
    circle(ctx, cx, cy, h / 2);
    ctx.fill();
  },
  shielded(ctx, cx, cy, w, h, e) {
    const t = cy - h / 2;
    ctx.fillStyle = vGrad(ctx, t, cy + 4, [[0, '#e2e8f0'], [1, '#475569']]);
    mirrorPoly(ctx, cx, [[0, cy + 4], [w / 2 - 2, cy], [w / 2 - 4, t + 2], [0, t]]);
    ctx.fill();
    if (e.shieldHp > 0) {
      // 正面の盾（残りが減るほど薄くなる）。
      const alpha = 0.35 + 0.5 * (e.shieldHp / e.shieldMax);
      ctx.strokeStyle = `rgba(56,189,248,${alpha})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy - 6, w / 2 + 2, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  },
  formation(ctx, cx, cy, w, h) {
    const t = cy - h / 2;
    const b = cy + h / 2;
    ctx.fillStyle = vGrad(ctx, t, b, [[0, '#bfdbfe'], [1, '#2563eb']]);
    mirrorPoly(ctx, cx, [[0, b], [w / 2, t], [3, t + 4], [0, t + 2]]);
    ctx.fill();
  },
  mine(ctx, cx, cy, w, h, e, now) {
    const r = w / 2 - 3;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * TAU + now / 1500;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.lineTo(cx + Math.cos(a) * (r + 5), cy + Math.sin(a) * (r + 5));
      ctx.stroke();
    }
    ctx.fillStyle = rGrad(ctx, cx - 3, cy - 3, r + 3, [[0, '#6b7280'], [1, '#111827']]);
    circle(ctx, cx, cy, r);
    ctx.fill();
    const blink = Math.floor(now / 250) % 2 === 0;
    glowDot(ctx, cx, cy, 2.5, blink ? '#ef4444' : '#7f1d1d', blink ? '#fecaca' : '#ef4444');
  },
};

export function drawEnemy(ctx, e, now) {
  const cx = e.x + e.w / 2;
  const cy = e.y + e.h / 2;
  const draw = ENEMY_DRAW[e.kind] || ENEMY_DRAW.normal;
  draw(ctx, cx, cy, e.w, e.h, e, now);
  // 弾が当たった瞬間は白く光る。
  if (e.hitUntil && e.hitUntil > now) {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#ffffff';
    circle(ctx, cx, cy, Math.max(e.w, e.h) / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// 突撃する敵が狙っている方向の予告線。
export function drawChargeWarning(ctx, e, now) {
  if (e.state !== 'aim') return;
  const cx = e.x + e.w / 2;
  const cy = e.y + e.h / 2;
  ctx.strokeStyle = `rgba(248,113,113,${0.25 + (Math.floor(now / 90) % 2) * 0.35})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + e.vx * 3, cy + e.vy * 3);
  ctx.stroke();
  ctx.setLineDash([]);
}

// ---- 中ボス ----

export function drawMidboss(ctx, m, now) {
  const cx = m.x + m.w / 2;
  const cy = m.y + m.h / 2;
  const t = m.y;
  const b = m.y + m.h;
  ctx.fillStyle = vGrad(ctx, t, b, [[0, '#fed7aa'], [0.6, '#ea580c'], [1, '#7c2d12']]);
  mirrorPoly(ctx, cx, [[0, b], [10, b - 6], [m.w / 2, cy], [m.w / 2 - 4, t + 4], [12, t], [0, t + 6]]);
  ctx.fill();
  ctx.strokeStyle = '#431407';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 両脇の砲台。
  ctx.fillStyle = '#374151';
  ctx.fillRect(cx - m.w / 2 + 3, cy, 6, m.h / 2);
  ctx.fillRect(cx + m.w / 2 - 9, cy, 6, m.h / 2);
  glowDot(ctx, cx, cy, 5, '#facc15', '#fffbeb');
  if (m.hitUntil > now) {
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#ffffff';
    circle(ctx, cx, cy, m.w / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // 体力バー。
  const ratio = Math.max(0, m.hp / m.maxHp);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(m.x, m.y - 8, m.w, 4);
  ctx.fillStyle = '#fb923c';
  ctx.fillRect(m.x, m.y - 8, m.w * ratio, 4);
}

// ---- ボス ----

// ボスは攻撃パターンごとに見た目も変える。怒りモードでは赤いオーラをまとう。
const BOSS_DRAW = {
  // 緑の守護者：大きな葉に包まれた植物の番人。
  leaves(ctx, cx, cy, w, h, now) {
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * TAU + Math.sin(now / 900) * 0.12;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = vGrad(ctx, -h / 2, 0, [[0, '#86efac'], [1, '#15803d']]);
      ctx.beginPath();
      ctx.ellipse(0, -h / 2.6, 10, h / 2.8, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = rGrad(ctx, cx - 4, cy - 4, 20, [[0, '#fef9c3'], [0.5, '#facc15'], [1, '#a16207']]);
    circle(ctx, cx, cy, 16);
    ctx.fill();
    // 怒った顔（つり上がった眉・への字の口）。
    ctx.fillStyle = '#14532d';
    circle(ctx, cx - 6, cy - 1, 2.5); ctx.fill();
    circle(ctx, cx + 6, cy - 1, 2.5); ctx.fill();
    ctx.strokeStyle = '#14532d';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 11, cy - 8); ctx.lineTo(cx - 3, cy - 5);
    ctx.moveTo(cx + 11, cy - 8); ctx.lineTo(cx + 3, cy - 5);
    ctx.moveTo(cx - 5, cy + 8); ctx.quadraticCurveTo(cx, cy + 4, cx + 5, cy + 8);
    ctx.stroke();
    ctx.lineCap = 'butt';
  },
  // 雲の主：もくもくの雲に怒った目、時々いなずまが走る。
  thunder(ctx, cx, cy, w, h, now) {
    const puffs = [[-28, 4, 18], [-12, -8, 22], [8, -10, 22], [26, 2, 18], [0, 8, 22]];
    ctx.fillStyle = rGrad(ctx, cx, cy - 10, w / 1.6, [[0, '#ffffff'], [1, '#94a3b8']]);
    for (const [dx, dy, r] of puffs) {
      circle(ctx, cx + dx, cy + dy, r);
      ctx.fill();
    }
    ctx.fillStyle = '#1e293b';
    poly(ctx, [[cx - 16, cy - 2], [cx - 5, cy + 2], [cx - 16, cy + 5]]); ctx.fill();
    poly(ctx, [[cx + 16, cy - 2], [cx + 5, cy + 2], [cx + 16, cy + 5]]); ctx.fill();
    if (Math.floor(now / 110) % 7 === 0) {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 20, cy + 14);
      ctx.lineTo(cx - 12, cy + 24);
      ctx.lineTo(cx - 18, cy + 26);
      ctx.lineTo(cx - 8, cy + 36);
      ctx.stroke();
    }
  },
  // 雷竜：後ろへ反った角と、下（自機のほう）へ細長くのびる鼻先をもつ竜の頭。
  // 頭の上をへこませると輪郭がハートに見えるので、上はまっすぐにしている。
  zigzag(ctx, cx, cy, w, h) {
    const t = cy - h / 2;
    const b = cy + h / 2;
    ctx.fillStyle = '#fde047';
    poly(ctx, [[cx - 20, t + 6], [cx - 40, t - 16], [cx - 28, t + 10]]); ctx.fill();
    poly(ctx, [[cx + 20, t + 6], [cx + 40, t - 16], [cx + 28, t + 10]]); ctx.fill();
    // 首の後ろのとげ
    ctx.fillStyle = '#7c3aed';
    for (const dx of [-8, 0, 8]) {
      poly(ctx, [[cx + dx - 4, t + 2], [cx + dx, t - 8], [cx + dx + 4, t + 2]]);
      ctx.fill();
    }
    ctx.fillStyle = vGrad(ctx, t, b, [[0, '#c4b5fd'], [1, '#4c1d95']]);
    mirrorPoly(ctx, cx, [[0, t], [16, t + 1], [w / 2 - 6, t + 12], [w / 2 - 10, cy + 2], [13, cy + 10], [8, b - 3], [0, b]]);
    ctx.fill();
    ctx.strokeStyle = '#2e1065';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 牙
    ctx.fillStyle = '#ffffff';
    for (const dir of [-1, 1]) {
      poly(ctx, [[cx + dir * 12, cy + 10], [cx + dir * 9, cy + 18], [cx + dir * 8, cy + 11]]);
      ctx.fill();
    }
    // つり上がった目
    for (const dir of [-1, 1]) {
      ctx.fillStyle = '#facc15';
      poly(ctx, [[cx + dir * 8, cy - 6], [cx + dir * 22, cy - 13], [cx + dir * 19, cy - 3]]);
      ctx.fill();
      ctx.fillStyle = '#1e1b4b';
      circle(ctx, cx + dir * 16, cy - 7, 1.8);
      ctx.fill();
    }
    // 鼻の穴
    ctx.fillStyle = '#1e1b4b';
    circle(ctx, cx - 4, b - 9, 1.8); ctx.fill();
    circle(ctx, cx + 4, b - 9, 1.8); ctx.fill();
  },
  // 溶岩帝王：黒い岩の体にオレンジに光るひび、頭に王冠。
  lava(ctx, cx, cy, w, h, now) {
    ctx.fillStyle = vGrad(ctx, cy - h / 2, cy + h / 2, [[0, '#44403c'], [1, '#0c0a09']]);
    mirrorPoly(ctx, cx, [[0, cy + h / 2], [18, cy + h / 2 - 4], [w / 2, cy + 6], [w / 2 - 6, cy - h / 2 + 10], [16, cy - h / 2 + 4], [0, cy - h / 2 + 8]]);
    ctx.fill();
    const glow = 0.6 + Math.sin(now / 200) * 0.3;
    ctx.strokeStyle = `rgba(251,146,60,${glow})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 24, cy - 6); ctx.lineTo(cx - 10, cy + 4); ctx.lineTo(cx - 16, cy + 18);
    ctx.moveTo(cx + 24, cy - 6); ctx.lineTo(cx + 10, cy + 4); ctx.lineTo(cx + 16, cy + 18);
    ctx.stroke();
    // 光る目と、溶岩の口。
    glowDot(ctx, cx - 13, cy - 8, 3.5, '#fb923c', '#fef3c7');
    glowDot(ctx, cx + 13, cy - 8, 3.5, '#fb923c', '#fef3c7');
    glowDot(ctx, cx, cy + 10, 6, '#f97316', '#fef3c7');
    ctx.fillStyle = '#facc15';
    poly(ctx, [[cx - 16, cy - h / 2 + 8], [cx - 12, cy - h / 2 - 6], [cx - 5, cy - h / 2 + 2],
      [cx, cy - h / 2 - 8], [cx + 5, cy - h / 2 + 2], [cx + 12, cy - h / 2 - 6], [cx + 16, cy - h / 2 + 8]]);
    ctx.fill();
  },
  // 要塞中枢：回転する金属のリングと、赤く脈打つ核。
  spiral(ctx, cx, cy, w, h, now) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(now / 1200);
    ctx.fillStyle = vGrad(ctx, -h / 2, h / 2, [[0, '#e2e8f0'], [1, '#334155']]);
    const r = h / 2;
    poly(ctx, Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * TAU;
      return [Math.cos(a) * r, Math.sin(a) * r];
    }));
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#475569';
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * TAU;
      ctx.fillRect(Math.cos(a) * (r - 4) - 4, Math.sin(a) * (r - 4) - 4, 8, 8);
    }
    ctx.restore();
    const pulse = 9 + Math.sin(now / 150) * 2;
    ctx.fillStyle = rGrad(ctx, cx, cy, pulse * 1.8, [[0, '#fecaca'], [0.4, '#ef4444'], [1, 'rgba(127,29,29,0)']]);
    circle(ctx, cx, cy, pulse * 1.8);
    ctx.fill();
  },

  // ---- 第6〜10面のボス ----

  // 深海の大王イカ：上へとがった胴と、自機のほうへゆれる触手。
  squid(ctx, cx, cy, w, h, now) {
    const t = cy - h / 2;
    ctx.strokeStyle = '#c026d3';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i += 1) {
      const x0 = cx + (i - 2.5) * 8;
      ctx.beginPath();
      ctx.moveTo(x0, cy + 6);
      for (let k = 1; k <= 4; k += 1) {
        ctx.lineTo(x0 + Math.sin(now / 220 + i + k) * 4, cy + 6 + k * 7);
      }
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    ctx.fillStyle = '#e879f9';
    poly(ctx, [[cx - 14, t + 10], [cx - 30, t + 2], [cx - 18, t + 20]]); ctx.fill();
    poly(ctx, [[cx + 14, t + 10], [cx + 30, t + 2], [cx + 18, t + 20]]); ctx.fill();
    ctx.fillStyle = vGrad(ctx, t - 6, cy + 10, [[0, '#f5d0fe'], [1, '#86198f']]);
    poly(ctx, [[cx, t - 6], [cx + 22, cy + 2], [cx + 18, cy + 10], [cx - 18, cy + 10], [cx - 22, cy + 2]]);
    ctx.fill();
    ctx.strokeStyle = '#4a044e';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    for (const dir of [-1, 1]) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(cx + dir * 9, cy + 1, 5, 6, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#1e1b4b';
      circle(ctx, cx + dir * 8, cy + 2, 2.6);
      ctx.fill();
      ctx.strokeStyle = '#4a044e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + dir * 15, cy - 7);
      ctx.lineTo(cx + dir * 4, cy - 4);
      ctx.stroke();
    }
  },
  // 氷の女王：氷の冠と、下へ広がる氷のドレス。
  ice(ctx, cx, cy, w, h, now) {
    ctx.fillStyle = vGrad(ctx, cy - 6, cy + h / 2, [[0, '#e0f2fe'], [1, '#0284c7']]);
    poly(ctx, [[cx, cy - 8], [cx + 32, cy + h / 2], [cx - 32, cy + h / 2]]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#bae6fd';
    for (const [dx, top] of [[-14, 34], [-7, 42], [0, 48], [7, 42], [14, 34]]) {
      poly(ctx, [[cx + dx - 4, cy - 20], [cx + dx, cy - top], [cx + dx + 4, cy - 20]]);
      ctx.fill();
    }
    ctx.fillStyle = '#f0f9ff';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 10, 12, 13, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#0369a1';
    for (const dir of [-1, 1]) {
      poly(ctx, [[cx + dir * 3, cy - 11], [cx + dir * 9, cy - 14], [cx + dir * 8, cy - 9]]);
      ctx.fill();
    }
    ctx.strokeStyle = '#0369a1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy - 3);
    ctx.lineTo(cx + 4, cy - 3);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i += 1) {
      const a = now / 700 + (i * TAU) / 4;
      circle(ctx, cx + Math.cos(a) * 36, cy + Math.sin(a) * 14, 1.8);
      ctx.fill();
    }
  },
  // 砂漠の大サソリ：左右の大きなはさみと、背中の上で曲がる毒のしっぽ。
  scorpion(ctx, cx, cy, w, h) {
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.5;
    for (const dir of [-1, 1]) {
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.moveTo(cx + dir * 14, cy - 6 + i * 6);
        ctx.lineTo(cx + dir * 30, cy - 12 + i * 8);
        ctx.stroke();
      }
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx + dir * 12, cy + 12);
      ctx.lineTo(cx + dir * 26, cy + 18);
      ctx.stroke();
      ctx.lineWidth = 2.5;
      ctx.fillStyle = vGrad(ctx, cy + 12, cy + 30, [[0, '#fbbf24'], [1, '#b45309']]);
      ctx.beginPath();
      ctx.ellipse(cx + dir * 32, cy + 22, 9, 7, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#78350f';
      ctx.beginPath();
      ctx.moveTo(cx + dir * 32, cy + 22);
      ctx.lineTo(cx + dir * 40, cy + 26);
      ctx.stroke();
    }
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 10);
    ctx.quadraticCurveTo(cx + 6, cy - 34, cx + 22, cy - 30);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = '#7f1d1d';
    poly(ctx, [[cx + 20, cy - 34], [cx + 30, cy - 28], [cx + 22, cy - 22]]);
    ctx.fill();
    ctx.fillStyle = vGrad(ctx, cy - 14, cy + 14, [[0, '#fcd34d'], [1, '#92400e']]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, 18, 13, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy + 14, 12, 8, 0, 0, TAU);
    ctx.fill();
    glowDot(ctx, cx - 5, cy + 15, 2.2, '#ef4444', '#fecaca');
    glowDot(ctx, cx + 5, cy + 15, 2.2, '#ef4444', '#fecaca');
  },
  // 暗黒星雲の魔王：うずまく紫の雲の中に、光る目。
  nebula(ctx, cx, cy, w, h, now) {
    for (let i = 0; i < 6; i += 1) {
      const a = now / 1500 + (i * TAU) / 6;
      ctx.fillStyle = 'rgba(147,51,234,0.45)';
      circle(ctx, cx + Math.cos(a) * 20, cy + Math.sin(a) * 12, 16);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.sin(now / 900) * 0.2);
    ctx.strokeStyle = 'rgba(244,114,182,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 42, 10, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = rGrad(ctx, cx, cy, 20, [[0, '#312e81'], [1, '#0a0014']]);
    circle(ctx, cx, cy, 18);
    ctx.fill();
    glowDot(ctx, cx - 7, cy - 2, 3, '#e879f9', '#ffffff');
    glowDot(ctx, cx + 7, cy - 2, 3, '#e879f9', '#ffffff');
    ctx.strokeStyle = '#e879f9';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy + 8);
    ctx.quadraticCurveTo(cx, cy + 4, cx + 6, cy + 8);
    ctx.stroke();
  },
  // 星の核（最終ボス）：回る金色の星と、まわりを回る光の玉。形態が進むほど赤くなる。
  final(ctx, cx, cy, w, h, now, b) {
    const form = b?.form || 1;
    const [light, dark] = form === 1 ? ['#fef08a', '#ca8a04'] : form === 2 ? ['#fed7aa', '#ea580c'] : ['#fecaca', '#dc2626'];
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(now / (form === 3 ? 500 : 900));
    ctx.fillStyle = vGrad(ctx, -30, 30, [[0, light], [1, dark]]);
    poly(ctx, Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * TAU;
      const r = i % 2 === 0 ? 30 : 14;
      return [Math.cos(a) * r, Math.sin(a) * r];
    }));
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = rGrad(ctx, cx, cy, 18, [[0, '#ffffff'], [0.5, light], [1, 'rgba(0,0,0,0)']]);
    circle(ctx, cx, cy, 18);
    ctx.fill();
    for (let i = 0; i < 4; i += 1) {
      const a = now / 600 + (i * TAU) / 4;
      glowDot(ctx, cx + Math.cos(a) * 38, cy + Math.sin(a) * 20, 3, dark, light);
    }
  },
};

export function drawBoss(ctx, b, pattern, now) {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  if (b.rage) {
    const r = b.w * 0.75 + Math.sin(now / 90) * 4;
    ctx.fillStyle = rGrad(ctx, cx, cy, r, [[0, 'rgba(239,68,68,0.45)'], [1, 'rgba(239,68,68,0)']]);
    circle(ctx, cx, cy, r);
    ctx.fill();
  }
  (BOSS_DRAW[pattern] || BOSS_DRAW.spiral)(ctx, cx, cy, b.w, b.h, now, b);
  if (b.hitUntil > now) {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ffffff';
    circle(ctx, cx, cy, b.w / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ---- 弾 ----

export function drawPlayerBullet(ctx, b) {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  if (b.pierce) {
    // レーザー：青く光る細長い光線。
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(b.x - 3, b.y, b.w + 6, b.h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = vGrad(ctx, b.y, b.y + b.h, [[0, '#ffffff'], [1, '#3b82f6']]);
    ctx.fillRect(b.x, b.y, b.w, b.h);
  } else if (b.homing) {
    glowDot(ctx, cx, cy, 3.5, '#22c55e', '#dcfce7');
  } else if (b.escort) {
    glowDot(ctx, cx, cy, 2.5, '#93c5fd', '#ffffff');
  } else if (b.spread) {
    glowDot(ctx, cx, cy, 3, '#fb923c', '#fff7ed');
  } else {
    ctx.fillStyle = 'rgba(253,224,71,0.35)';
    roundRect(ctx, b.x - 2, b.y - 2, b.w + 4, b.h + 4, 4);
    ctx.fill();
    ctx.fillStyle = vGrad(ctx, b.y, b.y + b.h, [[0, '#ffffff'], [1, '#facc15']]);
    roundRect(ctx, b.x, b.y, b.w, b.h, 3);
    ctx.fill();
  }
}

const EBULLET_COLOR = {
  normal: ['#f472b6', '#fdf2f8'],
  aimed: ['#f43f5e', '#ffe4e6'],
  leaf: ['#4ade80', '#f0fdf4'],
  rock: ['#b45309', '#fcd34d'],
  spiral: ['#a855f7', '#f3e8ff'],
  spark: ['#facc15', '#fefce8'],
  ink: ['#6d28d9', '#ddd6fe'],
  ice: ['#38bdf8', '#ffffff'],
};

export function drawEnemyBullet(ctx, eb) {
  const cx = eb.x + eb.w / 2;
  const cy = eb.y + eb.h / 2;
  const [color, core] = EBULLET_COLOR[eb.style] || EBULLET_COLOR.normal;
  if (eb.style === 'leaf') {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.atan2(eb.vy, eb.vx) + Math.PI / 2);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, eb.w / 2.6, eb.h / 1.6, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = core;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -eb.h / 1.8);
    ctx.lineTo(0, eb.h / 1.8);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (eb.style === 'rock') {
    ctx.fillStyle = rGrad(ctx, cx - 2, cy - 2, eb.w / 2 + 2, [[0, '#fcd34d'], [0.5, '#b45309'], [1, '#431407']]);
    circle(ctx, cx, cy, eb.w / 2);
    ctx.fill();
    return;
  }
  glowDot(ctx, cx, cy, eb.w / 2, color, core);
}

// ---- 予告つきの攻撃（雷の柱・火柱） ----

export function drawHazard(ctx, hz, now) {
  if (now < hz.warnUntil) {
    // 予告：点滅する赤い帯。
    const on = Math.floor(now / 100) % 2 === 0;
    ctx.fillStyle = on ? 'rgba(239,68,68,0.28)' : 'rgba(239,68,68,0.12)';
    ctx.fillRect(hz.x, hz.y, hz.w, hz.h);
    ctx.strokeStyle = 'rgba(248,113,113,0.8)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(hz.x, hz.y, hz.w, hz.h);
    ctx.setLineDash([]);
    ctx.fillStyle = '#fecaca';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('！', hz.x + hz.w / 2, hz.y + hz.h - 12);
    return;
  }
  const cx = hz.x + hz.w / 2;
  if (hz.kind === 'thunder') {
    ctx.fillStyle = 'rgba(253,224,71,0.35)';
    ctx.fillRect(hz.x - 6, hz.y, hz.w + 12, hz.h);
    ctx.fillStyle = vGrad(ctx, hz.y, hz.y + hz.h, [[0, '#ffffff'], [1, '#fde047']]);
    ctx.fillRect(cx - hz.w / 4, hz.y, hz.w / 2, hz.h);
  } else if (hz.kind === 'tentacle') {
    // 触手：紫の太い帯に吸盤の丸。
    ctx.fillStyle = vGrad(ctx, hz.y, hz.y + hz.h, [[0, '#a855f7'], [1, '#581c87']]);
    ctx.fillRect(hz.x, hz.y, hz.w, hz.h);
    ctx.fillStyle = 'rgba(243,232,255,0.8)';
    for (let y = hz.y + 12; y < hz.y + hz.h; y += 22) {
      circle(ctx, cx, y, 3.5);
      ctx.fill();
    }
  } else if (hz.kind === 'sand') {
    // 砂嵐：黄土色の帯に、流れる砂の筋。
    ctx.fillStyle = 'rgba(217,119,6,0.55)';
    ctx.fillRect(hz.x, hz.y, hz.w, hz.h);
    ctx.fillStyle = 'rgba(254,243,199,0.7)';
    for (let i = 0; i < 12; i += 1) {
      const y = hz.y + ((i * 47 + now / 3) % hz.h);
      ctx.fillRect(hz.x + ((i * 29) % hz.w), y, 10, 2);
    }
  } else {
    ctx.fillStyle = vGrad(ctx, hz.y, hz.y + hz.h, [[0, 'rgba(254,215,170,0.2)'], [0.4, '#fb923c'], [1, '#dc2626']]);
    ctx.fillRect(hz.x, hz.y, hz.w, hz.h);
    ctx.fillStyle = 'rgba(254,243,199,0.8)';
    ctx.fillRect(cx - 3, hz.y, 6, hz.h);
  }
}

// ---- アイテム ----

export function drawItem(ctx, it, now) {
  const cx = it.x + it.w / 2;
  const cy = it.y + it.h / 2 + Math.sin(now / 200 + it.x) * 1.5;
  const r = it.w / 2;
  const t = it.type;
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = t.color;
  circle(ctx, cx, cy, r + 5);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = rGrad(ctx, cx - 3, cy - 3, r + 2, [[0, '#ffffff'], [0.35, t.color], [1, t.color]]);
  circle(ctx, cx, cy, r);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (t.label) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(t.label, cx, cy + 1);
  } else {
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(t.icon || '?', cx, cy + 1);
  }
  ctx.textBaseline = 'alphabetic';
}

// ---- 爆発 ----

// boom: { x, y, start, until, size, color }。広がる光の輪と、飛び散る火花。
export function drawBoom(ctx, bm, now) {
  const p = Math.min(1, (now - bm.start) / (bm.until - bm.start));
  const r = bm.size * (0.3 + p * 0.9);
  ctx.globalAlpha = 1 - p;
  ctx.fillStyle = rGrad(ctx, bm.x, bm.y, r, [[0, '#ffffff'], [0.35, bm.color || '#fbbf24'], [1, 'rgba(239,68,68,0)']]);
  circle(ctx, bm.x, bm.y, r);
  ctx.fill();
  ctx.strokeStyle = bm.color || '#fbbf24';
  ctx.lineWidth = 2;
  circle(ctx, bm.x, bm.y, r * 1.15);
  ctx.stroke();
  const sparks = bm.size > 30 ? 12 : 6;
  ctx.fillStyle = '#fef3c7';
  for (let i = 0; i < sparks; i += 1) {
    const a = (i / sparks) * TAU + bm.seed;
    const d = r * 1.4 * p + 4;
    circle(ctx, bm.x + Math.cos(a) * d, bm.y + Math.sin(a) * d, 1.8 * (1 - p) + 0.5);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ボムを取ったときの画面の閃光。
export function drawFlash(ctx, w, h, alpha) {
  if (alpha <= 0) return;
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.fillRect(0, 0, w, h);
}

// 画面左上の、効いている効果の一覧（残り秒数つき）。
export function drawEffects(ctx, effects) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let x = 6;
  for (const ef of effects) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, x, 6, ef.text.length > 2 ? 44 : 30, 20, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(ef.text, x + 5, 9);
    x += (ef.text.length > 2 ? 44 : 30) + 4;
  }
  ctx.textBaseline = 'alphabetic';
}

// ステージ名・ボス出現などの帯。
export function drawBanner(ctx, w, h, text) {
  ctx.fillStyle = vGrad(ctx, h / 2 - 28, h / 2 + 28, [[0, 'rgba(0,0,0,0)'], [0.5, 'rgba(0,0,0,0.65)'], [1, 'rgba(0,0,0,0)']]);
  ctx.fillRect(0, h / 2 - 28, w, 56);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, h / 2 + 6);
}

export function drawPickupText(ctx, w, h, text) {
  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, h - 70);
}
