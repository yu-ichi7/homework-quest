import { getChildren, getStats, getGoalsView, checkGoal, WEEKDAY_JP } from './store.js';

const state = { children: [], selectedId: null };

function init() {
  state.children = getChildren();
  // 一人用：先頭の子をそのまま使う。
  state.selectedId = state.children[0]?.id;
  refresh();
}

function refresh() {
  const stats = getStats(state.selectedId);
  document.getElementById('s-streak').innerHTML = `${stats.streak}<span class="u">日</span>`;
  document.getElementById('s-week').textContent = `${stats.week.count}`;
  document.getElementById('s-month').textContent = `${stats.month.points}`;
  renderBars(stats.last7);
  renderCalendar(stats);
  renderGoals();
}

function renderGoals() {
  const el = document.getElementById('goal-progress');
  const goals = getGoalsView();
  el.innerHTML = goals.length ? '' : '<div class="empty">今の目標はまだありません。「設定」から追加できます。</div>';
  for (const g of goals) {
    const row = document.createElement('div');
    row.className = 'task-row';
    const periodLabel = g.period === 'week' ? '今週' : '今月';
    if (g.kind === 'points') {
      row.innerHTML = `
        <div class="icon">${g.achieved ? '✅' : '🎯'}</div>
        <div class="meta">
          <div class="name">${g.title}</div>
          <div class="sub">${periodLabel} ・ ${g.current}/${g.target} ポイント</div>
          <div class="xpbar" style="margin-top:6px"><span style="width:${Math.round(g.ratio * 100)}%"></span></div>
        </div>`;
    } else {
      row.innerHTML = `
        <div class="icon">${g.achieved ? '✅' : '🎯'}</div>
        <div class="meta">
          <div class="name">${g.title}</div>
          <div class="sub">${periodLabel} ・ 自分でチェック</div>
        </div>`;
      const btn = document.createElement('button');
      btn.className = 'btn small';
      btn.textContent = g.achieved ? 'できた！' : 'まだ';
      btn.onclick = () => { checkGoal(g.id); refresh(); };
      row.appendChild(btn);
    }
    el.appendChild(row);
  }
}

function renderBars(last7) {
  const el = document.getElementById('bars');
  el.innerHTML = '';
  const max = Math.max(1, ...last7.map((d) => d.points));
  for (const d of last7) {
    const dow = WEEKDAY_JP[dayOfWeekJp(d.date)];
    const col = document.createElement('div');
    col.className = 'bar-col';
    const h = Math.round((d.points / max) * 100);
    col.innerHTML = `
      <div class="bar-val">${d.points || ''}</div>
      <div class="bar" style="height:${d.points ? Math.max(h, 5) : 0}%"></div>
      <div class="bar-label">${dow}</div>`;
    el.appendChild(col);
  }
}

function dayOfWeekJp(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function renderCalendar(stats) {
  const [y, m] = stats.today.split('-').map(Number);
  document.getElementById('cal-title').textContent = `${y}年 ${m}月のカレンダー`;
  const el = document.getElementById('cal');
  el.innerHTML = '';
  for (const w of WEEKDAY_JP) {
    const h = document.createElement('div');
    h.className = 'dow';
    h.textContent = w;
    el.appendChild(h);
  }
  const first = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  for (let i = 0; i < first; i += 1) {
    const c = document.createElement('div');
    c.className = 'cell empty';
    el.appendChild(c);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const ds = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const info = stats.byDate[ds];
    const cell = document.createElement('div');
    cell.className = 'cell' + (info ? ' done' : '') + (ds === stats.today ? ' today' : '');
    cell.innerHTML = `<div>${day}</div>` + (info ? `<div class="pt">${info.points}</div>` : '');
    el.appendChild(cell);
  }
}

try {
  init();
} catch (err) {
  console.error(err);
}
