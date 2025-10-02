import { Router } from 'express';
import { getPool } from '../db.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT id, name, muscle_group AS muscleGroup FROM exercises WHERE is_active=1 ORDER BY name'
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

export default router;
