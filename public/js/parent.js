let state = { children: [], tasks: [] };

async function init() {
  await load();
  buildDayPicker();
  wireForm();
}

async function load() {
  const [{ children }, { tasks }] = await Promise.all([
    api.get('/api/children'),
    api.get('/api/tasks'),
  ]);
  state.children = children;
  state.tasks = tasks;
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

function wireForm() {
  const kind = document.getElementById('f-kind');
  kind.onchange = () => {
    const isSpot = kind.value === 'spot';
    document.getElementById('days-field').hidden = isSpot;
    document.getElementById('date-field').hidden = !isSpot;
  };
  document.getElementById('f-add').onclick = addTask;
}

async function addTask() {
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
    await api.post('/api/tasks', body);
    msg.textContent = '✅ 追加しました';
    document.getElementById('f-title').value = '';
    document.getElementById('f-icon').value = '';
    await load();
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
  del.onclick = async () => {
    if (!confirm(`「${t.title}」を削除しますか？`)) return;
    await api.del(`/api/tasks/${t.id}`);
    await load();
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
    save.onclick = async () => {
      await api.put(`/api/children/${c.id}`, {
        name: row.querySelector('.name-in').value,
        color: row.querySelector('.color-in').value,
      });
      await load();
    };
    row.appendChild(save);
    el.appendChild(row);
  }
}

init().catch((err) => console.error(err));
