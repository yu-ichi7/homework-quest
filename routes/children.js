import express from 'express';
import { getChildren, updateChildren } from '../lib/store.js';

export const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json({ children: await getChildren() });
  } catch (err) {
    next(err);
  }
});

// 名前・色の編集のみ許可（xp/level/badges は達成ログから算出するので触らせない）。
router.put('/:id', async (req, res, next) => {
  try {
    const { name, color } = req.body || {};
    let updated = null;
    await updateChildren((children) => {
      const child = children.find((c) => c.id === req.params.id);
      if (!child) return children;
      if (typeof name === 'string' && name.trim()) child.name = name.trim();
      if (typeof color === 'string' && color.trim()) child.color = color.trim();
      updated = child;
      return children;
    });
    if (!updated) return res.status(404).json({ error: 'child not found' });
    res.json({ child: updated });
  } catch (err) {
    next(err);
  }
});
