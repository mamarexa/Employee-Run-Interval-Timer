import { Router } from 'express';
import { query } from '../db';

const router = Router();

// GET /api/programs
router.get('/', async (_req, res) => {
  try {
    const programs = await query(
      'SELECT id, slug, title, description, sort_order FROM programs ORDER BY sort_order, title'
    );
    // Attach session count to each program
    const counts = await query<{ program_id: string; cnt: string }>(
      'SELECT program_id, COUNT(*) as cnt FROM sessions GROUP BY program_id'
    );
    const countMap = Object.fromEntries(counts.rows.map((r: { program_id: string; cnt: string }) => [r.program_id, Number(r.cnt)]));
    const result = (programs.rows as Array<Record<string, unknown>>).map(p => ({ ...p, session_count: countMap[p.id as string] ?? 0 }));
    res.json(result);
  } catch (err) {
    console.error('GET /programs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/programs/:id/sessions
router.get('/:id/sessions', async (req, res) => {
  try {
    const sessions = await query(
      `SELECT id, week_number, session_number, title, interval_data
       FROM sessions
       WHERE program_id = $1
       ORDER BY week_number, session_number`,
      [req.params.id]
    );
    res.json(sessions.rows);
  } catch (err) {
    console.error('GET /programs/:id/sessions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
