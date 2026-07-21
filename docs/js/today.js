import { getChildren, getConfig, getToday, addCompletion, removeCompletion } from './store.js';
import { levelProgress } from './lib/levels.js';
import { flameTier } from './lib/streak.js';

const state = {
  children: [],
  config: null,
  selectedId: null,
};

function init() {
  state.children = getChildren();
  state.config = getConfig();
  // 一人用：先頭の子をそのまま使う。
  state.selectedId = state.children[0]?.id;
  renderOwner();
  refresh();
}

// ヘッダー下に「だれのページか」を名前で表示する。
function renderOwner() {
  const el = document.getElementById('owner');
  if (!el) return;
  const c = currentChild();
  if (!c) return;
  el.innerHTML = `<span class="avatar" style="background:${c.color}">${[...c.name][0] || '？'}</span>${c.name}`;
}

function currentChild() {
  return state.children.find((c) => c.id === state.selectedId);
}

function renderLevel() {
  const child = currentChild();
  const prog = levelProgress(child.xp, state.config.levels);
  document.getElementById('lv-num').textContent = prog.level;
  document.getElementById('lv-name').textContent = prog.name;
  document.getElementById('lv-sub').textContent = prog.isMax
    ? `最高レベル！ 合計 ${child.xp} ポイント`
    : `あと ${prog.xpForNext} ポイントで レベル${prog.level + 1}`;
  document.getElementById('xp-fill').style.width = `${Math.round(prog.ratio * 100)}%`;
  document.querySelector('.level-badge').style.background = child.color;

  const badgesEl = document.getElementById('badges');
  badgesEl.innerHTML = '';
  for (const b of state.config.badges) {
    const earned = child.badges.includes(b.id);
    const chip = document.createElement('span');
    chip.className = 'badge-chip' + (earned ? '' : ' locked');
    chip.innerHTML = `<span>${b.icon}</span>${earned ? b.name : '？？？'}`;
    chip.title = earned ? b.desc : `条件: ${b.desc}`;
    badgesEl.appendChild(chip);
  }
}

function refresh() {
  renderLevel();
  const { items } = getToday(state.selectedId);
  const list = document.getElementById('task-list');
  list.innerHTML = '';
  if (items.length === 0) {
    list.innerHTML = '<div class="empty">今日のタスクはまだありません。<br>「設定」から追加できます。</div>';
    return;
  }
  const doneCount = items.filter((i) => i.done).length;
  document.getElementById('today-title').textContent = `今日のタスク（${doneCount}/${items.length}）`;
  for (const item of items) {
    list.appendChild(taskCard(item));
  }
}

// タスクの継続を炎バッジ＋累計で表す。
function streakHtml(item) {
  if (!item.total || item.total === 0) return '';
  const tier = flameTier(item.streak);
  if (tier === 0) {
    // 最近は途切れているが累計はある。
    return `<div class="t-streak"><span class="t-total">累計 ${item.total}回</span></div>`;
  }
  return `<div class="t-streak">
      <span class="flame flame-${tier}">🔥 ${item.streak}日れんぞく</span>
      <span class="t-total">累計 ${item.total}回</span>
    </div>`;
}

function taskCard(item) {
  const multi = item.targetCount > 1;
  const card = document.createElement('div');
  card.className = 'task-card' + (item.done ? ' done' : '');

  // チェック丸：満杯で✓、回数タスクで途中なら「2/3」を小さく表示。
  const checkInner = item.done ? '✓' : (multi ? `${item.doneCount}/${item.targetCount}` : '');
  const pointsLabel = multi
    ? `+${item.points} ポイント ×${item.targetCount}回`
    : `+${item.points} ポイント`;

  card.innerHTML = `
    <div class="t-icon">${item.icon || '⭐'}</div>
    <div class="t-body">
      <div class="t-title">${item.title}</div>
      <div class="t-points">${pointsLabel}</div>
      ${streakHtml(item)}
    </div>
    <button class="t-history" title="履歴を見る">📈</button>
    ${multi && item.doneCount > 0 && !item.done ? '<button class="t-undo" title="1回もどす">−</button>' : ''}
    ${multi && item.done ? '<button class="t-undo" title="1回もどす">−</button>' : ''}
    <div class="t-check${multi && !item.done ? ' count' : ''}">${checkInner}</div>`;

  card.querySelector('.t-history').onclick = (e) => {
    e.stopPropagation();
    location.href = `./task.html?id=${encodeURIComponent(item.id)}`;
  };
  const undoBtn = card.querySelector('.t-undo');
  if (undoBtn) {
    undoBtn.onclick = (e) => { e.stopPropagation(); undoOne(item); };
  }
  card.onclick = () => toggle(item);
  return card;
}

function toggle(item) {
  try {
    const target = item.targetCount || 1;
    if (item.doneCount < target) {
      // まだ回数が残っている → ＋1
      const res = addCompletion({ taskId: item.id, childId: state.selectedId });
      updateChildInState(res.child);
      refresh();
      celebrate(res);
    } else if (target === 1 && item.lastCompletionId) {
      // 回数1のタスクは、満杯タップで取り消し（従来どおり）
      const res = removeCompletion(item.lastCompletionId);
      updateChildInState(res.child);
      refresh();
    }
    // 回数タスクが満杯のときは、カードタップでは何もしない（「−」で戻す）
  } catch (err) {
    console.error(err);
    alert('エラーが発生しました。もう一度試してください。');
  }
}

// 回数タスクを1回ぶん戻す。
function undoOne(item) {
  try {
    if (!item.lastCompletionId) return;
    const res = removeCompletion(item.lastCompletionId);
    updateChildInState(res.child);
    refresh();
  } catch (err) {
    console.error(err);
  }
}

function updateChildInState(child) {
  if (!child) return;
  const idx = state.children.findIndex((c) => c.id === child.id);
  if (idx >= 0) state.children[idx] = child;
}

// 起きたお祝いを順番に見せる（レベルアップ→バッジ→アイス）。
let modalQueue = [];
function celebrate(res) {
  modalQueue = [];
  if (res.leveledUp) {
    const prog = levelProgress(res.child.xp, state.config.levels);
    modalQueue.push(['🎊', `レベルアップ！ レベル${prog.level}`, `称号「${prog.name}」に到達！`]);
  }
  if (res.newBadges && res.newBadges.length > 0) {
    const b = res.newBadges[0];
    modalQueue.push([b.icon, 'バッジ獲得！', `「${b.name}」— ${b.desc}`]);
  }
  if (res.iceCreamsGained > 0) {
    modalQueue.push(['🍦', 'アイスクリームバッジ！', `${res.iceCreamsGained}こ もらった！「記録」ページでタップして使えるよ`]);
  }
  showNextModal();
}

function showNextModal() {
  const next = modalQueue.shift();
  if (!next) return;
  showModal(next[0], next[1], next[2]);
}

function showModal(emoji, title, text) {
  document.getElementById('modal-emoji').textContent = emoji;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-text').textContent = text;
  document.getElementById('modal').hidden = false;
}
document.getElementById('modal-ok').onclick = () => {
  document.getElementById('modal').hidden = true;
  // 続きのお祝いがあれば見せる。
  if (modalQueue.length > 0) setTimeout(showNextModal, 150);
};

try {
  init();
} catch (err) {
  console.error(err);
  document.getElementById('task-list').innerHTML = '<div class="empty">読み込みに失敗しました</div>';
}
