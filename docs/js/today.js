import {
  getChildren, getConfig, getToday, addCompletion, removeCompletion,
  getLoginBonusView, claimLoginBonus, moveTask, WEEKDAY_JP,
} from './store.js';
import { levelProgress } from './lib/levels.js';
import { flameTier } from './lib/streak.js';
import { todayStr, addDays, dayOfWeek } from './lib/dates.js';

// チェックし忘れをあとから直せるように、何日前まで遡れるか。
const MAX_BACK_DAYS = 14;

const state = {
  children: [],
  config: null,
  selectedId: null,
  viewDate: todayStr(),  // いま見ている日（既定は今日）
};

function init() {
  state.children = getChildren();
  state.config = getConfig();
  // 一人用：先頭の子をそのまま使う。
  state.selectedId = state.children[0]?.id;
  renderOwner();
  document.getElementById('login-claim-btn').onclick = handleClaimLoginBonus;
  document.getElementById('day-prev').onclick = () => shiftDay(-1);
  document.getElementById('day-next').onclick = () => shiftDay(1);
  document.getElementById('back-today').onclick = () => { state.viewDate = todayStr(); refresh(); };
  renderLoginBonus();
  refresh();
}

// ---- 日付の移動（チェックし忘れをあとから直すため） ----

function shiftDay(delta) {
  const next = addDays(state.viewDate, delta);
  if (next > todayStr()) return;                       // 未来は見られない
  if (next < addDays(todayStr(), -MAX_BACK_DAYS)) return; // 遡りすぎも止める
  state.viewDate = next;
  refresh();
}

function isToday() {
  return state.viewDate === todayStr();
}

function formatDayLabel(dateStr) {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}月${d}日（${WEEKDAY_JP[dayOfWeek(dateStr)]}）`;
}

// ---- デイリーボーナス ----

function renderLoginBonus() {
  const view = getLoginBonusView();
  document.getElementById('login-streak').textContent = `🔥${view.streak}日目`;
  const panel = document.getElementById('login-panel');
  const btn = document.getElementById('login-claim-btn');
  const msg = document.getElementById('login-msg');
  btn.hidden = !view.claimable;
  panel.classList.toggle('claimable', view.claimable);
  msg.classList.toggle('claimable', view.claimable);
  if (view.claimable) {
    msg.textContent = '🎁 タップして受け取ろう！';
  } else {
    msg.textContent = '今日はもう受け取ったよ。また明日！';
  }
}

let claimingLoginBonus = false;
function handleClaimLoginBonus() {
  if (claimingLoginBonus) return;
  claimingLoginBonus = true;
  const btn = document.getElementById('login-claim-btn');
  btn.disabled = true;
  btn.classList.add('shaking');
  setTimeout(() => {
    btn.classList.remove('shaking');
    const res = claimLoginBonus();
    claimingLoginBonus = false;
    renderLoginBonus();
    if (!res.ok) return;
    const r = res.reward;
    let text = `🔥${res.streak}日目 ・ 🪙+${r.baseCoins}`;
    if (r.gotBonus) text += `\nおまけ当たり！ 🪙+${r.bonusCoins}`;
    if (r.isMilestone) text += `\n${res.streak}日達成ボーナス！ 🪙+${r.milestoneCoins}`;
    const emoji = r.isMilestone ? '🎉' : (r.gotBonus ? '✨' : '🎁');
    showModal(emoji, 'デイリーボーナス！', text);
  }, 550);
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
  renderDayNav();
  const { items } = getToday(state.selectedId, state.viewDate);
  const list = document.getElementById('task-list');
  list.innerHTML = '';

  const label = isToday() ? '今日のタスク' : `${formatDayLabel(state.viewDate)}のタスク`;
  if (items.length === 0) {
    document.getElementById('today-title').textContent = label;
    list.innerHTML = isToday()
      ? '<div class="empty">今日のタスクはまだありません。<br>「設定」から追加できます。</div>'
      : '<div class="empty">この日の予定のタスクはありません。</div>';
    return;
  }
  const doneCount = items.filter((i) => i.done).length;
  document.getElementById('today-title').textContent = `${label}（${doneCount}/${items.length}）`;
  items.forEach((item, i) => {
    list.appendChild(taskCard(item, i === 0, i === items.length - 1));
  });
}

// 日付の見出し・前後ボタン・「過去を見ています」の帯を更新する。
function renderDayNav() {
  const past = !isToday();
  document.getElementById('task-panel').classList.toggle('viewing-past', past);
  document.getElementById('day-next').disabled = isToday();
  document.getElementById('day-prev').disabled = state.viewDate <= addDays(todayStr(), -MAX_BACK_DAYS);

  const banner = document.getElementById('past-banner');
  banner.hidden = !past;
  if (past) {
    document.getElementById('past-banner-text').textContent = `${formatDayLabel(state.viewDate)}にやった分を、ここでチェックできます`;
  }
}

// サブ情報はチップ1行に収める（チェックしても行数が増えないように）。
function subHtml(item) {
  const chips = [`<span class="t-pt">+${item.points}pt</span>`];
  if (item.doneCount > 0) {
    chips.push(`<span class="t-today-count">${isToday() ? '今日' : 'この日'}${item.doneCount}回</span>`);
  }
  const tier = flameTier(item.streak);
  if (tier > 0) chips.push(`<span class="flame flame-${tier}">🔥${item.streak}日</span>`);
  if (item.total > 0) chips.push(`<span class="t-total">計${item.total}回</span>`);
  return `<div class="t-sub">${chips.join('')}</div>`;
}

function taskCard(item, isFirst, isLast) {
  const card = document.createElement('div');
  card.className = 'task-card' + (item.done ? ' done' : '');

  // チェック丸：やった回数を表示（0回なら空、1回以上で回数）。
  const checkInner = item.doneCount > 0 ? `${item.doneCount}` : '';

  card.innerHTML = `
    <div class="t-reorder">
      <button class="t-move t-move-up" title="上へ動かす"${isFirst ? ' disabled' : ''}>▲</button>
      <button class="t-move t-move-down" title="下へ動かす"${isLast ? ' disabled' : ''}>▼</button>
    </div>
    <div class="t-icon" title="履歴を見る">${item.icon || '⭐'}</div>
    <div class="t-body">
      <div class="t-title">${item.title}</div>
      ${subHtml(item)}
    </div>
    ${item.doneCount > 0 ? '<button class="t-undo" title="1回もどす">−</button>' : ''}
    <div class="t-check${item.doneCount > 0 ? ' count' : ''}">${checkInner}</div>`;

  // アイコンタップで履歴ページへ（カード本体タップ=+1 と分離）。
  card.querySelector('.t-icon').onclick = (e) => {
    e.stopPropagation();
    location.href = `./task.html?id=${encodeURIComponent(item.id)}`;
  };
  const undoBtn = card.querySelector('.t-undo');
  if (undoBtn) {
    undoBtn.onclick = (e) => { e.stopPropagation(); undoOne(item); };
  }
  card.querySelector('.t-move-up').onclick = (e) => { e.stopPropagation(); reorder(item, -1); };
  card.querySelector('.t-move-down').onclick = (e) => { e.stopPropagation(); reorder(item, 1); };
  card.onclick = () => tapTask(item);
  return card;
}

// タスクの表示順を1つ上/下へ動かす（direction: -1 = 上, +1 = 下）。
function reorder(item, direction) {
  try {
    moveTask(item.id, direction, state.selectedId, state.viewDate);
    refresh();
  } catch (err) {
    console.error(err);
  }
}

// カードをタップするたびに1回ぶん記録する（何回でも）。
// 過去の日を見ているときは、その日の記録として追加される。
function tapTask(item) {
  try {
    const res = addCompletion({
      taskId: item.id,
      childId: state.selectedId,
      date: state.viewDate,
    });
    updateChildInState(res.child);
    refresh();
    celebrate(res);
  } catch (err) {
    console.error(err);
    alert('エラーが発生しました。もう一度試してください。');
  }
}

// 1回ぶん戻す（誤タップの取り消し）。
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
