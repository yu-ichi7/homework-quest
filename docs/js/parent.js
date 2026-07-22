import {
  getChildren, getTasks, addTask, updateTask, deleteTask, updateChild,
  exportData, importData, WEEKDAY_JP,
} from './store.js';
import { todayStr } from './lib/dates.js';

// アイコンパレット（勉強・お手伝い・運動・生活・趣味など）。
const TASK_ICONS = [
  '📚', '📖', '✏️', '📝', '🧮', '🔤', '🎒',
  '🧹', '🧽', '🍽️', '🛁', '🗑️', '🧺', '🍚',
  '🏃', '💪', '⚽', '🚴', '🤸', '🏊', '⚾',
  '🦷', '🛏️', '🌅', '🐶', '🌱', '💊',
  '🎹', '🎸', '🎨', '🎯', '⭐', '🔥',
];

const state = { children: [], tasks: [], editingId: null, icon: '📚' };

function init() {
  load();
  buildDayPicker();
  buildIconPicker();
  wireForm();
  wireBackup();
}

function load() {
  state.children = getChildren();
  state.tasks = getTasks();
  renderTaskLists();
  renderChildEdit();
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

function buildIconPicker() {
  const panel = document.getElementById('f-icon-pick');
  panel.innerHTML = '';
  for (const ic of TASK_ICONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-opt';
    btn.textContent = ic;
    btn.onclick = () => { setIcon(ic); closeIconPanel(); };
    panel.appendChild(btn);
  }
  // ドロップダウンの開閉。
  document.getElementById('f-icon-btn').onclick = (e) => {
    e.stopPropagation();
    panel.hidden = !panel.hidden;
  };
  // 外側をタップしたら閉じる。
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.icon-dropdown')) closeIconPanel();
  });
  // 自由入力欄で打った絵文字も選択として反映する。
  document.getElementById('f-icon').oninput = (e) => {
    const v = [...(e.target.value || '')][0];
    if (v) { state.icon = v; refreshIconUI(); }
  };
  setIcon(state.icon);
}

function closeIconPanel() {
  document.getElementById('f-icon-pick').hidden = true;
}

function setIcon(ic) {
  state.icon = ic;
  document.getElementById('f-icon').value = '';
  refreshIconUI();
}

function refreshIconUI() {
  document.getElementById('f-icon-current').textContent = state.icon;
  document.querySelectorAll('#f-icon-pick .icon-opt').forEach((b) => {
    b.classList.toggle('active', b.textContent === state.icon);
  });
}

function wireForm() {
  const kind = document.getElementById('f-kind');
  kind.onchange = () => {
    const isSpot = kind.value === 'spot';
    document.getElementById('days-field').hidden = isSpot;
    document.getElementById('date-field').hidden = !isSpot;
  };
  document.getElementById('f-add').onclick = handleSubmitTask;
  document.getElementById('f-cancel').onclick = exitEditMode;
}

function handleSubmitTask() {
  const kind = document.getElementById('f-kind').value;
  const freeIcon = [...(document.getElementById('f-icon').value || '')][0];
  const body = {
    childId: 'all',
    title: document.getElementById('f-title').value,
    icon: freeIcon || state.icon || '⭐',
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
    if (state.editingId) {
      updateTask(state.editingId, body);
      msg.textContent = '✅ 更新しました';
    } else {
      addTask(body);
      msg.textContent = '✅ 追加しました';
    }
    exitEditMode();
    load();
  } catch (err) {
    msg.textContent = '⚠️ ' + err.message;
  }
}

function enterEditMode(task) {
  state.editingId = task.id;
  document.getElementById('f-heading').textContent = 'タスクを編集';
  document.getElementById('f-add').textContent = '更新する';
  document.getElementById('f-cancel').hidden = false;
  document.getElementById('f-title').value = task.title;
  setIcon(task.icon || '📚');
  document.getElementById('f-points').value = task.points;
  document.getElementById('f-kind').value = task.kind;
  const isSpot = task.kind === 'spot';
  document.getElementById('days-field').hidden = isSpot;
  document.getElementById('date-field').hidden = !isSpot;
  if (isSpot) {
    document.getElementById('f-date').value = task.date || '';
  } else {
    const days = task.days || [];
    document.querySelectorAll('#f-days input').forEach((input) => {
      input.checked = days.includes(Number(input.value));
    });
  }
  document.getElementById('f-heading').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function exitEditMode() {
  state.editingId = null;
  document.getElementById('f-heading').textContent = 'タスクを追加';
  document.getElementById('f-add').textContent = '追加する';
  document.getElementById('f-cancel').hidden = true;
  document.getElementById('f-title').value = '';
  setIcon('📚');
  document.getElementById('f-points').value = 10;
  document.getElementById('f-kind').value = 'routine';
  document.getElementById('days-field').hidden = false;
  document.getElementById('date-field').hidden = true;
  document.querySelectorAll('#f-days input').forEach((input, i) => {
    input.checked = i >= 1 && i <= 5;
  });
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
  const schedule = t.kind === 'routine'
    ? (t.days || []).map((d) => WEEKDAY_JP[d]).join('・')
    : t.date;
  row.innerHTML = `
    <div class="icon">${t.icon || '⭐'}</div>
    <div class="meta">
      <div class="name">${t.title}</div>
      <div class="sub">${schedule} ・ ${t.points}ポイント</div>
    </div>`;
  const hist = document.createElement('button');
  hist.className = 'btn small secondary';
  hist.textContent = '履歴';
  hist.onclick = () => { location.href = `./task.html?id=${encodeURIComponent(t.id)}`; };
  row.appendChild(hist);
  const edit = document.createElement('button');
  edit.className = 'btn small secondary';
  edit.textContent = '編集';
  edit.onclick = () => enterEditMode(t);
  row.appendChild(edit);
  const del = document.createElement('button');
  del.className = 'btn danger small';
  del.textContent = '削除';
  del.onclick = () => {
    if (!confirm(`「${t.title}」を削除しますか？`)) return;
    if (state.editingId === t.id) exitEditMode();
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
