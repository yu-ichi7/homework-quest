import express from 'express';
import { randomUUID } from 'node:crypto';
import { getTasks, updateTasks, getCompletions } from '../lib/store.js';
import { expandForDay, withCompletionState } from '../lib/taskExpand.js';
import { todayStr } from '../lib/dates.js';

export const router = express.Router();

// 全タスク定義（親の設定画面用）。
router.get('/', async (req, res, next) => {
  try {
    res.json({ tasks: await getTasks() });
  } catch (err) {
    next(err);
  }
});

// 今日やること（子どもメイン画面用）。?childId= 必須、?date= 省略時は今日。
router.get('/today', async (req, res, next) => {
  try {
    const { childId } = req.query;
    if (!childId) return res.status(400).json({ error: 'childId required' });
    const date = req.query.date || todayStr();
    const [tasks, completions] = await Promise.all([getTasks(), getCompletions()]);
    const expanded = expandForDay(tasks, childId, date);
    const items = withCompletionState(expanded, completions, childId, date);
    res.json({ date, childId, items });
  } catch (err) {
    next(err);
  }
});

// タスク登録（定番 routine / スポット spot）。
router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {};
    const kind = body.kind === 'spot' ? 'spot' : 'routine';
    const task = {
      id: randomUUID(),
      childId: body.childId || 'all',
      title: String(body.title || '').trim(),
      icon: body.icon || '⭐',
      points: Number.isFinite(body.points) ? body.points : Number(body.points) || 0,
      kind,
      days: kind === 'routine' ? (Array.isArray(body.days) ? body.days.map(Number) : []) : undefined,
      date: kind === 'spot' ? (body.date || todayStr()) : undefined,
      active: true,
      createdAt: new Date().toISOString(),
    };
    if (!task.title) return res.status(400).json({ error: 'title required' });
    if (kind === 'routine' && task.days.length === 0) {
      return res.status(400).json({ error: 'routine needs at least one day' });
    }
    await updateTasks((tasks) => { tasks.push(task); return tasks; });
    res.status(201).json({ task });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const body = req.body || {};
    let updated = null;
    await updateTasks((tasks) => {
      const t = tasks.find((x) => x.id === req.params.id);
      if (!t) return tasks;
      if (typeof body.title === 'string' && body.title.trim()) t.title = body.title.trim();
      if (typeof body.icon === 'string') t.icon = body.icon;
      if (body.points !== undefined) t.points = Number(body.points) || 0;
      if (Array.isArray(body.days)) t.days = body.days.map(Number);
      if (typeof body.childId === 'string') t.childId = body.childId;
      if (typeof body.active === 'boolean') t.active = body.active;
      if (typeof body.date === 'string') t.date = body.date;
      updated = t;
      return tasks;
    });
    if (!updated) return res.status(404).json({ error: 'task not found' });
    res.json({ task: updated });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    let removed = false;
    await updateTasks((tasks) => {
      const idx = tasks.findIndex((x) => x.id === req.params.id);
      if (idx >= 0) { tasks.splice(idx, 1); removed = true; }
      return tasks;
    });
    if (!removed) return res.status(404).json({ error: 'task not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
