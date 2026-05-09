import { Router } from 'express';
import { query } from '../db';
import { requireUser, signUserToken, signAdminToken } from '../middleware/auth';
import bcrypt from 'bcryptjs';

const router = Router();

// GET /api/auth/verify?pass=TOKEN
// Called when user first taps the magic link, or silently on app boot with stored wt_pass
router.get('/verify', async (req, res) => {
  const pass = String(req.query.pass ?? '');
  if (!pass) {
    res.status(400).json({ error: 'Missing pass parameter' });
    return;
  }

  try {
    const result = await query<{ id: string; name: string; active: boolean }>(
      'SELECT id, name, active FROM users WHERE magic_link_token = $1 LIMIT 1',
      [pass]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid access link' });
      return;
    }

    const user = result.rows[0];
    if (!user.active) {
      res.status(403).json({ error: 'Access revoked. Please contact your administrator.' });
      return;
    }

    const token = signUserToken(user.id, user.name);
    res.json({ token, user: { id: user.id, name: user.name } });
  } catch (err) {
    console.error('Auth verify error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/admin-login
router.post('/admin-login', async (req, res) => {
  const { username, password } = req.body ?? {};
  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedHash = process.env.ADMIN_PASSWORD_HASH;

  if (!expectedUsername || !expectedHash) {
    res.status(500).json({ error: 'Admin credentials not configured' });
    return;
  }

  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    username !== expectedUsername ||
    !(await bcrypt.compare(password, expectedHash))
  ) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = signAdminToken();
  res.json({ token });
});

// GET /api/auth/me — refresh user info (used to validate stored JWT on app boot)
router.get('/me', requireUser, async (req, res) => {
  try {
    const result = await query<{ id: string; name: string; active: boolean; active_program_id: string | null; selected_character_id: string }>(
      'SELECT id, name, active, active_program_id, selected_character_id FROM users WHERE id = $1',
      [req.user!.userId]
    );
    if (result.rows.length === 0 || !result.rows[0].active) {
      res.status(401).json({ error: 'User not found or access revoked' });
      return;
    }
    const u = result.rows[0];
    res.json({ id: u.id, name: u.name, activeProgramId: u.active_program_id, selectedCharacterId: u.selected_character_id });
  } catch (err) {
    console.error('Auth me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
