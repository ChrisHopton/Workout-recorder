import { Router } from 'express';
import { getPool } from '../db.js';

const router = Router();

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

router.get('/week', async (req, res, next) => {
  try {
    const profileId = parseInt(req.query.profileId, 10);
    if (!profileId) {
      return res.status(400).json({ error: 'profileId is required' });
    }

    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT wd.day_of_week, wd.title, wde.order_index, e.name AS exercise_name,
              wde.set_count, wde.rep_low, wde.rep_high, wde.target_weight
       FROM workout_days wd
       LEFT JOIN workout_day_exercises wde ON wd.id = wde.workout_day_id
       LEFT JOIN exercises e ON e.id = wde.exercise_id
       WHERE wd.profile_id = ?
       ORDER BY wd.day_of_week, wde.order_index`,
      [profileId]
    );

    const week = Array.from({ length: 7 }, (_, idx) => ({
      dayOfWeek: idx,
      label: WEEKDAY_LABELS[idx],
      title: null,
      exercises: []
    }));

    for (const row of rows) {
      const day = week[row.day_of_week];
      if (!day.title) {
        day.title = row.title;
      }
      if (row.exercise_name) {
        day.exercises.push({
          name: row.exercise_name,
          set_count: row.set_count,
          rep_low: row.rep_low,
          rep_high: row.rep_high,
          target_weight: row.target_weight
        });
      }
    }

    for (const day of week) {
      if (!day.title) {
        day.title = 'Rest';
      }
    }

    res.json({ days: week });
  } catch (error) {
    next(error);
  }
});

export default router;
