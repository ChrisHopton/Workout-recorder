import { Router } from 'express';
import { getPool } from '../db.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT id, name, gender FROM profiles ORDER BY id');
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

export default router;
