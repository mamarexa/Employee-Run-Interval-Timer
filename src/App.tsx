import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useSearchParams, useNavigate } from 'react-router-dom';
import { ActiveWorkoutTimer } from './components/timer/ActiveWorkoutTimer';
import { useTimerStore, WorkoutSession } from './store/useTimerStore';
import { useUserStore } from './store/useUserStore';
import { useAuthStore } from './store/useAuthStore';
import { api, verifyPass, silentRefresh } from './lib/api';
import { GlassCard } from './components/ui/glass-card';
import { BottomNav } from './components/ui/bottom-nav';
import { motion, AnimatePresence } from 'motion/react';
import { Play, LogOut, ChevronLeft, Activity, Clock, Zap, Calendar } from 'lucide-react';
import { SlideToStart } from './components/ui/slide-to-start';
import { CHARACTERS } from './store/useUserStore';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { cn } from './lib/utils';
import AuthVerify from './pages/AuthVerify';
import AdminLogin from './pages/AdminLogin';
import Admin from './pages/Admin';

// --- Types ---
interface ApiProgram {
  id: string;
  slug: string;
  title: string;
  description: string;
  session_count: number;
}

interface IntervalData {
  type: 'run' | 'walk' | 'warmup' | 'cooldown';
  duration: number;
}

interface ApiSession {
  id: number;
  week_number: number;
  session_number: number;
  title: string;
  interval_data: IntervalData[];
}

interface HistoryEntry {
  id: number;
  program_id: number | string;
  week_number: number;
  session_number: number;
  completed_at: string;
  feedback: string;
  program_title: string;
  interval_data?: IntervalData[];
}

// --- Interval grouping ---
interface RepeatGroup {
  type: 'repeat';
  count: number;
  pattern: IntervalData[];
}

interface SingleGroup {
  type: 'single';
  interval: IntervalData;
}

type DisplayGroup = RepeatGroup | SingleGroup;

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = seconds / 60;
  if (Number.isInteger(mins)) {
    return `${mins}m`;
  }
  return `${mins.toFixed(1).replace(/\.0$/, '')}m`;
}

function getDisplayGroups(intervals: IntervalData[]): DisplayGroup[] {
  const groups: DisplayGroup[] = [];
  let i = 0;
  
  while (i < intervals.length) {
    if (i + 3 < intervals.length) {
      const p1 = intervals[i];
      const p2 = intervals[i + 1];
      
      let count = 0;
      let j = i;
      while (j + 1 < intervals.length) {
        const c1 = intervals[j];
        const c2 = intervals[j + 1];
        if (
          c1.type === p1.type && c1.duration === p1.duration &&
          c2.type === p2.type && c2.duration === p2.duration
        ) {
          count++;
          j += 2;
        } else {
          break;
        }
      }
      
      if (count >= 2) {
        groups.push({
          type: 'repeat',
          count,
          pattern: [p1, p2],
        });
        i = j;
        continue;
      }
    }
    
    groups.push({
      type: 'single',
      interval: intervals[i],
    });
    i++;
  }
  return groups;
}

function IntervalPills({ intervals }: { intervals: IntervalData[] }) {
  const groups = getDisplayGroups(intervals);
  return (
    <div className="flex gap-1.5 flex-wrap items-center">
      {groups.map((g, idx) => {
        if (g.type === 'single') {
          const { type, duration } = g.interval;
          return (
            <span
              key={idx}
              className={cn(
                'text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md shadow-sm border transition-all duration-200 hover:scale-[1.02]',
                type === 'run' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-500/20' :
                type === 'walk' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-500/20' :
                'bg-slate-50 dark:bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-100 dark:border-slate-500/20'
              )}
            >
              {formatDuration(duration)} {type}
            </span>
          );
        } else {
          const { count, pattern } = g;
          return (
            <div
              key={idx}
              className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border border-indigo-100 dark:border-indigo-500/20 shadow-sm transition-all duration-200 hover:scale-[1.02]"
            >
              <span>{count}x</span>
              <span className="opacity-55">(</span>
              {pattern.map((p, pIdx) => (
                <span key={pIdx} className="flex items-center">
                  {pIdx > 0 && <span className="mx-0.5 opacity-55">+</span>}
                  <span className={cn(
                    p.type === 'run' ? 'text-emerald-600 dark:text-emerald-400' :
                    p.type === 'walk' ? 'text-blue-600 dark:text-blue-400' :
                    ''
                  )}>
                    {formatDuration(p.duration)} {p.type}
                  </span>
                </span>
              ))}
              <span className="opacity-55">)</span>
            </div>
          );
        }
      })}
    </div>
  );
}

// --- AuthGate ---
function AuthGate({ children }: { children: React.ReactNode }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { pass, token } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'ok' | 'locked'>('loading');
  const [linkInput, setLinkInput] = useState('');
  const [linkError, setLinkError] = useState(false);

  useEffect(() => {
    const urlPass = searchParams.get('pass');
    (async () => {
      if (urlPass) {
        const ok = await verifyPass(urlPass);
        if (ok) {
          navigate('/', { replace: true });
          setStatus('ok');
        } else {
          setStatus('locked');
        }
        return;
      }
      if (token) {
        try {
          await api.get('/api/auth/me');
          setStatus('ok');
          return;
        } catch { /* fall through */ }
      }
      if (pass) {
        const ok = await silentRefresh();
        if (ok) {
          setStatus('ok');
          return;
        }
      }
      setStatus('locked');
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[100dvh]">
        <div className="w-10 h-10 rounded-full border-4 border-slate-300 border-t-slate-900 animate-spin" />
      </div>
    );
  }
  const handleLinkSubmit = async () => {
    const raw = linkInput.trim();
    let extractedPass = raw;
    try {
      const url = new URL(raw);
      extractedPass = url.searchParams.get('pass') ?? raw;
    } catch { /* raw is already just the token */ }
    if (!extractedPass) return;
    setStatus('loading');
    const ok = await verifyPass(extractedPass);
    if (ok) {
      navigate('/', { replace: true });
      setStatus('ok');
    } else {
      setLinkError(true);
      setStatus('locked');
    }
  };

  if (status === 'locked') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] p-8 text-center gap-6">
        <GlassCard className="p-8 max-w-sm w-full space-y-4">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Access Required</h1>
          <p className="text-slate-600 dark:text-white/70">Use your personal invite link, or paste it below.</p>
          <div className="space-y-2 text-left">
            <input
              type="text"
              value={linkInput}
              onChange={e => { setLinkInput(e.target.value); setLinkError(false); }}
              onKeyDown={e => e.key === 'Enter' && handleLinkSubmit()}
              placeholder="Paste your invite link…"
              className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-white/20 bg-white/60 dark:bg-white/10 text-slate-800 dark:text-white placeholder:text-slate-400 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
            />
            {linkError && <p className="text-red-500 text-xs">Invalid link. Please try again.</p>}
            <button
              onClick={handleLinkSubmit}
              className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors"
            >
              Continue
            </button>
          </div>
        </GlassCard>
      </div>
    );
  }
  return <>{children}</>;
}

// --- MainApp ---
function MainApp() {
  const [activeTab, setActiveTab] = useState<'home' | 'programs' | 'profile'>('home');
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [viewingProgram, setViewingProgram] = useState<ApiProgram | null>(null);
  const [programSessions, setProgramSessions] = useState<ApiSession[]>([]);
  const [activeSessionInfo, setActiveSessionInfo] = useState<{ programId: string; week: number; sessionNum: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [programs, setPrograms] = useState<ApiProgram[]>([]);
  const [apiHistory, setApiHistory] = useState<HistoryEntry[]>([]);
  const [apiProgress, setApiProgress] = useState<Record<string, { current_week: number; current_session: number }>>({});
  const [activeProgramId, setActiveProgramId] = useState<string | null>(null);
  const [upcomingSession, setUpcomingSession] = useState<ApiSession | null>(null);

  const { user, logout } = useAuthStore();
  const { selectedCharacterId, setSelectedCharacter } = useUserStore();

  const loadSession = useTimerStore(s => s.loadSession);
  const resetTimer = useTimerStore(s => s.reset);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    api.get<ApiProgram[]>('/api/programs').then(setPrograms).catch(console.error);
    api.get<{ activeProgramId: string | null }>('/api/auth/me').then(d => {
      if (d.activeProgramId) setActiveProgramId(d.activeProgramId);
    }).catch(console.error);
    api.get<HistoryEntry[]>('/api/me/history').then(setApiHistory).catch(console.error);
    api.get<Record<string, { week: number; session: number }>>('/api/me/progress').then(progressMap => {
      const map: Record<string, { current_week: number; current_session: number }> = {};
      Object.entries(progressMap).forEach(([id, p]) => {
        map[id] = { current_week: p.week, current_session: p.session };
      });
      setApiProgress(map);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!activeProgramId) { setUpcomingSession(null); return; }
    const prog = apiProgress[activeProgramId];
    const week = Number(prog?.current_week ?? 1);
    const session = Number(prog?.current_session ?? 1);
    api.get<ApiSession[]>(`/api/programs/${activeProgramId}/sessions`).then(sessions => {
      const found = sessions.find(s => Number(s.week_number) === week && Number(s.session_number) === session);
      setUpcomingSession(found ?? sessions[0] ?? null);
    }).catch(console.error);
  }, [activeProgramId, apiProgress]);

  const handleStartWorkout = (sess: ApiSession, program: ApiProgram) => {
    loadSession({
      id: String(sess.id),
      title: `${program.title} - ${sess.title}`,
      intervals: sess.interval_data.map(i => ({ type: i.type as WorkoutSession['intervals'][number]['type'], duration: i.duration })),
    });
    setActiveSessionInfo({ programId: program.id, week: sess.week_number, sessionNum: sess.session_number });
    setIsTimerActive(true);
  };

  const handleCompleteWorkout = useCallback(async (feedback: string) => {
    if (activeSessionInfo) {
      const { programId, week, sessionNum } = activeSessionInfo;
      try {
        await api.post('/api/me/history', { programId, weekNumber: Number(week), sessionNumber: Number(sessionNum), feedback });
        const sessions = await api.get<ApiSession[]>(`/api/programs/${programId}/sessions`);
        const curIdx = sessions.findIndex(s => Number(s.week_number) === Number(week) && Number(s.session_number) === Number(sessionNum));
        const next = sessions[curIdx + 1];
        if (next) {
          await api.post('/api/me/progress', { programId, week: Number(next.week_number), session: Number(next.session_number) });
          setApiProgress(p => ({ ...p, [programId]: { current_week: Number(next.week_number), current_session: Number(next.session_number) } }));
        }
        const history = await api.get<HistoryEntry[]>('/api/me/history');
        setApiHistory(history);
      } catch (e) { console.error(e); }
    }
    setActiveSessionInfo(null);
    resetTimer();
    setIsTimerActive(false);
    showToast('Workout complete!');
  }, [activeSessionInfo, resetTimer]);

  const handleCloseTimer = () => { setActiveSessionInfo(null); resetTimer(); setIsTimerActive(false); };

  const handleSelectProgram = async (prog: ApiProgram) => {
    await api.patch('/api/me', { activeProgramId: prog.id }).catch(console.error);
    setActiveProgramId(prog.id);
    setActiveTab('home');
    setViewingProgram(null);
  };

  const handleViewProgram = async (prog: ApiProgram) => {
    const sessions = await api.get<ApiSession[]>(`/api/programs/${prog.id}/sessions`).catch(() => [] as ApiSession[]);
    setProgramSessions(sessions);
    setViewingProgram(prog);
  };

  const renderHome = () => {
    const activeProgram = programs.find(p => p.id === activeProgramId) ?? null;
    if (!activeProgram || !upcomingSession) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center h-[100dvh] space-y-6">
          <GlassCard className="p-8 w-full max-w-sm">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">No Active Program</h2>
            <p className="text-slate-600 dark:text-white/70 mb-6">Head over to the Programs tab to pick a training plan and get started.</p>
            <button onClick={() => setActiveTab('programs')} className="w-full py-4 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold">
              Browse Programs
            </button>
          </GlassCard>
        </div>
      );
    }
    const prog = apiProgress[activeProgramId!];
    const totalSessions = activeProgram.session_count;
    const completedCount = apiHistory.filter(h => h.program_id === activeProgramId).length;
    const progressPercent = Math.round((completedCount / totalSessions) * 100) || 0;
    const totalSeconds = upcomingSession.interval_data.reduce((a, b) => a + b.duration, 0);
    const mins = Math.floor(totalSeconds / 60);

    return (
      <div className="w-full max-w-sm px-6 safe-area-pt pb-32 space-y-6 flex flex-col mx-auto">
        <GlassCard className="p-8 text-center space-y-8 flex flex-col items-center mt-4">
          <div className="space-y-2 w-full">
            <h2 className="text-slate-500 dark:text-white/60 text-xs tracking-widest uppercase font-semibold">Up Next</h2>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight leading-tight mb-4">{activeProgram.title}</h1>
            <div className="w-full bg-white/40 dark:bg-black/20 rounded-full h-3 mb-2 overflow-hidden shadow-inner">
              <motion.div className="h-full bg-slate-900 dark:bg-white rounded-full origin-left" initial={{ scaleX: 0 }} animate={{ scaleX: completedCount / totalSessions }} transition={{ duration: 1, ease: 'easeOut' }} />
            </div>
            <p className="text-slate-600 dark:text-white/80 font-semibold text-sm">
              {progressPercent}% Complete <span className="text-slate-400 font-normal">({completedCount}/{totalSessions})</span>
            </p>
          </div>
          <div className="space-y-4 w-full bg-white/40 dark:bg-black/10 p-5 rounded-[24px]">
            <div className="flex justify-between text-sm text-slate-600 dark:text-white/80">
              <span className="font-medium text-slate-500">Scheduled For</span>
              <span className="font-semibold text-slate-800 dark:text-white">Week {upcomingSession.week_number}, Day {upcomingSession.session_number}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600 dark:text-white/80">
              <span className="font-medium text-slate-500">Total Time</span>
              <span className="font-semibold text-slate-800 dark:text-white">{mins} mins</span>
            </div>
          </div>
          <AnimatePresence>
            <motion.div key={`slide-${prog?.current_week}-${prog?.current_session}`} className="w-full" exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <SlideToStart className="mt-2" onStart={() => handleStartWorkout(upcomingSession, activeProgram)} resetDep={activeTab} />
            </motion.div>
          </AnimatePresence>
        </GlassCard>
      </div>
    );
  };

  const renderPrograms = () => {
    if (viewingProgram) {
      const weeks = Array.from(new Set(programSessions.map(s => s.week_number)));
      return (
        <div className="w-full max-w-md px-6 safe-area-pt pb-32 space-y-6 mx-auto overflow-y-auto min-h-[100dvh] no-scrollbar flex flex-col">
          <button onClick={() => setViewingProgram(null)} className="flex items-center gap-2 text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white font-semibold mb-2">
            <ChevronLeft className="w-5 h-5" /> Back
          </button>
          <h1 className="text-4xl font-extrabold text-slate-800 dark:text-white tracking-tight">{viewingProgram.title}</h1>
          <p className="text-slate-600 dark:text-white/80 text-lg leading-relaxed">{viewingProgram.description}</p>
          <div className="flex-1 space-y-8 mt-8">
            {weeks.map(week => (
              <div key={week} className="space-y-4">
                <h3 className="font-bold text-slate-500 dark:text-white/50 uppercase tracking-widest text-sm">Week {week}</h3>
                <div className="space-y-3">
                  {programSessions.filter(s => s.week_number === week).map(session => {
                    const totalMins = Math.floor(session.interval_data.reduce((a, b) => a + b.duration, 0) / 60);
                    return (
                      <GlassCard key={session.id} className="p-4 flex flex-col gap-3 bg-white/50 dark:bg-black/20 cursor-pointer active:scale-95 transition-transform" onClick={() => handleStartWorkout(session, viewingProgram)}>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Play className="w-4 h-4 text-slate-800 dark:text-white" />
                            <span className="font-bold text-slate-800 dark:text-white">Workout {session.session_number}</span>
                          </div>
                          <span className="text-slate-600 dark:text-white/70 text-sm font-semibold">{totalMins} mins</span>
                        </div>
                        <IntervalPills intervals={session.interval_data} />
                      </GlassCard>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="pt-8 pb-4">
            <button onClick={() => handleSelectProgram(viewingProgram)} className="w-full py-4 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-lg shadow-xl">
              {activeProgramId === viewingProgram.id ? 'Currently Active' : 'Start this Program'}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="w-full max-w-md px-6 safe-area-pt pb-32 space-y-6 mx-auto overflow-y-auto min-h-[100dvh] no-scrollbar">
        <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white mb-8 tracking-tight">Programs</h1>
        <div className="flex flex-col gap-4">
          {programs.map(prog => {
            const isActive = activeProgramId === prog.id;
            const progStatus = apiProgress[prog.id];
            const completedCount = apiHistory.filter(h => h.program_id === prog.id).length;
            const progressPercent = Math.round((completedCount / prog.session_count) * 100) || 0;
            return (
              <GlassCard key={prog.id} className="p-6 text-left relative overflow-hidden cursor-pointer hover:bg-white/50 transition-colors" onClick={() => handleViewProgram(prog)}>
                {isActive && (
                  <div className="absolute top-0 right-0 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">Active</div>
                )}
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{prog.title}</h3>
                <p className="text-sm text-slate-600 dark:text-white/70 mb-4 leading-relaxed bg-white/30 dark:bg-black/20 p-4 rounded-xl">{prog.description}</p>
                <div className="flex justify-between items-center bg-white/20 dark:bg-white/5 p-3 rounded-2xl">
                  <span className="text-xs font-semibold text-slate-600 dark:text-white/60 uppercase tracking-widest">{prog.session_count} Sessions</span>
                  <button onClick={e => { e.stopPropagation(); handleSelectProgram(prog); }} className="px-6 py-2 rounded-full font-bold text-sm bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm">
                    {isActive ? 'Continue' : 'Start'}
                  </button>
                </div>
                {isActive && progStatus && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs mb-1 font-semibold text-slate-600 dark:text-white/60">
                      <span>Progress</span><span>{progressPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-black/40 rounded-full h-1.5 overflow-hidden">
                      <motion.div className="h-full bg-slate-900 dark:bg-white rounded-full origin-left" initial={{ scaleX: 0 }} animate={{ scaleX: completedCount / prog.session_count }} transition={{ duration: 0.8, ease: 'easeOut' }} />
                    </div>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      </div>
    );
  };

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ avatar: string | null }>('/api/me').then(d => {
      if (d.avatar) setAvatarUrl(d.avatar);
    }).catch(() => {});
  }, []);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Resize to 256×256 via canvas
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await new Promise(r => { img.onload = r; });
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    // Cover crop
    const scale = Math.max(256 / img.width, 256 / img.height);
    const sw = 256 / scale, sh = 256 / scale;
    const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 256, 256);
    const base64 = canvas.toDataURL('image/jpeg', 0.8);
    try {
      await api.post('/api/me/avatar', { avatar: base64 });
      setAvatarUrl(base64);
      showToast('Profile picture updated!');
    } catch {
      showToast('Upload failed. Try a smaller image.');
    }
  };

  const renderProfile = () => {
    // 1. Calculate stats
    let totalRunSeconds = 0;
    let totalActiveSeconds = 0;
    apiHistory.forEach(entry => {
      if (entry.interval_data && Array.isArray(entry.interval_data)) {
        entry.interval_data.forEach(inv => {
          if (inv.type === 'run') {
            totalRunSeconds += inv.duration;
          }
          totalActiveSeconds += inv.duration;
        });
      } else {
        totalRunSeconds += 8 * 60; // default estimate
        totalActiveSeconds += 26 * 60; // default estimate
      }
    });
    const totalRunMinutes = Math.round(totalRunSeconds / 60);
    const totalActiveMinutes = Math.round(totalActiveSeconds / 60);

    // 2. Consistency Grid (last 28 days) & Streak Calculation
    const today = new Date();
    const gridDays: Date[] = [];
    for (let i = 27; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      gridDays.push(d);
    }
    const completedDates = new Set(
      apiHistory.map(h => new Date(h.completed_at).toDateString())
    );

    // Calculate current streak
    let currentStreak = 0;
    let checkDate = new Date(today);
    const workedOutToday = completedDates.has(checkDate.toDateString());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const workedOutYesterday = completedDates.has(yesterday.toDateString());
    
    if (workedOutToday || workedOutYesterday) {
      if (!workedOutToday) {
        checkDate = yesterday;
      }
      while (completedDates.has(checkDate.toDateString())) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }

    return (
      <div className="w-full max-w-md px-6 safe-area-pt pb-32 space-y-6 mx-auto overflow-y-auto min-h-[100dvh] no-scrollbar">
        {/* Profile Header */}
        <div className="flex items-center gap-4 mb-4">
          <label className="relative cursor-pointer group">
            <input type="file" accept="image/*" className="sr-only" onChange={handleAvatarChange} />
            <img
              src={avatarUrl ?? `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(user?.name ?? 'User')}&backgroundColor=1A202C`}
              alt="avatar"
              className="w-16 h-16 rounded-full border-2 border-white shadow-md bg-white/50 object-cover"
            />
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity">
              <span className="text-white text-[10px] font-bold">EDIT</span>
            </div>
          </label>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">{user?.name ?? 'Runner'}</h1>
            <p className="text-xs text-slate-500 dark:text-white/50 mt-0.5">Tap photo to change</p>
          </div>
        </div>

        {/* Consistency Calendar - Hero Card */}
        <GlassCard className="p-5 bg-white/40 dark:bg-black/10 border-l-4 border-l-emerald-500 shadow-md">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-500" />
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-700 dark:text-white/80">Consistency Calendar</h3>
            </div>
            {currentStreak > 0 && (
              <div className="flex items-center gap-1 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full text-xs font-black animate-pulse">
                🔥 {currentStreak} Day Streak
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
            <div className="flex items-end gap-3">
              {/* Day Labels */}
              <div className="grid grid-rows-7 gap-2 text-[9px] font-extrabold text-slate-400 dark:text-white/40 uppercase leading-[18px] pb-1">
                <span>M</span>
                <span>T</span>
                <span>W</span>
                <span>T</span>
                <span>F</span>
                <span>S</span>
                <span>S</span>
              </div>
              
              {/* 7x4 Grid */}
              <div className="grid grid-flow-col grid-cols-4 grid-rows-7 gap-2 p-2 bg-slate-100 dark:bg-black/30 rounded-2xl border border-white/10 shadow-inner">
                {gridDays.map((day, idx) => {
                  const completed = completedDates.has(day.toDateString());
                  const isToday = day.toDateString() === today.toDateString();
                  return (
                    <div
                      key={idx}
                      title={`${day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: ${completed ? 'Completed' : 'No workout'}`}
                      className={cn(
                        "w-[18px] h-[18px] rounded-md transition-all duration-300",
                        completed 
                          ? "bg-emerald-500 dark:bg-emerald-400 shadow-md shadow-emerald-500/30 scale-105" 
                          : "bg-slate-200 dark:bg-white/10 hover:bg-slate-350 dark:hover:bg-white/20",
                        isToday && !completed && "border-2 border-indigo-500 dark:border-indigo-400 animate-pulse"
                      )}
                    />
                  );
                })}
              </div>
            </div>

            {/* Calendar Stats Summary */}
            <div className="flex flex-col justify-center text-center sm:text-left gap-2 min-w-[120px]">
              <div className="bg-white/25 dark:bg-white/5 p-3 rounded-2xl border border-white/20 dark:border-white/5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/40">Active Days</span>
                <span className="text-2xl font-black text-slate-800 dark:text-white">{completedDates.size} <span className="text-xs font-semibold text-slate-400">/ 28</span></span>
              </div>
              <div className="bg-white/25 dark:bg-white/5 p-3 rounded-2xl border border-white/20 dark:border-white/5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/40">Frequency</span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{Math.round((completedDates.size / 28) * 100)}%</span>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <GlassCard className="p-3 text-center flex flex-col items-center justify-center bg-white/40 dark:bg-black/10">
            <Activity className="w-5 h-5 text-indigo-500 mb-1" />
            <span className="text-xl font-black text-slate-800 dark:text-white">{apiHistory.length}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/40 mt-0.5">Workouts</span>
          </GlassCard>
          
          <GlassCard className="p-3 text-center flex flex-col items-center justify-center bg-white/40 dark:bg-black/10">
            <Clock className="w-5 h-5 text-emerald-500 mb-1" />
            <span className="text-xl font-black text-slate-800 dark:text-white">{totalRunMinutes}m</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/40 mt-0.5">Run Time</span>
          </GlassCard>
          
          <GlassCard className="p-3 text-center flex flex-col items-center justify-center bg-white/40 dark:bg-black/10">
            <Zap className="w-5 h-5 text-amber-500 mb-1" />
            <span className="text-xl font-black text-slate-800 dark:text-white">{totalActiveMinutes}m</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/40 mt-0.5">Active</span>
          </GlassCard>
        </div>

        {/* Character Selection */}
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mt-8 tracking-tight">Your Character</h2>
        <GlassCard className="p-4 bg-white/40 dark:bg-black/10">
          <div className="grid grid-cols-3 gap-3">
            {CHARACTERS.map(char => {
              const isSelected = char.id === selectedCharacterId;
              return (
                <button key={char.id} onClick={() => setSelectedCharacter(char.id)} className={cn("flex flex-col items-center gap-2 p-3 rounded-2xl transition-all border-2", isSelected ? 'bg-slate-900/5 dark:bg-white/10 border-slate-900 dark:border-white' : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5')}>
                  <div className="w-16 h-16 rounded-xl bg-white/40 dark:bg-black/20 flex items-center justify-center p-2 mb-1">
                    <div className="w-full h-full drop-shadow-md" style={{ filter: char.id === 'running-guy' ? 'brightness(0) invert(1)' : 'none' }}>
                      <DotLottieReact src={char.url} loop autoplay />
                    </div>
                  </div>
                  <span className={cn('text-[10px] font-bold text-center uppercase tracking-wider', isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-white/60')}>{char.name}</span>
                </button>
              );
            })}
          </div>
        </GlassCard>

        {/* Sign Out */}
        <GlassCard className="p-2">
          <button onClick={() => { logout(); showToast('Signed out.'); }} className="flex items-center gap-3 w-full p-4 text-left hover:bg-white/20 rounded-2xl transition-colors text-red-500">
            <LogOut className="w-5 h-5" />
            <span className="font-semibold flex-1">Sign Out</span>
          </button>
        </GlassCard>

        {/* Workout History */}
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mt-8 tracking-tight">Workout History</h2>
        {apiHistory.length === 0 ? (
          <GlassCard className="p-8 text-center text-slate-600 dark:text-white/70">No workouts completed yet. Let's get moving!</GlassCard>
        ) : (
          <div className="flex flex-col gap-4">
            {apiHistory.map(entry => {
              const date = new Date(entry.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
              return (
                <GlassCard key={entry.id} className="p-4 flex flex-col gap-3 bg-white/40 dark:bg-black/10 border-l-4 border-l-slate-800 dark:border-l-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">{entry.program_title}</p>
                      <p className="text-xs text-slate-500 dark:text-white/60 font-semibold mt-0.5">Week {entry.week_number}, Workout {entry.session_number} &bull; {date}</p>
                    </div>
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/60 dark:bg-black/20 text-xl shadow-sm">
                      {entry.feedback === 'easy' ? '😌' : entry.feedback === 'perfect' ? '🔥' : '🥵'}
                    </div>
                  </div>
                  {entry.interval_data && Array.isArray(entry.interval_data) && (
                    <div className="pt-1 border-t border-slate-200 dark:border-white/5">
                      <IntervalPills intervals={entry.interval_data} />
                    </div>
                  )}
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] w-full font-sans text-slate-900 dark:text-white relative">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: -20, x: '-50%' }} className="fixed top-safe-pt mt-4 left-1/2 z-[200] bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-full shadow-2xl font-bold text-sm text-center flex items-center justify-center whitespace-nowrap">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        {!isTimerActive ? (
          <motion.div key="main-app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
            {activeTab === 'home' && renderHome()}
            {activeTab === 'programs' && renderPrograms()}
            {activeTab === 'profile' && renderProfile()}
            <BottomNav currentTab={activeTab} onChange={setActiveTab} />
          </motion.div>
        ) : (
          <motion.div key="timer" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="fixed inset-0 w-full h-[100dvh] pb-safe-pb z-[100] bg-gradient-to-br from-[#E0F7FA] via-[#E8F5E9] to-[#E8EAF6] dark:from-[#1A202C] dark:via-[#2D3748] dark:to-[#4A5568]">
            <ActiveWorkoutTimer onComplete={handleCompleteWorkout} onClose={handleCloseTimer} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Root App with Routes ---
// --- Install Guide (shown when opened in browser, not as installed PWA) ---
function InstallGuide() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] p-6 text-center">
      <div className="max-w-sm w-full space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-2">
          <img src="/icons/icon-192.svg" alt="Run" className="w-20 h-20 rounded-[22px] shadow-2xl" />
          <h1 className="text-3xl font-extrabold text-white tracking-tight">MonCivique Run</h1>
          <p className="text-white/60 text-sm">Your personal running coach</p>
        </div>

        {/* Why */}
        <GlassCard className="p-5 text-left space-y-3">
          <p className="text-white font-semibold text-sm">This app works best installed on your phone — it needs to run as a home screen app to:</p>
          <ul className="space-y-2 text-white/80 text-sm">
            <li className="flex items-center gap-2"><span className="text-lg">🔔</span> Play audio cues when to run and walk</li>
            <li className="flex items-center gap-2"><span className="text-lg">📳</span> Vibrate at each interval change</li>
            <li className="flex items-center gap-2"><span className="text-lg">🔒</span> Keep running in the background</li>
          </ul>
        </GlassCard>

        {/* Steps */}
        <GlassCard className="p-5 text-left space-y-4">
          <p className="text-white font-bold text-sm uppercase tracking-wider">How to install</p>
          {isIOS ? (
            <ol className="space-y-3 text-white/80 text-sm">
              <li className="flex gap-3">
                <span className="text-white font-bold w-5 shrink-0">1.</span>
                <span>Tap the <strong className="text-white">Share</strong> button <span className="inline-block bg-white/20 px-1.5 py-0.5 rounded text-xs">⎙</span> at the bottom of Safari</span>
              </li>
              <li className="flex gap-3">
                <span className="text-white font-bold w-5 shrink-0">2.</span>
                <span>Scroll down and tap <strong className="text-white">Add to Home Screen</strong></span>
              </li>
              <li className="flex gap-3">
                <span className="text-white font-bold w-5 shrink-0">3.</span>
                <span>Tap <strong className="text-white">Add</strong> in the top right</span>
              </li>
              <li className="flex gap-3">
                <span className="text-white font-bold w-5 shrink-0">4.</span>
                <span>Open the app from your home screen and paste your invite link</span>
              </li>
            </ol>
          ) : (
            <ol className="space-y-3 text-white/80 text-sm">
              <li className="flex gap-3">
                <span className="text-white font-bold w-5 shrink-0">1.</span>
                <span>Tap the <strong className="text-white">⋮</strong> menu in Chrome (top right)</span>
              </li>
              <li className="flex gap-3">
                <span className="text-white font-bold w-5 shrink-0">2.</span>
                <span>Tap <strong className="text-white">Add to Home screen</strong> or <strong className="text-white">Install app</strong></span>
              </li>
              <li className="flex gap-3">
                <span className="text-white font-bold w-5 shrink-0">3.</span>
                <span>Open the app from your home screen and paste your invite link</span>
              </li>
            </ol>
          )}
        </GlassCard>

        <p className="text-white/40 text-xs">Already installed? Open the app from your home screen icon.</p>
      </div>
    </div>
  );
}

export default function App() {
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true);

  return (
    <Routes>
      <Route path="/auth/verify" element={<AuthVerify />} />
      <Route path="/admin" element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={<Admin />} />
      <Route path="/*" element={
        isStandalone
          ? <AuthGate><MainApp /></AuthGate>
          : <InstallGuide />
      } />
    </Routes>
  );
}
