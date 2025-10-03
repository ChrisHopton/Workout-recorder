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

async function fetchSession(sessionId) {
  const pool = getPool();
  const [sessionRows] = await pool.query(
    `SELECT id, profile_id AS profileId, session_date AS sessionDate, day_of_week AS dayOfWeek,
            status, started_at AS startedAt, completed_at AS completedAt, note
     FROM sessions
     WHERE id = ?`,
    [sessionId]
  );
  if (!sessionRows.length) {
    return null;
  }
  const session = sessionRows[0];

  const [exerciseRows] = await pool.query(
    `SELECT sxe.id, sxe.exercise_id AS exerciseId, e.name AS exerciseName, sxe.order_index AS orderIndex,
            sxe.target_sets AS targetSets, sxe.rep_low AS repLow, sxe.rep_high AS repHigh,
            sxe.target_weight AS targetWeight, sxe.skipped
     FROM session_exercises sxe
     JOIN exercises e ON e.id = sxe.exercise_id
     WHERE sxe.session_id = ?
     ORDER BY sxe.order_index`,
    [sessionId]
  );

  const exerciseIds = exerciseRows.map((row) => row.id);
  let setRows = [];
  if (exerciseIds.length) {
    const [sets] = await pool.query(
      `SELECT id, session_exercise_id AS sessionExerciseId, set_number AS setNumber,
              actual_reps AS actualReps, actual_weight AS actualWeight
       FROM set_entries
       WHERE session_exercise_id IN (?)
       ORDER BY set_number`,
      [exerciseIds]
    );
    setRows = sets;
  }

  const exerciseMap = new Map();
  for (const exercise of exerciseRows) {
    exerciseMap.set(exercise.id, { ...exercise, sets: [] });
  }

  for (const set of setRows) {
    const exercise = exerciseMap.get(set.sessionExerciseId);
    if (exercise) {
      exercise.sets.push(set);
    }
  }

  session.exercises = Array.from(exerciseMap.values());
  return session;
}

router.post('/sessions/start', async (req, res, next) => {
  const profileId = parseInt(req.query.profileId, 10);
  const sessionDate = toMysqlDate(req.query.date);
  if (!profileId || !sessionDate) {
    return res.status(400).json({ error: 'profileId and date are required' });
  }

  const pool = getPool();
  const connection = await pool.getConnection();
  let transactionStarted = false;
  try {
    const [existing] = await connection.query(
      'SELECT id FROM sessions WHERE profile_id=? AND session_date=?',
      [profileId, sessionDate]
    );

    if (existing.length) {
      const session = await fetchSession(existing[0].id);
      return res.json(session);
    }

    const dayOfWeek = new Date(`${sessionDate}T00:00:00`).getUTCDay();

    await connection.beginTransaction();
    transactionStarted = true;

    const [sessionResult] = await connection.query(
      'INSERT INTO sessions (profile_id, session_date, day_of_week, status, started_at) VALUES (?,?,?,?,NOW())',
      [profileId, sessionDate, dayOfWeek, 'in_progress']
    );
    const sessionId = sessionResult.insertId;

    const [planExercises] = await connection.query(
      `SELECT wde.exercise_id AS exerciseId, wde.order_index AS orderIndex, wde.set_count AS setCount,
              wde.rep_low AS repLow, wde.rep_high AS repHigh, wde.target_weight AS targetWeight
       FROM workout_days wd
       JOIN workout_day_exercises wde ON wde.workout_day_id = wd.id
       WHERE wd.profile_id = ? AND wd.day_of_week = ?
       ORDER BY wde.order_index`,
      [profileId, dayOfWeek]
    );

    for (const planExercise of planExercises) {
      const [exerciseResult] = await connection.query(
        `INSERT INTO session_exercises (session_id, exercise_id, order_index, target_sets, rep_low, rep_high, target_weight)
         VALUES (?,?,?,?,?,?,?)`,
        [
          sessionId,
          planExercise.exerciseId,
          planExercise.orderIndex,
          planExercise.setCount,
          planExercise.repLow,
          planExercise.repHigh,
          planExercise.targetWeight
        ]
      );
      const sessionExerciseId = exerciseResult.insertId;
      for (let i = 1; i <= planExercise.setCount; i += 1) {
        await connection.query(
          'INSERT INTO set_entries (session_exercise_id, set_number) VALUES (?, ?)',
          [sessionExerciseId, i]
        );
      }
    }

    await connection.commit();
    transactionStarted = false;

    const session = await fetchSession(sessionId);
    res.json(session);
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback();
    }
    if (error.code === 'ER_DUP_ENTRY') {
      try {
        const [existing] = await pool.query(
          'SELECT id FROM sessions WHERE profile_id=? AND session_date=?',
          [profileId, sessionDate]
        );
        if (existing.length) {
          const session = await fetchSession(existing[0].id);
          return res.json(session);
        }
      } catch (fetchError) {
        return next(fetchError);
      }
    }
    next(error);
  } finally {
    connection.release();
  }
});

router.patch('/session-exercises/:id/skip', async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (!id) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  try {
    const pool = getPool();
    await pool.query('UPDATE session_exercises SET skipped=1 WHERE id=?', [id]);
    await pool.query('UPDATE set_entries SET actual_reps=NULL, actual_weight=NULL WHERE session_exercise_id=?', [id]);
    res.json({ id, skipped: true });
  } catch (error) {
    next(error);
  }
});

router.put('/set-entries/:id', async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (!id) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  const actualReps = req.body.actual_reps ?? req.body.actualReps ?? null;
  const actualWeight = req.body.actual_weight ?? req.body.actualWeight ?? null;

  try {
    const pool = getPool();
    await pool.query(
      'UPDATE set_entries SET actual_reps=?, actual_weight=? WHERE id=?',
      [actualReps, actualWeight, id]
    );
    res.json({ id, actualReps, actualWeight });
  } catch (error) {
    next(error);
  }
});

router.post('/sessions/:id/complete', async (req, res, next) => {
  const sessionId = parseInt(req.params.id, 10);
  if (!sessionId) {
    return res.status(400).json({ error: 'Invalid session id' });
  }
  const note = req.body?.note ?? null;
  try {
    const pool = getPool();
    await pool.query(
      'UPDATE sessions SET status="completed", completed_at=NOW(), note=? WHERE id=?',
      [note, sessionId]
    );
    res.json({ id: sessionId, status: 'completed' });
  } catch (error) {
    next(error);
  }
});

router.post('/sessions/:id/skip-day', async (req, res, next) => {
  const sessionId = parseInt(req.params.id, 10);
  if (!sessionId) {
    return res.status(400).json({ error: 'Invalid session id' });
  }
  try {
    const pool = getPool();
    await pool.query('UPDATE sessions SET status="skipped", completed_at=NULL WHERE id=?', [sessionId]);
    await pool.query('UPDATE session_exercises SET skipped=1 WHERE session_id=?', [sessionId]);
    await pool.query('UPDATE set_entries SET actual_reps=NULL, actual_weight=NULL WHERE session_exercise_id IN (SELECT id FROM session_exercises WHERE session_id=?)', [sessionId]);
    res.json({ id: sessionId, status: 'skipped' });
  } catch (error) {
    next(error);
  }
});

export default router;
