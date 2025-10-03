import { Router } from 'express';
import { getPool } from '../db.js';

const router = Router();

function toMysqlDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return new Date(value).toISOString().slice(0, 10);
}

router.get('/summary', async (req, res, next) => {
  try {
    const profileId = parseInt(req.query.profileId, 10);
    if (!profileId) {
      return res.status(400).json({ error: 'profileId is required' });
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const toDate = toMysqlDate(req.query.to) || todayIso;
    const fromDate =
      toMysqlDate(req.query.from) || new Date(Date.now() - 1000 * 60 * 60 * 24 * 84).toISOString().slice(0, 10);

    const pool = getPool();

    const [weeklyRows] = await pool.query(
      `SELECT STR_TO_DATE(CONCAT(YEARWEEK(s.session_date, 3), ' Monday'), '%X%V %W') AS week_start,
              SUM(se.actual_weight * se.actual_reps) AS volume
       FROM set_entries se
       JOIN session_exercises sxe ON sxe.id = se.session_exercise_id
       JOIN sessions s ON s.id = sxe.session_id
       WHERE s.profile_id = ?
         AND s.status = 'completed'
         AND s.session_date BETWEEN ? AND ?
         AND se.actual_weight IS NOT NULL
         AND se.actual_reps  IS NOT NULL
         AND sxe.skipped = 0
       GROUP BY YEARWEEK(s.session_date, 3)
       ORDER BY week_start`,
      [profileId, fromDate, toDate]
    );

    const weeklyVolume = weeklyRows.map((row) => ({
      weekStartISO: formatDate(row.week_start),
      totalVolume: Number(row.volume) || 0
    }));

    const [oneRmRows] = await pool.query(
      `SELECT sxe.exercise_id AS exerciseId,
              e.name AS exerciseName,
              MAX(se.actual_weight * (1 + se.actual_reps/30.0)) AS best1RM
       FROM set_entries se
       JOIN session_exercises sxe ON sxe.id = se.session_exercise_id
       JOIN sessions s ON s.id = sxe.session_id
       JOIN exercises e ON e.id = sxe.exercise_id
       WHERE s.profile_id = ?
         AND s.status = 'completed'
         AND s.session_date BETWEEN ? AND ?
         AND se.actual_weight IS NOT NULL
         AND se.actual_reps  IS NOT NULL
         AND sxe.skipped = 0
       GROUP BY sxe.exercise_id, e.name
       ORDER BY best1RM DESC`,
      [profileId, fromDate, toDate]
    );

    const oneRMByExercise = oneRmRows.map((row) => ({
      exerciseId: row.exerciseId,
      exerciseName: row.exerciseName,
      best1RM: row.best1RM ? Number(row.best1RM.toFixed(2)) : null
    }));

    const [topExercises] = await pool.query(
      `SELECT sxe.exercise_id AS exerciseId, e.name AS exerciseName, COUNT(*) AS performedCount
       FROM set_entries se
       JOIN session_exercises sxe ON sxe.id = se.session_exercise_id
       JOIN sessions s ON s.id = sxe.session_id
       JOIN exercises e ON e.id = sxe.exercise_id
       WHERE s.profile_id = ?
         AND s.status = 'completed'
         AND s.session_date BETWEEN ? AND ?
         AND se.actual_weight IS NOT NULL
         AND se.actual_reps IS NOT NULL
         AND sxe.skipped = 0
       GROUP BY sxe.exercise_id, e.name
       ORDER BY performedCount DESC
       LIMIT 3`,
      [profileId, fromDate, toDate]
    );

    const oneRMSeriesByExercise = [];
    for (const exercise of topExercises) {
      const [seriesRows] = await pool.query(
        `SELECT s.session_date AS sessionDate,
                MAX(se.actual_weight * (1 + se.actual_reps/30.0)) AS est1RM
         FROM set_entries se
         JOIN session_exercises sxe ON sxe.id = se.session_exercise_id
         JOIN sessions s ON s.id = sxe.session_id
         WHERE sxe.exercise_id = ?
           AND s.profile_id = ?
           AND s.status = 'completed'
           AND s.session_date BETWEEN ? AND ?
           AND se.actual_weight IS NOT NULL
           AND se.actual_reps IS NOT NULL
           AND sxe.skipped = 0
         GROUP BY s.session_date
         ORDER BY s.session_date`,
        [exercise.exerciseId, profileId, fromDate, toDate]
      );

      oneRMSeriesByExercise.push({
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        points: seriesRows.map((row) => ({
          date: formatDate(row.sessionDate),
          est1RM: row.est1RM ? Number(row.est1RM.toFixed(2)) : null
        }))
      });
    }

    res.json({
      from: fromDate,
      to: toDate,
      weeklyVolume,
      oneRMByExercise,
      oneRMSeriesByExercise
    });
  } catch (error) {
    next(error);
  }
});

export default router;
