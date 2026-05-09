import { Router } from 'express';
import { query } from '../db';
import { requireAdmin } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

router.use(requireAdmin);

// ──────────────────────────── USERS ────────────────────────────

// GET /api/admin/users
router.get('/users', async (_req, res) => {
  try {
    const result = await query<{
      id: string;
      name: string;
      magic_link_token: string;
      active: boolean;
      active_program_id: string | null;
      program_title: string | null;
      created_at: string;
    }>(
      `SELECT u.id, u.name, u.magic_link_token, u.active, u.active_program_id,
              p.title as program_title, u.created_at
       FROM users u
       LEFT JOIN programs p ON u.active_program_id = p.id
       ORDER BY u.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/users — create new employee
router.post('/users', async (req, res) => {
  const { name } = req.body ?? {};
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const token = crypto.randomUUID();
  try {
    const result = await query<{ id: string; magic_link_token: string }>(
      'INSERT INTO users (name, magic_link_token) VALUES ($1, $2) RETURNING id, magic_link_token',
      [name.trim(), token]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    await query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/users/:id/generate-link — rotate token
router.post('/users/:id/generate-link', async (req, res) => {
  const token = crypto.randomUUID();
  try {
    const result = await query<{ name: string; magic_link_token: string }>(
      'UPDATE users SET magic_link_token = $1 WHERE id = $2 RETURNING name, magic_link_token',
      [token, req.params.id]
    );
    if (result.rows.length === 0) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/users/:id/toggle — flip active flag
router.patch('/users/:id/toggle', async (req, res) => {
  try {
    const result = await query<{ active: boolean }>(
      'UPDATE users SET active = NOT active WHERE id = $1 RETURNING active',
      [req.params.id]
    );
    if (result.rows.length === 0) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ active: result.rows[0].active });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──────────────────────────── PROGRAMS ────────────────────────────

// GET /api/admin/programs
router.get('/programs', async (_req, res) => {
  try {
    const programs = await query(
      'SELECT id, slug, title, description, sort_order, created_at FROM programs ORDER BY sort_order, title'
    );
    const counts = await query<{ program_id: string; cnt: string }>(
      'SELECT program_id, COUNT(*) as cnt FROM sessions GROUP BY program_id'
    );
    const enrolled = await query<{ active_program_id: string; cnt: string }>(
      'SELECT active_program_id, COUNT(*) as cnt FROM users WHERE active_program_id IS NOT NULL GROUP BY active_program_id'
    );
    const countMap = Object.fromEntries(counts.rows.map((r: { program_id: string; cnt: string }) => [r.program_id, Number(r.cnt)]));
    const enrollMap = Object.fromEntries(enrolled.rows.map((r: { active_program_id: string; cnt: string }) => [r.active_program_id, Number(r.cnt)]));
    const result = (programs.rows as Array<Record<string, unknown>>).map(p => ({
      ...p,
      sessionCount: countMap[p.id] ?? 0,
      enrolledCount: enrollMap[p.id] ?? 0,
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/programs
router.post('/programs', async (req, res) => {
  const { title, description, slug } = req.body ?? {};
  if (!title || !slug) { res.status(400).json({ error: 'title and slug are required' }); return; }
  try {
    const result = await query<{ id: string }>(
      'INSERT INTO programs (slug, title, description) VALUES ($1, $2, $3) RETURNING id',
      [slug, title, description || null]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException & { code?: string }).code === '23505') {
      res.status(409).json({ error: 'A program with that slug already exists' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/programs/:id
router.patch('/programs/:id', async (req, res) => {
  const { title, description } = req.body ?? {};
  const fields: string[] = [];
  const values: unknown[] = [];
  if (title !== undefined) { values.push(title); fields.push(`title = $${values.length}`); }
  if (description !== undefined) { values.push(description); fields.push(`description = $${values.length}`); }
  if (!fields.length) { res.status(400).json({ error: 'Nothing to update' }); return; }
  values.push(req.params.id);
  try {
    await query(`UPDATE programs SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/programs/:id
router.delete('/programs/:id', async (req, res) => {
  try {
    await query('DELETE FROM programs WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/programs/:id/sessions
router.get('/programs/:id/sessions', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, week_number, session_number, title, interval_data FROM sessions WHERE program_id = $1 ORDER BY week_number, session_number',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/programs/:id/sessions
router.post('/programs/:id/sessions', async (req, res) => {
  const { weekNumber, sessionNumber, title, intervalData } = req.body ?? {};
  if (weekNumber == null || sessionNumber == null || !Array.isArray(intervalData)) {
    res.status(400).json({ error: 'weekNumber, sessionNumber, intervalData required' });
    return;
  }
  try {
    const result = await query<{ id: string }>(
      'INSERT INTO sessions (program_id, week_number, session_number, title, interval_data) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [req.params.id, weekNumber, sessionNumber, title || '', JSON.stringify(intervalData)]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/sessions/:id
router.patch('/sessions/:id', async (req, res) => {
  const { title, intervalData, weekNumber, sessionNumber } = req.body ?? {};
  const fields: string[] = [];
  const values: unknown[] = [];
  if (title !== undefined) { values.push(title); fields.push(`title = $${values.length}`); }
  if (intervalData !== undefined) { values.push(JSON.stringify(intervalData)); fields.push(`interval_data = $${values.length}`); }
  if (weekNumber !== undefined) { values.push(weekNumber); fields.push(`week_number = $${values.length}`); }
  if (sessionNumber !== undefined) { values.push(sessionNumber); fields.push(`session_number = $${values.length}`); }
  if (!fields.length) { res.status(400).json({ error: 'Nothing to update' }); return; }
  values.push(req.params.id);
  try {
    await query(`UPDATE sessions SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/sessions/:id
router.delete('/sessions/:id', async (req, res) => {
  try {
    await query('DELETE FROM sessions WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──────────────────────────── METRICS ────────────────────────────

// GET /api/admin/metrics
router.get('/metrics', async (_req, res) => {
  try {
    const weeklyWorkouts = await query<{ cnt: string }>(
      `SELECT COUNT(*) as cnt FROM history
       WHERE completed_at >= NOW() - INTERVAL '7 days'`
    );
    const totalUsers = await query<{ cnt: string }>('SELECT COUNT(*) as cnt FROM users WHERE active = TRUE');
    const totalWorkouts = await query<{ cnt: string }>('SELECT COUNT(*) as cnt FROM history');
    res.json({
      weeklyWorkouts: Number(weeklyWorkouts.rows[0].cnt),
      activeUsers: Number(totalUsers.rows[0].cnt),
      totalWorkouts: Number(totalWorkouts.rows[0].cnt),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
