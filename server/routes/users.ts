import { Router } from 'express';
import { query } from '../db';
import { requireUser } from '../middleware/auth';

const router = Router();

// All user routes require auth
router.use(requireUser);

// GET /api/me — full user profile
router.get('/', async (req, res) => {
  try {
    const u = await query<{
      id: string;
      name: string;
      active_program_id: string | null;
      selected_character_id: string;
    }>(
      'SELECT id, name, active_program_id, selected_character_id, avatar FROM users WHERE id = $1',
      [req.user!.userId]
    );
    if (u.rows.length === 0) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(u.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/me — update active program or character
router.patch('/', async (req, res) => {
  const { activeProgramId, selectedCharacterId } = req.body ?? {};
  const fields: string[] = [];
  const values: unknown[] = [];
  if (activeProgramId !== undefined) {
    values.push(activeProgramId);
    fields.push(`active_program_id = $${values.length}`);
  }
  if (selectedCharacterId !== undefined) {
    values.push(selectedCharacterId);
    fields.push(`selected_character_id = $${values.length}`);
  }
  if (fields.length === 0) { res.status(400).json({ error: 'Nothing to update' }); return; }
  values.push(req.user!.userId);
  try {
    await query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/me/avatar — upload base64 avatar (max ~200KB after resize)
router.post('/avatar', async (req, res) => {
  const { avatar } = req.body ?? {};
  if (typeof avatar !== 'string' || !avatar.startsWith('data:image/')) {
    res.status(400).json({ error: 'Invalid avatar data' });
    return;
  }
  // Enforce max size (~200KB base64 ≈ 150KB image)
  if (avatar.length > 210_000) {
    res.status(413).json({ error: 'Image too large. Please upload a smaller image.' });
    return;
  }
  try {
    await query('UPDATE users SET avatar = $1 WHERE id = $2', [avatar, req.user!.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/me/progress
router.get('/progress', async (req, res) => {
  try {
    const result = await query<{ program_id: string; current_week: number; current_session: number }>(
      'SELECT program_id, current_week, current_session FROM progress WHERE user_id = $1',
      [req.user!.userId]
    );
    // Return as a map: { programId: { week, session } }
    const progressMap: Record<string, { week: number; session: number }> = {};
    for (const row of result.rows) {
      progressMap[row.program_id] = { week: row.current_week, session: row.current_session };
    }
    res.json(progressMap);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/me/progress — upsert progress for a program
router.post('/progress', async (req, res) => {
  const { programId, week, session } = req.body ?? {};
  if (!programId || week == null || session == null) {
    res.status(400).json({ error: 'programId, week, session required' });
    return;
  }
  try {
    await query(
      `INSERT INTO progress (user_id, program_id, current_week, current_session, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, program_id) DO UPDATE
         SET current_week = EXCLUDED.current_week,
             current_session = EXCLUDED.current_session,
             updated_at = NOW()`,
      [req.user!.userId, programId, week, session]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/me/history
router.get('/history', async (req, res) => {
  try {
    const result = await query<{
      id: string;
      session_id: string | null;
      program_id: string | null;
      week_number: number | null;
      session_number: number | null;
      completed_at: string;
      feedback: string | null;
      program_title: string | null;
    }>(
      `SELECT h.id, h.session_id, h.program_id, h.week_number, h.session_number,
              h.completed_at, h.feedback, p.title as program_title
       FROM history h
       LEFT JOIN programs p ON h.program_id = p.id
       WHERE h.user_id = $1
       ORDER BY h.completed_at DESC
       LIMIT 100`,
      [req.user!.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/me/history — record completed workout
router.post('/history', async (req, res) => {
  const { sessionId, programId, weekNumber, sessionNumber, feedback } = req.body ?? {};
  if (!feedback || !['easy', 'perfect', 'hard'].includes(feedback)) {
    res.status(400).json({ error: 'Valid feedback required (easy|perfect|hard)' });
    return;
  }
  try {
    const result = await query<{ id: string }>(
      `INSERT INTO history (user_id, session_id, program_id, week_number, session_number, feedback)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [req.user!.userId, sessionId || null, programId || null, weekNumber || null, sessionNumber || null, feedback]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
