import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/ui/glass-card';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, Check, ToggleLeft, ToggleRight, Trash2, Plus, ChevronLeft, LogOut, Edit2, X } from 'lucide-react';

const APP_URL = window.location.origin;

function adminHeaders() {
  const t = sessionStorage.getItem('wt_admin');
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

async function adminFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...options, headers: adminHeaders() });
  if (res.status === 401 || res.status === 403) throw new Error('UNAUTHORIZED');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data as T;
}

// ─────────────── Types ───────────────
interface AdminUser {
  id: string;
  name: string;
  magic_link_token: string;
  active: boolean;
  active_program_id: string | null;
  program_title: string | null;
  created_at: string;
}

interface AdminProgram {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  sessionCount: number;
  enrolledCount: number;
}

interface AdminSession {
  id: string;
  week_number: number;
  session_number: number;
  title: string;
  interval_data: Array<{ type: string; duration: number }>;
}

interface Metrics {
  weeklyWorkouts: number;
  activeUsers: number;
  totalWorkouts: number;
}

// ─────────────── Interval Editor ───────────────
function IntervalEditor({
  session,
  onSave,
  onClose,
}: {
  session: AdminSession;
  onSave: () => void;
  onClose: () => void;
}) {
  const [intervals, setIntervals] = useState(session.interval_data.map(i => ({ ...i })));
  const [saving, setSaving] = useState(false);

  const update = (idx: number, field: 'type' | 'duration', value: string | number) => {
    setIntervals(prev => prev.map((iv, i) => i === idx ? { ...iv, [field]: value } : iv));
  };

  const remove = (idx: number) => setIntervals(prev => prev.filter((_, i) => i !== idx));

  const add = () => setIntervals(prev => [...prev, { type: 'run', duration: 60 }]);

  const save = async () => {
    setSaving(true);
    try {
      await adminFetch(`/api/admin/sessions/${session.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ intervalData: intervals }),
      });
      onSave();
    } catch { /* ignore */ }
    setSaving(false);
  };

  const typeColors: Record<string, string> = {
    warmup: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    run: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    walk: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
    cooldown: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="w-full max-w-lg max-h-[80vh] flex flex-col"
      >
        <GlassCard className="flex flex-col p-6 gap-4 overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">{session.title}</h2>
              <p className="text-xs text-slate-500 dark:text-white/50">Week {session.week_number}, Session {session.session_number}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
          </div>

          <div className="overflow-y-auto flex-1 space-y-2 pr-1">
            {intervals.map((iv, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <select
                  value={iv.type}
                  onChange={e => update(idx, 'type', e.target.value)}
                  className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold border-0 focus:outline-none focus:ring-2 focus:ring-slate-800/30 ${typeColors[iv.type] ?? ''}`}
                >
                  <option value="warmup">Warmup</option>
                  <option value="run">Run</option>
                  <option value="walk">Walk</option>
                  <option value="cooldown">Cooldown</option>
                </select>
                <div className="flex items-center gap-1 bg-white/40 dark:bg-black/20 rounded-xl px-3 py-2">
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={iv.duration}
                    onChange={e => update(idx, 'duration', Number(e.target.value))}
                    className="w-16 bg-transparent text-sm font-semibold text-slate-800 dark:text-white focus:outline-none text-right"
                  />
                  <span className="text-xs text-slate-500 dark:text-white/50">s</span>
                </div>
                <span className="text-xs text-slate-400 w-8 text-right">{Math.round(iv.duration / 60)}m</span>
                <button onClick={() => remove(idx)} className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={add}
            className="flex items-center gap-2 text-sm text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white font-medium py-1"
          >
            <Plus className="w-4 h-4" /> Add interval
          </button>

          <div className="flex gap-2 pt-2 border-t border-white/20 dark:border-white/10">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-full border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 text-sm font-semibold">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}

// ─────────────── Program Sessions View ───────────────
function ProgramSessions({ program, onBack }: { program: AdminProgram; onBack: () => void }) {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [editingSession, setEditingSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingWeek, setAddingWeek] = useState('');
  const [addingSessionNum, setAddingSessionNum] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<AdminSession[]>(`/api/admin/programs/${program.id}/sessions`);
      setSessions(data);
    } finally {
      setLoading(false);
    }
  }, [program.id]);

  useEffect(() => { load(); }, [load]);

  const deleteSession = async (id: string) => {
    if (!confirm('Delete this session?')) return;
    await adminFetch(`/api/admin/sessions/${id}`, { method: 'DELETE' });
    load();
  };

  const addSession = async () => {
    if (!addingWeek || !addingSessionNum) return;
    await adminFetch(`/api/admin/programs/${program.id}/sessions`, {
      method: 'POST',
      body: JSON.stringify({
        weekNumber: Number(addingWeek),
        sessionNumber: Number(addingSessionNum),
        title: `W${addingWeek}D${addingSessionNum}`,
        intervalData: [
          { type: 'warmup', duration: 300 },
          { type: 'run', duration: 60 },
          { type: 'walk', duration: 60 },
          { type: 'cooldown', duration: 300 },
        ],
      }),
    });
    setAddingWeek(''); setAddingSessionNum('');
    load();
  };

  const weeks = [...new Set(sessions.map(s => s.week_number))].sort((a, b) => a - b);

  return (
    <>
      <div className="space-y-6">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white font-semibold">
          <ChevronLeft className="w-4 h-4" /> Programs
        </button>
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white">{program.title}</h2>
          <p className="text-slate-500 dark:text-white/60 text-sm mt-1">{program.description}</p>
        </div>

        {/* Add session */}
        <GlassCard className="p-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-white/50 uppercase tracking-wider mb-3">Add Session</p>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs text-slate-400 mb-1 block">Week</label>
              <input type="number" min={1} value={addingWeek} onChange={e => setAddingWeek(e.target.value)}
                className="w-full bg-white/40 dark:bg-black/20 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 dark:text-white focus:outline-none" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-400 mb-1 block">Session #</label>
              <input type="number" min={1} value={addingSessionNum} onChange={e => setAddingSessionNum(e.target.value)}
                className="w-full bg-white/40 dark:bg-black/20 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 dark:text-white focus:outline-none" />
            </div>
            <button onClick={addSession} className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold">
              Add
            </button>
          </div>
        </GlassCard>

        {loading ? (
          <p className="text-slate-400 text-sm">Loading…</p>
        ) : (
          <div className="space-y-6">
            {weeks.map(week => (
              <div key={week}>
                <h3 className="text-xs font-bold text-slate-400 dark:text-white/40 uppercase tracking-widest mb-2">Week {week}</h3>
                <div className="space-y-2">
                  {sessions.filter(s => s.week_number === week).map(sess => (
                    <GlassCard key={sess.id} className="p-4 flex justify-between items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-white text-sm">{sess.title}</p>
                        <p className="text-xs text-slate-400 dark:text-white/40 mt-0.5">{sess.interval_data.length} intervals</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingSession(sess)} className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 text-slate-600 dark:text-white/60">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteSession(sess.id)} className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {editingSession && (
          <IntervalEditor
            session={editingSession}
            onSave={() => { setEditingSession(null); load(); }}
            onClose={() => setEditingSession(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─────────────── Main Admin Dashboard ───────────────
export default function Admin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'roster' | 'programs'>('roster');

  // ── Roster state ──
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [newName, setNewName] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<{ userId: string; url: string } | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);

  // ── Programs state ──
  const [programs, setPrograms] = useState<AdminProgram[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [viewingProgram, setViewingProgram] = useState<AdminProgram | null>(null);
  const [newProgramTitle, setNewProgramTitle] = useState('');
  const [newProgramDesc, setNewProgramDesc] = useState('');
  const [programsError, setProgramsError] = useState<string | null>(null);

  const logout = () => {
    sessionStorage.removeItem('wt_admin');
    navigate('/admin', { replace: true });
  };

  // Check admin token on load
  useEffect(() => {
    if (!sessionStorage.getItem('wt_admin')) {
      navigate('/admin', { replace: true });
    }
  }, [navigate]);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setUsersError(null);
    try {
      const [u, m] = await Promise.all([
        adminFetch<AdminUser[]>('/api/admin/users'),
        adminFetch<Metrics>('/api/admin/metrics'),
      ]);
      setUsers(u);
      setMetrics(m);
    } catch (err) {
      if (err instanceof Error && err.message === 'UNAUTHORIZED') logout();
      setUsersError('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const loadPrograms = useCallback(async () => {
    setLoadingPrograms(true);
    setProgramsError(null);
    try {
      const p = await adminFetch<AdminProgram[]>('/api/admin/programs');
      setPrograms(p);
    } catch {
      setProgramsError('Failed to load programs');
    } finally {
      setLoadingPrograms(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadPrograms();
  }, [loadUsers, loadPrograms]);

  const copyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const addUser = async () => {
    if (!newName.trim()) return;
    try {
      const result = await adminFetch<{ id: string; magic_link_token: string }>(
        '/api/admin/users',
        { method: 'POST', body: JSON.stringify({ name: newName.trim() }) }
      );
      const url = `${APP_URL}/?pass=${result.magic_link_token}`;
      setGeneratedLink({ userId: result.id, url });
      setNewName('');
      loadUsers();
    } catch { /* ignore */ }
  };

  const generateLink = async (userId: string) => {
    try {
      const result = await adminFetch<{ magic_link_token: string }>(
        `/api/admin/users/${userId}/generate-link`,
        { method: 'POST' }
      );
      const url = `${APP_URL}/?pass=${result.magic_link_token}`;
      setGeneratedLink({ userId, url });
      loadUsers();
    } catch { /* ignore */ }
  };

  const toggleUser = async (userId: string) => {
    await adminFetch(`/api/admin/users/${userId}/toggle`, { method: 'PATCH' });
    loadUsers();
  };

  const deleteUser = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name}? This will delete all their data.`)) return;
    await adminFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    loadUsers();
  };

  const addProgram = async () => {
    if (!newProgramTitle.trim()) return;
    const slug = newProgramTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    try {
      const result = await adminFetch<{ id: string }>(
        '/api/admin/programs',
        { method: 'POST', body: JSON.stringify({ title: newProgramTitle.trim(), description: newProgramDesc.trim() || null, slug }) }
      );
      setNewProgramTitle(''); setNewProgramDesc('');
      await loadPrograms();
      const created = programs.find(p => p.id === result.id) ?? { ...programs[0], id: result.id, title: newProgramTitle.trim(), slug, description: newProgramDesc.trim() || null, sessionCount: 0, enrolledCount: 0 };
      setViewingProgram(created);
    } catch { /* ignore */ }
  };

  const deleteProgram = async (id: string, enrolled: number, title: string) => {
    const msg = enrolled > 0
      ? `"${title}" has ${enrolled} enrolled user(s). Delete it anyway?`
      : `Delete "${title}"?`;
    if (!confirm(msg)) return;
    await adminFetch(`/api/admin/programs/${id}`, { method: 'DELETE' });
    loadPrograms();
  };

  if (viewingProgram) {
    return (
      <div className="min-h-[100dvh] w-full">
        <div className="max-w-2xl mx-auto px-4 pt-12 pb-20">
          <ProgramSessions program={viewingProgram} onBack={() => { setViewingProgram(null); loadPrograms(); }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full">
      <div className="max-w-2xl mx-auto px-4 pt-12 pb-20 space-y-6">

        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">Admin</h1>
            <p className="text-slate-500 dark:text-white/50 text-sm">MonCivique Run</p>
          </div>
          <button onClick={logout} className="flex items-center gap-2 text-slate-500 dark:text-white/50 hover:text-red-500 font-medium text-sm">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>

        {/* Metrics */}
        {metrics && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'This Week', value: metrics.weeklyWorkouts },
              { label: 'Active Users', value: metrics.activeUsers },
              { label: 'Total Workouts', value: metrics.totalWorkouts },
            ].map(m => (
              <GlassCard key={m.label} className="p-4 text-center">
                <p className="text-2xl font-extrabold text-slate-800 dark:text-white">{m.value}</p>
                <p className="text-xs text-slate-500 dark:text-white/50 font-medium mt-0.5">{m.label}</p>
              </GlassCard>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white/20 dark:bg-black/20 p-1 rounded-2xl">
          {(['roster', 'programs'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors capitalize ${tab === t ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'text-slate-600 dark:text-white/60'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── ROSTER TAB ── */}
        {tab === 'roster' && (
          <>
            {/* Generated link banner */}
            <AnimatePresence>
              {generatedLink && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <GlassCard className="p-4 bg-emerald-50/60 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/30">
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-2">Access link generated — copy & send to the employee:</p>
                    <div className="flex gap-2 items-center">
                      <code className="flex-1 text-xs bg-white/60 dark:bg-black/30 rounded-lg px-3 py-2 break-all text-slate-700 dark:text-white/80">{generatedLink.url}</code>
                      <button onClick={() => copyLink(generatedLink.url, generatedLink.userId)} className="shrink-0 p-2 rounded-lg bg-emerald-600 text-white">
                        {copiedId === generatedLink.userId ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <button onClick={() => setGeneratedLink(null)} className="mt-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white/60">Dismiss</button>
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Add employee */}
            <GlassCard className="p-4">
              <p className="text-xs font-semibold text-slate-500 dark:text-white/50 uppercase tracking-wider mb-3">Add Employee</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Full name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addUser()}
                  className="flex-1 bg-white/40 dark:bg-black/20 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-800/30 dark:focus:ring-white/20"
                />
                <button onClick={addUser} className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </GlassCard>

            {/* Users list */}
            {usersError && <p className="text-red-500 text-sm">{usersError}</p>}
            {loadingUsers ? (
              <p className="text-slate-400 text-sm">Loading…</p>
            ) : users.length === 0 ? (
              <GlassCard className="p-8 text-center text-slate-500 dark:text-white/50">No employees yet. Add one above.</GlassCard>
            ) : (
              <div className="space-y-3">
                {users.map(user => {
                  const url = `${APP_URL}/?pass=${user.magic_link_token}`;
                  return (
                    <GlassCard key={user.id} className={`p-4 ${!user.active ? 'opacity-50' : ''}`}>
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-800 dark:text-white">{user.name}</p>
                            {!user.active && <span className="text-[10px] bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400 font-bold px-2 py-0.5 rounded-full uppercase">Revoked</span>}
                          </div>
                          <p className="text-xs text-slate-400 dark:text-white/40 mt-0.5">
                            {user.program_title ? `📋 ${user.program_title}` : 'No program'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => copyLink(url, user.id + '-link')}
                            title="Copy access link"
                            className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 text-slate-500 dark:text-white/50"
                          >
                            {copiedId === user.id + '-link' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => generateLink(user.id)}
                            title="Generate new link"
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/20"
                          >
                            New link
                          </button>
                          <button
                            onClick={() => toggleUser(user.id)}
                            title={user.active ? 'Revoke access' : 'Restore access'}
                            className={`p-2 rounded-xl ${user.active ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'}`}
                          >
                            {user.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                          </button>
                          <button onClick={() => deleteUser(user.id, user.name)} title="Delete employee" className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── PROGRAMS TAB ── */}
        {tab === 'programs' && (
          <>
            {/* Create program */}
            <GlassCard className="p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 dark:text-white/50 uppercase tracking-wider">Create Program</p>
              <input
                type="text"
                placeholder="Program title"
                value={newProgramTitle}
                onChange={e => setNewProgramTitle(e.target.value)}
                className="w-full bg-white/40 dark:bg-black/20 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={newProgramDesc}
                onChange={e => setNewProgramDesc(e.target.value)}
                className="w-full bg-white/40 dark:bg-black/20 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none"
              />
              <button onClick={addProgram} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold">
                <Plus className="w-4 h-4" /> Create & Edit Sessions
              </button>
            </GlassCard>

            {programsError && <p className="text-red-500 text-sm">{programsError}</p>}
            {loadingPrograms ? (
              <p className="text-slate-400 text-sm">Loading…</p>
            ) : (
              <div className="space-y-3">
                {programs.map(prog => (
                  <GlassCard key={prog.id} className="p-4 flex justify-between items-center gap-4">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setViewingProgram(prog)}>
                      <p className="font-bold text-slate-800 dark:text-white">{prog.title}</p>
                      <p className="text-xs text-slate-400 dark:text-white/40 mt-0.5">
                        {prog.sessionCount} sessions · {prog.enrolledCount} enrolled
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => setViewingProgram(prog)} className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 text-slate-500 dark:text-white/50">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteProgram(prog.id, prog.enrolledCount, prog.title)} className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
