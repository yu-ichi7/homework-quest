import express from 'express';
import { randomUUID } from 'node:crypto';
import {
  getTasks, getConfig, getCompletions,
  updateCompletions, updateChildren, getChildren,
} from '../lib/store.js';
import { recomputeChild } from '../lib/progress.js';
import { todayStr } from '../lib/dates.js';

export const router = express.Router();

// 達成ログの取得（カレンダー/グラフ用）。?childId=&from=&to=（from/to は YYYY-MM-DD）。
router.get('/', async (req, res, next) => {
  try {
    let list = await getCompletions();
    const { childId, from, to } = req.query;
    if (childId) list = list.filter((c) => c.childId === childId);
    if (from) list = list.filter((c) => c.date >= from);
    if (to) list = list.filter((c) => c.date <= to);
    res.json({ completions: list });
  } catch (err) {
    next(err);
  }
});

// チェック時。completion 追加 → 対象 child を達成ログから再計算。
// レベルアップ / 新バッジを検出して返し、画面のお祝い演出に使う。
router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {};
    const { taskId, childId } = body;
    const date = body.date || todayStr();
    if (!taskId || !childId) return res.status(400).json({ error: 'taskId and childId required' });

    const [tasks, children] = await Promise.all([getTasks(), getChildren()]);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return res.status(404).json({ error: 'task not found' });
    if (!children.find((c) => c.id === childId)) return res.status(404).json({ error: 'child not found' });

    // 二重達成防止（同じ子・タスク・日付）。
    const existing = (await getCompletions()).find(
      (c) => c.taskId === taskId && c.childId === childId && c.date === date,
    );
    if (existing) return res.status(409).json({ error: 'already completed', completion: existing });

    const completion = {
      id: randomUUID(),
      taskId,
      childId,
      date,
      title: task.title,
      icon: task.icon,
      points: task.points,
      completedAt: new Date().toISOString(),
    };

    const allCompletions = await updateCompletions((list) => { list.push(completion); return list; });
    const config = await getConfig();

    const before = children.find((c) => c.id === childId);
    let after = null;
    await updateChildren((list) => {
      const child = list.find((c) => c.id === childId);
      if (!child) return list;
      const recomputed = recomputeChild(child, allCompletions, config);
      Object.assign(child, recomputed);
      after = child;
      return list;
    });

    const leveledUp = after && after.level > before.level;
    const newBadges = after
      ? config.badges.filter((b) => after.badges.includes(b.id) && !before.badges.includes(b.id))
      : [];

    res.status(201).json({ completion, child: after, leveledUp, newBadges });
  } catch (err) {
    next(err);
  }
});

// チェック外し（誤タップ取り消し）。completion 削除 → child 再計算。
router.delete('/:id', async (req, res, next) => {
  try {
    let removed = null;
    const allCompletions = await updateCompletions((list) => {
      const idx = list.findIndex((c) => c.id === req.params.id);
      if (idx >= 0) { removed = list[idx]; list.splice(idx, 1); }
      return list;
    });
    if (!removed) return res.status(404).json({ error: 'completion not found' });

    const config = await getConfig();
    let after = null;
    await updateChildren((list) => {
      const child = list.find((c) => c.id === removed.childId);
      if (!child) return list;
      const recomputed = recomputeChild(child, allCompletions, config);
      Object.assign(child, recomputed);
      after = child;
      return list;
    });

    res.json({ ok: true, child: after });
  } catch (err) {
    next(err);
  }
});
