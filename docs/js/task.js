import { getTaskHistory, WEEKDAY_JP } from './store.js';
import { dayOfWeek } from './lib/dates.js';

const MONTHS_BACK = 3; // 今月を含めて直近3ヶ月

function getParam(name) {
  return new URLSearchParams(location.search).get(name);
}

function init() {
  document.getElementById('back-link').onclick = (e) => {
    e.preventDefault();
    if (history.length > 1) history.back(); else location.href = './parent.html';
  };

  const id = getParam('id');
  const hist = id ? getTaskHistory(id) : null;
  if (!hist) {
    document.getElementById('heatmaps').innerHTML = '<div class="empty">タスクが見つかりませんでした。</div>';
    return;
  }
  render(hist);
}

// そのタスクがその日「予定日」か。
function isScheduled(task, y, m, day) {
  const ds = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (task.kind === 'spot') return task.date === ds;
  return Array.isArray(task.days) && task.days.includes(dayOfWeek(ds));
}

// やった回数から色の段階（0=なし, 1〜3=多いほど濃い）を返す。
function heatLevel(count) {
  if (count <= 0) return 0;
  if (count >= 3) return 3;
  if (count === 2) return 2;
  return 1;
}

function render(hist) {
  const { task } = hist;
  document.getElementById('t-icon').textContent = task.icon || '📈';
  document.getElementById('t-name').textContent = task.title;
  document.title = `${task.title}の履歴 | お手伝いクエスト`;

  document.getElementById('s-streak').innerHTML = `${hist.streak}<span class="u">日</span>`;
  document.getElementById('s-total').textContent = hist.total;
  document.getElementById('s-target').textContent = `${hist.todayCount || 0}回`;

  const [ty, tm] = hist.today.split('-').map(Number);
  const container = document.getElementById('heatmaps');
  container.innerHTML = '';

  for (let back = 0; back < MONTHS_BACK; back += 1) {
    let y = ty;
    let m = tm - back;
    while (m <= 0) { m += 12; y -= 1; }
    container.appendChild(monthBlock(hist, y, m));
  }
}

function monthBlock(hist, y, m) {
  const { task, countByDate, today } = hist;
  const wrap = document.createElement('div');
  wrap.className = 'hist-month';

  const title = document.createElement('div');
  title.className = 'hist-month-title';
  title.textContent = `${y}年 ${m}月`;
  wrap.appendChild(title);

  const cal = document.createElement('div');
  cal.className = 'cal';
  for (const w of WEEKDAY_JP) {
    const h = document.createElement('div');
    h.className = 'dow';
    h.textContent = w;
    cal.appendChild(h);
  }
  const first = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  for (let i = 0; i < first; i += 1) {
    const c = document.createElement('div');
    c.className = 'cell empty';
    cal.appendChild(c);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const ds = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const count = countByDate[ds] || 0;
    const scheduled = isScheduled(task, y, m, day);
    const cell = document.createElement('div');
    let cls = 'cell';
    if (count > 0) cls += ` heat-${heatLevel(count)}`;
    else if (scheduled) cls += ' scheduled';
    if (ds === today) cls += ' today';
    cell.className = cls;
    const countLabel = count > 1 ? `<div class="pt">${count}</div>` : '';
    cell.innerHTML = `<div>${day}</div>${countLabel}`;
    cal.appendChild(cell);
  }
  wrap.appendChild(cal);
  return wrap;
}

try {
  init();
} catch (err) {
  console.error(err);
}
