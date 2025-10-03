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

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function getProgressionIncrement(weight) {
  if (!weight || weight <= 0) return 0;
  if (weight >= 200) return 10;
  if (weight >= 120) return 5;
  if (weight >= 60) return 2.5;
  if (weight >= 30) return 2;
  return 1;
}

function roundToTwoDecimals(value) {
  return Math.round(value * 100) / 100;
}

function roundToIncrementStep(value, step = 0.5) {
  if (!Number.isFinite(value) || !step) return value;
  return Math.round(value / step) * step;
}

function evaluateSessionPerformance(plan, sets) {
  const validSets = sets
    .map((set) => ({
      reps: toNumber(set.actualReps),
      weight: toNumber(set.actualWeight)
    }))
    .filter((set) => set.reps !== null && set.weight !== null);

  if (!validSets.length) {
    return null;
  }

  const highestWeight = Math.max(...validSets.map((set) => set.weight));
  const workingSets = validSets.filter((set) => Math.abs(set.weight - highestWeight) < 0.01);

  const repHighHits = workingSets.filter((set) => set.reps >= plan.repHigh).length;
  const repLowHits = workingSets.filter((set) => set.reps >= plan.repLow).length;
  const workingReps = workingSets.reduce((total, set) => total + set.reps, 0);
  const allReps = validSets.reduce((total, set) => total + set.reps, 0);
  const workingVolume = workingSets.reduce((total, set) => total + set.reps * set.weight, 0);
  const allVolume = validSets.reduce((total, set) => total + set.reps * set.weight, 0);

  return {
    highestWeight,
    workingSetCount: workingSets.length,
    totalSetCount: validSets.length,
    repHighHits,
    repLowHits,
    workingReps,
    allReps,
    workingVolume,
    allVolume
  };
}

async function computeProgressiveTarget(connection, profileId, planExercise) {
  // Build a small progression window leveraging the most recent completed sessions
  // so we can compare today's prescription against the athlete's actual performance
  // and automatically nudge the working weight when the set quality warrants it.
  const plan = {
    setCount: Number(planExercise.setCount ?? planExercise.targetSets ?? 0),
    repLow: Number(planExercise.repLow ?? 0),
    repHigh: Number(planExercise.repHigh ?? 0),
    targetWeight:
      planExercise.targetWeight !== null && planExercise.targetWeight !== undefined
        ? Number(planExercise.targetWeight)
        : null
  };

  const [history] = await connection.query(
    `SELECT se.id, s.session_date AS sessionDate
     FROM sessions s
     JOIN session_exercises se ON se.session_id = s.id
     WHERE s.profile_id = ? AND s.status = 'completed' AND se.exercise_id = ?
     ORDER BY s.session_date DESC, se.id DESC
     LIMIT 3`,
    [profileId, planExercise.exerciseId]
  );

  if (!history.length) {
    return plan.targetWeight;
  }

  const sessionIds = history.map((row) => row.id);
  const [setRows] = await connection.query(
    `SELECT session_exercise_id AS sessionExerciseId, set_number AS setNumber,
            actual_reps AS actualReps, actual_weight AS actualWeight
     FROM set_entries
     WHERE session_exercise_id IN (?)
     ORDER BY session_exercise_id DESC, set_number`,
    [sessionIds]
  );

  const sessionMap = new Map();
  for (const row of history) {
    sessionMap.set(row.id, []);
  }
  for (const set of setRows) {
    const bucket = sessionMap.get(set.sessionExerciseId);
    if (bucket) {
      bucket.push({
        setNumber: set.setNumber,
        actualReps: set.actualReps,
        actualWeight: set.actualWeight
      });
    }
  }

  const evaluations = history.map((row) => evaluateSessionPerformance(plan, sessionMap.get(row.id) ?? []));
  const lastEval = evaluations[0];

  if (!lastEval) {
    const fallbackWeight = evaluations.find((evaluation) => evaluation && evaluation.highestWeight)?.highestWeight;
    if (fallbackWeight && fallbackWeight > 0) {
      return roundToTwoDecimals(fallbackWeight);
    }
    return plan.targetWeight;
  }

  let baseWeight = plan.targetWeight ?? 0;
  if (lastEval.highestWeight && lastEval.highestWeight > baseWeight) {
    baseWeight = lastEval.highestWeight;
  }
  if (!baseWeight) {
    const firstHistoricalWeight = evaluations.find((evaluation) => evaluation && evaluation.highestWeight)?.highestWeight;
    if (firstHistoricalWeight) {
      baseWeight = firstHistoricalWeight;
    }
  }

  if (!baseWeight || baseWeight <= 0) {
    return plan.targetWeight;
  }

  const increment = getProgressionIncrement(baseWeight);
  if (!increment) {
    return roundToTwoDecimals(baseWeight);
  }
  const halfIncrement = Math.max(0.5, increment / 2);

  const targetSets = plan.setCount || lastEval.totalSetCount || 0;
  if (!targetSets) {
    return roundToTwoDecimals(baseWeight);
  }

  const successThreshold = targetSets;
  const moderateThreshold = Math.max(1, Math.ceil(targetSets * 0.75));
  const highVolumeGoal = targetSets * plan.repHigh;
  const moderateVolumeGoal = targetSets * plan.repLow;

  const workingRepRatio = highVolumeGoal > 0 ? lastEval.workingReps / highVolumeGoal : 0;
  const allRepRatio = moderateVolumeGoal > 0 ? lastEval.allReps / moderateVolumeGoal : 0;

  let nextWeight = baseWeight;

  let successStreak = 0;
  for (const evaluation of evaluations) {
    if (
      evaluation &&
      evaluation.workingSetCount >= successThreshold &&
      evaluation.repHighHits >= successThreshold
    ) {
      successStreak += 1;
    } else {
      break;
    }
  }

  const lastSuccessful =
    lastEval.workingSetCount >= successThreshold && lastEval.repHighHits >= successThreshold;
  const lastClose =
    !lastSuccessful &&
    lastEval.workingSetCount >= moderateThreshold &&
    lastEval.repLowHits >= moderateThreshold &&
    (workingRepRatio >= 0.9 || allRepRatio >= 1);

  if (lastSuccessful) {
    const bonusMultiplier = Math.min(2.5, 1 + Math.max(0, successStreak - 1) * 0.5);
    nextWeight = baseWeight + increment * bonusMultiplier;
  } else if (lastClose) {
    nextWeight = baseWeight + halfIncrement;
  } else {
    const plateau = evaluations.slice(0, 3).every((evaluation) => {
      if (!evaluation) return false;
      return Math.abs(evaluation.highestWeight - baseWeight) < 0.01;
    });
    if (
      plateau &&
      lastEval.workingSetCount >= moderateThreshold &&
      lastEval.repLowHits >= moderateThreshold &&
      workingRepRatio >= 0.85
    ) {
      nextWeight = baseWeight + halfIncrement;
    }
  }

  return roundToTwoDecimals(roundToIncrementStep(nextWeight));
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
      const progressiveTarget = await computeProgressiveTarget(connection, profileId, planExercise);
      const targetWeight =
        progressiveTarget !== undefined && progressiveTarget !== null
          ? progressiveTarget
          : planExercise.targetWeight;
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
          targetWeight
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

router.patch('/session-exercises/:id/unskip', async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (!id) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  try {
    const pool = getPool();
    await pool.query('UPDATE session_exercises SET skipped=0 WHERE id=?', [id]);
    res.json({ id, skipped: false });
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
