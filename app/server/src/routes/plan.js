import { Router } from 'express';
import { getPool } from '../db.js';
import { computeProgressiveTarget } from '../services/progression.js';

const router = Router();

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

router.get('/week', async (req, res, next) => {
  try {
    const profileId = parseInt(req.query.profileId, 10);
    if (!profileId) {
      return res.status(400).json({ error: 'profileId is required' });
    }

    const pool = getPool();
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        `SELECT wd.day_of_week, wd.title, wde.order_index, e.name AS exercise_name,
                wde.set_count, wde.rep_low, wde.rep_high, wde.target_weight, wde.exercise_id
         FROM workout_days wd
         LEFT JOIN workout_day_exercises wde ON wd.id = wde.workout_day_id
         LEFT JOIN exercises e ON e.id = wde.exercise_id
         WHERE wd.profile_id = ?
         ORDER BY wd.day_of_week, wde.order_index`,
        [profileId]
      );

      const progressiveTargets = await Promise.all(
        rows.map((row) => {
          if (!row.exercise_id) {
            return Promise.resolve(null);
          }
          return computeProgressiveTarget(connection, profileId, {
            exerciseId: row.exercise_id,
            setCount: row.set_count,
            repLow: row.rep_low,
            repHigh: row.rep_high,
            targetWeight: row.target_weight
          });
        })
      );

      const week = Array.from({ length: 7 }, (_, idx) => ({
        dayOfWeek: idx,
        label: WEEKDAY_LABELS[idx],
        title: null,
        exercises: []
      }));

      rows.forEach((row, index) => {
        const day = week[row.day_of_week];
        if (!day.title) {
          day.title = row.title;
        }
        if (row.exercise_name) {
          const progressiveTarget = progressiveTargets[index];
          day.exercises.push({
            name: row.exercise_name,
            set_count: row.set_count,
            rep_low: row.rep_low,
            rep_high: row.rep_high,
            target_weight:
              progressiveTarget !== undefined && progressiveTarget !== null
                ? progressiveTarget
                : row.target_weight
          });
        }
      });

      for (const day of week) {
        if (!day.title) {
          day.title = 'Rest';
        }
      }

      res.json({ days: week });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

export default router;
