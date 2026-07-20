import { getChildren, getConfig, getToday, addCompletion, removeCompletion } from './store.js';
import { levelProgress } from './lib/levels.js';

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

function taskCard(item) {
  const card = document.createElement('div');
  card.className = 'task-card' + (item.done ? ' done' : '');
  card.innerHTML = `
    <div class="t-icon">${item.icon || '⭐'}</div>
    <div class="t-body">
      <div class="t-title">${item.title}</div>
      <div class="t-points">+${item.points} ポイント</div>
    </div>
    <div class="t-check">✓</div>`;
  card.onclick = () => toggle(item);
  return card;
}

function toggle(item) {
  try {
    if (!item.done) {
      const res = addCompletion({ taskId: item.id, childId: state.selectedId });
      updateChildInState(res.child);
      refresh();
      celebrate(res);
    } else if (item.completionId) {
      const res = removeCompletion(item.completionId);
      updateChildInState(res.child);
      refresh();
    }
  } catch (err) {
    console.error(err);
    alert('エラーが発生しました。もう一度試してください。');
  }
}

function updateChildInState(child) {
  if (!child) return;
  const idx = state.children.findIndex((c) => c.id === child.id);
  if (idx >= 0) state.children[idx] = child;
}

function celebrate(res) {
  if (res.leveledUp) {
    const prog = levelProgress(res.child.xp, state.config.levels);
    showModal('🎊', `レベルアップ！ レベル${prog.level}`, `称号「${prog.name}」に到達！`);
  } else if (res.newBadges && res.newBadges.length > 0) {
    const b = res.newBadges[0];
    showModal(b.icon, 'バッジ獲得！', `「${b.name}」— ${b.desc}`);
  }
}

function showModal(emoji, title, text) {
  document.getElementById('modal-emoji').textContent = emoji;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-text').textContent = text;
  document.getElementById('modal').hidden = false;
}
document.getElementById('modal-ok').onclick = () => { document.getElementById('modal').hidden = true; };

try {
  init();
} catch (err) {
  console.error(err);
  document.getElementById('task-list').innerHTML = '<div class="empty">読み込みに失敗しました</div>';
}
