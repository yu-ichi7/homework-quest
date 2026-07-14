import express from 'express';
import { getConfig } from '../lib/store.js';

export const router = express.Router();

// レベル閾値・バッジ定義（親の確認用、クライアントのレベル名/バッジ名表示用）。
router.get('/', async (req, res, next) => {
  try {
    res.json(await getConfig());
  } catch (err) {
    next(err);
  }
});
