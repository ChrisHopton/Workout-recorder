import { getPool, ensureDatabase } from './db.js';

export async function initializeDatabase() {
  await ensureDatabase();
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(`CREATE TABLE IF NOT EXISTS profiles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL,
      gender ENUM('male','female') NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);

    await connection.query(`CREATE TABLE IF NOT EXISTS exercises (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      muscle_group VARCHAR(50),
      is_active TINYINT(1) DEFAULT 1
    ) ENGINE=InnoDB`);

    await connection.query(`CREATE TABLE IF NOT EXISTS workout_days (
      id INT AUTO_INCREMENT PRIMARY KEY,
      profile_id INT NOT NULL,
      day_of_week TINYINT NOT NULL,
      title VARCHAR(50) NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      UNIQUE KEY unique_day_per_profile (profile_id, day_of_week)
    ) ENGINE=InnoDB`);

    await connection.query(`CREATE TABLE IF NOT EXISTS workout_day_exercises (
      id INT AUTO_INCREMENT PRIMARY KEY,
      workout_day_id INT NOT NULL,
      exercise_id INT NOT NULL,
      order_index INT DEFAULT 0,
      set_count INT NOT NULL,
      rep_low INT NOT NULL,
      rep_high INT NOT NULL,
      target_weight DECIMAL(6,2) NULL,
      notes VARCHAR(255) NULL,
      FOREIGN KEY (workout_day_id) REFERENCES workout_days(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    ) ENGINE=InnoDB`);

    await connection.query(`CREATE TABLE IF NOT EXISTS sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      profile_id INT NOT NULL,
      session_date DATE NOT NULL,
      day_of_week TINYINT NOT NULL,
      status ENUM('planned','in_progress','completed','skipped') DEFAULT 'planned',
      started_at DATETIME NULL,
      completed_at DATETIME NULL,
      note TEXT NULL,
      FOREIGN KEY (profile_id) REFERENCES profiles(id),
      UNIQUE KEY unique_session_per_day (profile_id, session_date)
    ) ENGINE=InnoDB`);

    await connection.query(`CREATE TABLE IF NOT EXISTS session_exercises (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL,
      exercise_id INT NOT NULL,
      order_index INT DEFAULT 0,
      target_sets INT NOT NULL,
      rep_low INT NOT NULL,
      rep_high INT NOT NULL,
      target_weight DECIMAL(6,2) NULL,
      skipped TINYINT(1) DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    ) ENGINE=InnoDB`);

    await connection.query(`CREATE TABLE IF NOT EXISTS set_entries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_exercise_id INT NOT NULL,
      set_number INT NOT NULL,
      actual_reps INT NULL,
      actual_weight DECIMAL(6,2) NULL,
      is_warmup TINYINT(1) DEFAULT 0,
      FOREIGN KEY (session_exercise_id) REFERENCES session_exercises(id) ON DELETE CASCADE,
      UNIQUE KEY unique_set (session_exercise_id, set_number)
    ) ENGINE=InnoDB`);

    const [[profileCount]] = await connection.query('SELECT COUNT(*) AS count FROM profiles');
    if (profileCount.count === 0) {
      await connection.query("INSERT INTO profiles (name, gender) VALUES ('Male','male'),('Female','female')");
    }

    const [[exerciseCount]] = await connection.query('SELECT COUNT(*) AS count FROM exercises');
    if (exerciseCount.count === 0) {
      await connection.query(`INSERT INTO exercises (name, muscle_group) VALUES
        ('Barbell Back Squat','Legs'),
        ('Romanian Deadlift','Hamstrings'),
        ('Leg Press','Legs'),
        ('Leg Curl','Hamstrings'),
        ('Standing Calf Raise','Calves'),
        ('Barbell Bench Press','Chest'),
        ('Incline DB Press','Chest'),
        ('Bent-Over Row','Back'),
        ('Lat Pulldown','Back'),
        ('Dumbbell Lateral Raise','Shoulders'),
        ('Cable Triceps Pushdown','Triceps'),
        ('EZ-Bar Curl','Biceps')`);
    }

    const profiles = await connection.query('SELECT id, name FROM profiles');
    for (const profile of profiles[0]) {
      const [[dayCount]] = await connection.query('SELECT COUNT(*) AS count FROM workout_days WHERE profile_id=?', [profile.id]);
      if (dayCount.count === 0) {
        await connection.query(`INSERT INTO workout_days (profile_id, day_of_week, title) VALUES
          (?, 1, 'Upper A'),
          (?, 2, 'Lower A'),
          (?, 4, 'Upper B'),
          (?, 5, 'Lower B')`, [profile.id, profile.id, profile.id, profile.id]);
      }

      const [upperA] = await connection.query('SELECT id FROM workout_days WHERE profile_id=? AND title="Upper A" LIMIT 1', [profile.id]);
      const [lowerA] = await connection.query('SELECT id FROM workout_days WHERE profile_id=? AND title="Lower A" LIMIT 1', [profile.id]);
      const [upperB] = await connection.query('SELECT id FROM workout_days WHERE profile_id=? AND title="Upper B" LIMIT 1', [profile.id]);
      const [lowerB] = await connection.query('SELECT id FROM workout_days WHERE profile_id=? AND title="Lower B" LIMIT 1', [profile.id]);

      const targetWeights = profile.name === 'Male'
        ? {
            'Barbell Bench Press': 135,
            'Incline DB Press': 50,
            'Bent-Over Row': 135,
            'Lat Pulldown': 120,
            'Dumbbell Lateral Raise': 25,
            'Cable Triceps Pushdown': 80,
            'EZ-Bar Curl': 70,
            'Barbell Back Squat': 185,
            'Romanian Deadlift': 155,
            'Leg Press': 270,
            'Leg Curl': 90,
            'Standing Calf Raise': 135
          }
        : {
            'Barbell Bench Press': 75,
            'Incline DB Press': 35,
            'Bent-Over Row': 85,
            'Lat Pulldown': 90,
            'Dumbbell Lateral Raise': 15,
            'Cable Triceps Pushdown': 55,
            'EZ-Bar Curl': 45,
            'Barbell Back Squat': 115,
            'Romanian Deadlift': 95,
            'Leg Press': 180,
            'Leg Curl': 70,
            'Standing Calf Raise': 95
          };

      const dayMap = [
        { row: upperA?.[0], exercises: [
          { name: 'Barbell Bench Press', sets: 4, repLow: 8, repHigh: 12 },
          { name: 'Incline DB Press', sets: 3, repLow: 8, repHigh: 12 },
          { name: 'Bent-Over Row', sets: 4, repLow: 8, repHigh: 12 },
          { name: 'Lat Pulldown', sets: 3, repLow: 10, repHigh: 12 },
          { name: 'Dumbbell Lateral Raise', sets: 3, repLow: 12, repHigh: 15 },
          { name: 'Cable Triceps Pushdown', sets: 3, repLow: 10, repHigh: 12 },
          { name: 'EZ-Bar Curl', sets: 3, repLow: 10, repHigh: 12 }
        ] },
        { row: lowerA?.[0], exercises: [
          { name: 'Barbell Back Squat', sets: 4, repLow: 8, repHigh: 12 },
          { name: 'Romanian Deadlift', sets: 3, repLow: 8, repHigh: 12 },
          { name: 'Leg Press', sets: 3, repLow: 10, repHigh: 12 },
          { name: 'Leg Curl', sets: 3, repLow: 10, repHigh: 15 },
          { name: 'Standing Calf Raise', sets: 4, repLow: 12, repHigh: 15 }
        ] },
        { row: upperB?.[0], exercises: [
          { name: 'Barbell Bench Press', sets: 4, repLow: 8, repHigh: 12 },
          { name: 'Incline DB Press', sets: 3, repLow: 8, repHigh: 12 },
          { name: 'Bent-Over Row', sets: 4, repLow: 8, repHigh: 12 },
          { name: 'Lat Pulldown', sets: 3, repLow: 10, repHigh: 12 },
          { name: 'Dumbbell Lateral Raise', sets: 3, repLow: 12, repHigh: 15 },
          { name: 'Cable Triceps Pushdown', sets: 3, repLow: 10, repHigh: 12 },
          { name: 'EZ-Bar Curl', sets: 3, repLow: 10, repHigh: 12 }
        ] },
        { row: lowerB?.[0], exercises: [
          { name: 'Barbell Back Squat', sets: 4, repLow: 8, repHigh: 12 },
          { name: 'Romanian Deadlift', sets: 3, repLow: 8, repHigh: 12 },
          { name: 'Leg Press', sets: 3, repLow: 10, repHigh: 12 },
          { name: 'Leg Curl', sets: 3, repLow: 10, repHigh: 15 },
          { name: 'Standing Calf Raise', sets: 4, repLow: 12, repHigh: 15 }
        ] }
      ];

      for (const day of dayMap) {
        if (!day.row) continue;
        const [[existing]] = await connection.query('SELECT COUNT(*) AS count FROM workout_day_exercises WHERE workout_day_id=?', [day.row.id]);
        if (existing.count === 0) {
          let order = 0;
          for (const exercise of day.exercises) {
            const [[exerciseRow]] = await connection.query('SELECT id FROM exercises WHERE name=? LIMIT 1', [exercise.name]);
            if (!exerciseRow) continue;
            await connection.query(
              'INSERT INTO workout_day_exercises (workout_day_id, exercise_id, order_index, set_count, rep_low, rep_high, target_weight) VALUES (?,?,?,?,?,?,?)',
              [
                day.row.id,
                exerciseRow.id,
                order,
                exercise.sets,
                exercise.repLow,
                exercise.repHigh,
                targetWeights[exercise.name] ?? null
              ]
            );
            order += 1;
          }
        }
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
