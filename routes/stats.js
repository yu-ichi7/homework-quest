import express from 'express';
import { getCompletions } from '../lib/store.js';
import { computeStreak } from '../lib/streak.js';
import { todayStr, addDays } from '../lib/dates.js';

export const router = express.Router();

// ?childId= のストリーク・週間/月間集計、直近7日/当月の日別データを返す。
router.get('/', async (req, res, next) => {
  try {
    const { childId } = req.query;
    if (!childId) return res.status(400).json({ error: 'childId required' });
    const today = req.query.date || todayStr();
    const mine = (await getCompletions()).filter((c) => c.childId === childId);

    const streak = computeStreak(mine, today);

    // 直近7日の日別（達成数・ポイント）。
    const last7 = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = addDays(today, -i);
      const dayItems = mine.filter((c) => c.date === d);
      last7.push({
        date: d,
        count: dayItems.length,
        points: dayItems.reduce((s, c) => s + (c.points || 0), 0),
      });
    }

    const week = last7.reduce(
      (acc, d) => ({ count: acc.count + d.count, points: acc.points + d.points }),
      { count: 0, points: 0 },
    );

    const month = today.slice(0, 7); // YYYY-MM
    const monthItems = mine.filter((c) => c.date.startsWith(month));
    const monthAgg = {
      count: monthItems.length,
      points: monthItems.reduce((s, c) => s + (c.points || 0), 0),
    };

    // 当月の達成日（カレンダーのマーク用）: { 'YYYY-MM-DD': { count, points } }
    const byDate = {};
    for (const c of mine) {
      if (!byDate[c.date]) byDate[c.date] = { count: 0, points: 0 };
      byDate[c.date].count += 1;
      byDate[c.date].points += c.points || 0;
    }

    res.json({ childId, today, streak, last7, week, month: monthAgg, byDate });
  } catch (err) {
    next(err);
  }
});
