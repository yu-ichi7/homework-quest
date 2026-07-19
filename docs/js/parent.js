import {
  getChildren, getTasks, addTask, deleteTask, updateChild,
  exportData, importData, WEEKDAY_JP,
  getGoalsView, addGoal, deleteGoal,
} from './store.js';
import { todayStr } from './lib/dates.js';

const state = { children: [], tasks: [], goals: [] };

function init() {
  load();
  buildDayPicker();
  wireForm();
  wireGoalForm();
  wireBackup();
}

function load() {
  state.children = getChildren();
  state.tasks = getTasks();
  state.goals = getGoalsView();
  renderTaskLists();
  renderChildEdit();
  renderGoalList();
}

function buildDayPicker() {
  const el = document.getElementById('f-days');
  el.innerHTML = '';
  WEEKDAY_JP.forEach((w, i) => {
    const lbl = document.createElement('label');
    lbl.innerHTML = `<input type="checkbox" value="${i}" ${i >= 1 && i <= 5 ? 'checked' : ''}/><span>${w}</span>`;
    el.appendChild(lbl);
  });
}

function wireForm() {
  const kind = document.getElementById('f-kind');
  kind.onchange = () => {
    const isSpot = kind.value === 'spot';
    document.getElementById('days-field').hidden = isSpot;
    document.getElementById('date-field').hidden = !isSpot;
  };
  document.getElementById('f-add').onclick = handleAddTask;
}

function handleAddTask() {
  const kind = document.getElementById('f-kind').value;
  const body = {
    childId: 'all',
    title: document.getElementById('f-title').value,
    icon: document.getElementById('f-icon').value || '⭐',
    points: Number(document.getElementById('f-points').value) || 0,
    kind,
  };
  if (kind === 'routine') {
    body.days = [...document.querySelectorAll('#f-days input:checked')].map((i) => Number(i.value));
  } else {
    body.date = document.getElementById('f-date').value;
  }
  const msg = document.getElementById('f-msg');
  try {
    addTask(body);
    msg.textContent = '✅ 追加しました';
    document.getElementById('f-title').value = '';
    document.getElementById('f-icon').value = '';
    load();
  } catch (err) {
    msg.textContent = '⚠️ ' + err.message;
  }
}

function renderTaskLists() {
  const routines = state.tasks.filter((t) => t.kind === 'routine');
  const spots = state.tasks.filter((t) => t.kind === 'spot');
  document.getElementById('routine-list').innerHTML = routines.length
    ? '' : '<div class="empty">まだありません</div>';
  routines.forEach((t) => document.getElementById('routine-list').appendChild(taskRow(t)));

  document.getElementById('spot-list').innerHTML = spots.length
    ? '' : '<div class="empty">まだありません</div>';
  spots.forEach((t) => document.getElementById('spot-list').appendChild(taskRow(t)));
}

function taskRow(t) {
  const row = document.createElement('div');
  row.className = 'task-row';
  const sub = t.kind === 'routine'
    ? (t.days || []).map((d) => WEEKDAY_JP[d]).join('・')
    : t.date;
  row.innerHTML = `
    <div class="icon">${t.icon || '⭐'}</div>
    <div class="meta">
      <div class="name">${t.title}</div>
      <div class="sub">${sub} ・ ${t.points}ポイント</div>
    </div>`;
  const del = document.createElement('button');
  del.className = 'btn danger small';
  del.textContent = '削除';
  del.onclick = () => {
    if (!confirm(`「${t.title}」を削除しますか？`)) return;
    deleteTask(t.id);
    load();
  };
  row.appendChild(del);
  return row;
}

function renderChildEdit() {
  const el = document.getElementById('child-edit');
  el.innerHTML = '';
  for (const c of state.children) {
    const row = document.createElement('div');
    row.className = 'task-row';
    row.innerHTML = `
      <input class="name-in" value="${c.name}" style="flex:2" />
      <input class="color-in" type="color" value="${c.color}" style="flex:0 0 48px; padding:2px; height:44px" />`;
    const save = document.createElement('button');
    save.className = 'btn small';
    save.textContent = '保存';
    save.onclick = () => {
      updateChild(c.id, {
        name: row.querySelector('.name-in').value,
        color: row.querySelector('.color-in').value,
      });
      load();
    };
    row.appendChild(save);
    el.appendChild(row);
  }
}

// ---- 目標（週 / 月） ----

function wireGoalForm() {
  const kind = document.getElementById('g-kind');
  kind.onchange = () => {
    document.getElementById('g-target-field').hidden = kind.value === 'freetext';
  };
  document.getElementById('g-add').onclick = handleAddGoal;
}

function handleAddGoal() {
  const body = {
    title: document.getElementById('g-title').value,
    period: document.getElementById('g-period').value,
    kind: document.getElementById('g-kind').value,
    target: document.getElementById('g-target').value,
  };
  const msg = document.getElementById('g-msg');
  try {
    addGoal(body);
    msg.textContent = '✅ 追加しました';
    document.getElementById('g-title').value = '';
    load();
  } catch (err) {
    msg.textContent = '⚠️ ' + err.message;
  }
}

function renderGoalList() {
  const el = document.getElementById('goal-list');
  el.innerHTML = state.goals.length ? '' : '<div class="empty">今の目標はまだありません</div>';
  for (const g of state.goals) {
    const row = document.createElement('div');
    row.className = 'task-row';
    const periodLabel = g.period === 'week' ? '今週' : '今月';
    const sub = g.kind === 'points'
      ? `${periodLabel} ・ ${g.current}/${g.target} ポイント`
      : `${periodLabel} ・ 自分でチェック`;
    row.innerHTML = `
      <div class="icon">${g.achieved ? '✅' : '🎯'}</div>
      <div class="meta">
        <div class="name">${g.title}</div>
        <div class="sub">${sub}</div>
      </div>`;
    const del = document.createElement('button');
    del.className = 'btn danger small';
    del.textContent = '削除';
    del.onclick = () => {
      if (!confirm(`「${g.title}」を削除しますか？`)) return;
      deleteGoal(g.id);
      load();
    };
    row.appendChild(del);
    el.appendChild(row);
  }
}

// ---- バックアップ ----

function wireBackup() {
  document.getElementById('backup-export').onclick = () => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `homework-quest-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    document.getElementById('backup-msg').textContent = '✅ 書き出しました';
  };

  const fileInput = document.getElementById('backup-file');
  document.getElementById('backup-import').onclick = () => fileInput.click();
  fileInput.onchange = async () => {
    const msg = document.getElementById('backup-msg');
    const file = fileInput.files[0];
    if (!file) return;
    if (!confirm('今のデータをバックアップの内容で置き換えます。よろしいですか？')) {
      fileInput.value = '';
      return;
    }
    try {
      const text = await file.text();
      importData(JSON.parse(text));
      msg.textContent = '✅ 読み込みました';
      load();
    } catch (err) {
      console.error(err);
      msg.textContent = '⚠️ ' + (err.message || '読み込みに失敗しました');
    } finally {
      fileInput.value = '';
    }
  };
}

try {
  init();
} catch (err) {
  console.error(err);
}
