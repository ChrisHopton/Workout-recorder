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

export async function computeProgressiveTarget(connection, profileId, planExercise) {
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

export default computeProgressiveTarget;
