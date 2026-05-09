/**
 * Seed script — runs once on startup if the programs table is empty.
 * Converts the static TypeScript program data into PostgreSQL rows.
 */
import { query } from './db';

type IntervalType = 'warmup' | 'run' | 'walk' | 'cooldown';
interface Interval { type: IntervalType; duration: number; }
interface SessionDef { week: number; session: number; title: string; intervals: Interval[]; }
interface ProgramDef { slug: string; title: string; description: string; sessions: SessionDef[]; }

const rw = (r: number, w: number, n: number): Interval[] => {
  const res: Interval[] = [];
  for (let i = 0; i < n; i++) {
    res.push({ type: 'run', duration: r * 60 });
    res.push({ type: 'walk', duration: w * 60 });
  }
  return res;
};
const rc = (r: number): Interval[] => [{ type: 'run', duration: r * 60 }];
const wc = (core: Interval[]): Interval[] => [
  { type: 'warmup', duration: 300 },
  ...core,
  { type: 'cooldown', duration: 300 },
];

function starterProgram(): ProgramDef {
  const s: SessionDef[] = [];
  const push = (w: number, d: number, core: Interval[]) =>
    s.push({ week: w, session: d, title: `W${w}D${d}`, intervals: wc(core) });

  push(1,1,rw(1,1,3)); push(1,2,rw(1,1,4)); push(1,3,rw(1,1,5)); push(1,4,rw(1,1,6)); push(1,5,rw(1,1,7));
  push(2,1,rw(1,1,8)); push(2,2,rw(1,1,9)); push(2,3,rw(1,1,10)); push(2,4,rw(1,1,11)); push(2,5,rw(1,1,12));
  push(3,1,rw(1,1,13)); push(3,2,rw(1,1,14)); push(3,3,rw(1,1,15)); push(3,4,rw(2,1,3)); push(3,5,rw(2,1,4));
  push(4,1,rw(2,1,5)); push(4,2,rw(2,1,6)); push(4,3,rw(2,1,7)); push(4,4,rw(2,1,8)); push(4,5,rw(2,1,9));
  push(5,1,rw(2,1,10)); push(5,2,rw(3,1,3)); push(5,3,rw(3,1,4)); push(5,4,rw(3,1,5)); push(5,5,rw(3,1,6));
  push(6,1,rw(3,1,7)); push(6,2,rw(3,1,8)); push(6,3,rw(4,1,2)); push(6,4,rw(4,1,3)); push(6,5,rw(4,1,4));
  push(7,1,rw(4,1,5)); push(7,2,rw(4,1,6)); push(7,3,rw(9,1,1)); push(7,4,rw(9,1,2)); push(7,5,rw(9,1,3));
  push(8,1,rw(14,1,1)); push(8,2,rw(14,1,2)); push(8,3,rc(20)); push(8,4,rc(25)); push(8,5,rc(30));
  return {
    slug: 'starter',
    title: '8-Week Starter Program',
    description: 'Perfect for complete beginners. Slowly build up your running tolerance with frequent short sessions (5x a week).',
    sessions: s,
  };
}

function fiveKProgram(): ProgramDef {
  const s: SessionDef[] = [];
  const push = (w: number, d: number, core: Interval[], label?: string) =>
    s.push({ week: w, session: d, title: label || `W${w}D${d}`, intervals: wc(core) });

  push(1,1,rw(2,2,6)); push(1,2,rw(2,2,6)); push(1,3,rw(3,2,5));
  push(2,1,rw(3,2,5)); push(2,2,rw(4,2,4)); push(2,3,rw(4,2,5));
  push(3,1,rw(5,2,4)); push(3,2,rw(5,2,4)); push(3,3,rw(8,2,3));
  push(4,1,rw(8,2,3)); push(4,2,rw(10,2,2)); push(4,3,rw(10,2,3));
  push(5,1,rw(12,2,2)); push(5,2,rw(15,2,2)); push(5,3,rc(20));
  push(6,1,rc(20)); push(6,2,rw(10,1,3)); push(6,3,rc(25));
  push(7,1,rc(25)); push(7,2,rw(15,1,2)); push(7,3,rc(28));
  push(8,1,rc(30)); push(8,2,rc(20)); push(8,3,rc(35), 'W8D3 - 5K Day!');
  return {
    slug: 'road-to-5k',
    title: 'Road to 5K (3x/week)',
    description: 'Transition from run/walk to running a continuous 5K. Requires 3 running days a week.',
    sessions: s,
  };
}

function tenKProgram(): ProgramDef {
  const s: SessionDef[] = [];
  const push = (w: number, d: number, core: Interval[], label?: string) =>
    s.push({ week: w, session: d, title: label || `W${w}D${d}`, intervals: wc(core) });

  push(1,1,rc(20)); push(1,2,rc(25)); push(1,3,rc(35));
  push(2,1,rc(25)); push(2,2,rc(30)); push(2,3,rc(40));
  push(3,1,rw(5,1,5)); push(3,2,rw(10,1,3)); push(3,3,rc(45));
  push(4,1,rc(30)); push(4,2,rw(15,1,2)); push(4,3,rc(50));
  push(5,1,rc(30)); push(5,2,rc(40)); push(5,3,rc(55));
  push(6,1,rc(35)); push(6,2,rc(30)); push(6,3,rc(60));
  push(7,1,rw(15,1,3)); push(7,2,rc(40)); push(7,3,rc(65));
  push(8,1,rc(30)); push(8,2,rc(20)); push(8,3,rc(70), 'W8D3 - 10K Day!');
  return {
    slug: 'road-to-10k',
    title: 'Road to 10K (3x/week)',
    description: 'Build your endurance from 5K to 10K with longer intervals and sustained runs.',
    sessions: s,
  };
}

export async function seedIfEmpty() {
  const existing = await query<{ cnt: string }>('SELECT COUNT(*) as cnt FROM programs');
  if (Number(existing.rows[0].cnt) > 0) {
    console.log('[seed] Programs already seeded, skipping.');
    return;
  }

  console.log('[seed] Seeding programs...');
  const programs: ProgramDef[] = [starterProgram(), fiveKProgram(), tenKProgram()];

  for (let i = 0; i < programs.length; i++) {
    const prog = programs[i];
    const progResult = await query<{ id: string }>(
      'INSERT INTO programs (slug, title, description, sort_order) VALUES ($1, $2, $3, $4) RETURNING id',
      [prog.slug, prog.title, prog.description, i]
    );
    const programId = progResult.rows[0].id;

    for (const sess of prog.sessions) {
      await query(
        'INSERT INTO sessions (program_id, week_number, session_number, title, interval_data) VALUES ($1, $2, $3, $4, $5)',
        [programId, sess.week, sess.session, sess.title, JSON.stringify(sess.intervals)]
      );
    }
    console.log(`[seed]   ✓ ${prog.title} (${prog.sessions.length} sessions)`);
  }
  console.log('[seed] Done.');
}
