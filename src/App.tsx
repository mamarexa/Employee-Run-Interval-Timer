import React, { useState, useEffect, useCallback } from 'react';
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
    
    api.get<ApiSession[]>(`/api/programs/${activeProgramId}/sessions`).then(async (sessions) => {
      if (sessions.length === 0) { setUpcomingSession(null); return; }
      
      // 1. Sort sessions to ensure correct sequential order
      const sortedSessions = [...sessions].sort((a, b) => {
        if (Number(a.week_number) !== Number(b.week_number)) {
          return Number(a.week_number) - Number(b.week_number);
        }
        return Number(a.session_number) - Number(b.session_number);
      });
      
      // 2. Identify completed sessions from history
      const completedSet = new Set(
        apiHistory
          .filter(h => String(h.program_id) === String(activeProgramId))
          .map(h => `${h.week_number}-${h.session_number}`)
      );
      
      let uncompletedIdx = sortedSessions.findIndex(s => !completedSet.has(`${s.week_number}-${s.session_number}`));
      if (uncompletedIdx === -1) {
        // All sessions completed
        uncompletedIdx = sortedSessions.length;
      }
      
      // 3. Find progress-based session index
      const prog = apiProgress[activeProgramId];
      let progressIdx = 0;
      if (prog) {
        progressIdx = sortedSessions.findIndex(
          s => Number(s.week_number) === Number(prog.current_week) && 
               Number(s.session_number) === Number(prog.current_session)
        );
        if (progressIdx === -1) progressIdx = 0;
      }
      
      // 4. Use whichever is further ahead
      const targetIdx = Math.max(uncompletedIdx, progressIdx);
      
      if (targetIdx >= sortedSessions.length) {
        // All sessions completed
        setUpcomingSession(null);
      } else {
        const targetSession = sortedSessions[targetIdx];
        setUpcomingSession(targetSession);
        
        // 5. Auto-sync database progress if it is out of sync or missing
        if (!prog || Number(prog.current_week) !== Number(targetSession.week_number) || Number(prog.current_session) !== Number(targetSession.session_number)) {
          try {
            await api.post('/api/me/progress', { 
              programId: activeProgramId, 
              week: Number(targetSession.week_number), 
              session: Number(targetSession.session_number) 
            });
            // Update local state to match
            setApiProgress(p => ({ 
              ...p, 
              [activeProgramId]: { 
                current_week: Number(targetSession.week_number), 
                current_session: Number(targetSession.session_number) 
              } 
            }));
          } catch (e) {
            console.error('Failed to sync progress to database:', e);
          }
        }
      }
    }).catch(console.error);
  }, [activeProgramId, apiProgress, apiHistory]);

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
    const completedCount = activeProgramId ? apiHistory.filter(h => h.program_id === activeProgramId).length : 0;
    const totalSessions = activeProgram?.session_count ?? 0;
    const isCompleted = activeProgramId && totalSessions > 0 && completedCount >= totalSessions;

    // Show loading skeleton if active program is selected but details are still loading
    if (activeProgramId && (!activeProgram || (!upcomingSession && !isCompleted))) {
      return (
        <div className="w-full max-w-md px-4 sm:px-6 safe-area-pt pb-36 flex flex-col justify-center items-center mx-auto text-center min-h-[80dvh]">
          <div className="animate-pulse space-y-6 w-full mt-8">
            <div className="h-3 w-16 bg-slate-200 dark:bg-white/5 rounded-full mx-auto" />
            <div className="h-8 w-48 bg-slate-200 dark:bg-white/5 rounded-full mx-auto" />
            <div className="h-24 bg-white/5 dark:bg-white/[0.02] border border-white/5 rounded-[24px]" />
            <div className="h-28 bg-white/5 dark:bg-white/[0.02] border border-white/5 rounded-[24px]" />
          </div>
        </div>
      );
    }

    // Show congratulations screen if user has completed the program
    if (activeProgram && isCompleted) {
      return (
        <div className="w-full max-w-md px-4 sm:px-6 safe-area-pt pb-36 space-y-6 flex flex-col mx-auto">
          <div className="space-y-1.5 mt-6 text-center">
            <h2 className="text-slate-500 dark:text-white/40 text-[10px] tracking-widest uppercase font-extrabold text-amber-500 dark:text-amber-400">🎉 Program Completed!</h2>
            <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight leading-tight">{activeProgram.title}</h1>
          </div>

          {/* Progress Container at 100% */}
          <div className="bg-white/5 dark:bg-white/[0.02] border border-white/5 rounded-[24px] p-6 text-center space-y-4">
            <div className="w-full bg-slate-200 dark:bg-white/5 rounded-full h-3 overflow-hidden shadow-inner">
              <motion.div 
                className="h-full bg-emerald-500 rounded-full origin-left" 
                initial={{ scaleX: 0 }} 
                animate={{ scaleX: 1 }} 
                transition={{ duration: 1, ease: 'easeOut' }} 
              />
            </div>
            <p className="text-slate-600 dark:text-white/80 font-bold text-sm">
              100% Complete <span className="text-slate-400 dark:text-white/30 font-normal">({completedCount}/{totalSessions})</span>
            </p>
          </div>

          {/* Congratulations Banner / Message */}
          <div className="bg-white/5 dark:bg-white/[0.02] border border-white/5 rounded-[24px] p-6 text-center space-y-3">
            <p className="text-sm text-slate-650 dark:text-white/80 leading-relaxed">
              Outstanding effort! You've successfully finished every workout in this program. Your consistency and dedication are paying off.
            </p>
          </div>

          <button 
            onClick={() => setActiveTab('programs')} 
            className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-sm transition-all"
          >
            Explore Other Programs
          </button>
        </div>
      );
    }

    if (!activeProgram || !upcomingSession) {
      return (
        <div className="w-full max-w-md px-4 sm:px-6 safe-area-pt pb-36 flex flex-col justify-center items-center mx-auto text-center space-y-6 min-h-[80dvh]">
          <div className="w-full bg-white/5 dark:bg-white/[0.02] border border-white/5 rounded-[24px] p-8 mt-8">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">No Active Program</h2>
            <p className="text-slate-600 dark:text-white/70 mb-6 text-sm">Head over to the Programs tab to pick a training plan and get started.</p>
            <button 
              onClick={() => setActiveTab('programs')} 
              className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-sm transition-all"
            >
              Browse Programs
            </button>
          </div>
        </div>
      );
    }

    const prog = apiProgress[activeProgramId!];
    const progressPercent = Math.round((completedCount / totalSessions) * 100) || 0;
    const totalSeconds = upcomingSession.interval_data.reduce((a, b) => a + b.duration, 0);
    const mins = Math.floor(totalSeconds / 60);

    return (
      <div className="w-full max-w-md px-4 sm:px-6 safe-area-pt pb-36 space-y-6 flex flex-col mx-auto">
        <div className="space-y-1.5 mt-6 text-center">
          <h2 className="text-slate-500 dark:text-white/40 text-[10px] tracking-widest uppercase font-extrabold">Up Next</h2>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight leading-tight">{activeProgram.title}</h1>
        </div>

        {/* Progress Container */}
        <div className="bg-white/5 dark:bg-white/[0.02] border border-white/5 rounded-[24px] p-6 text-center space-y-4">
          <div className="w-full bg-slate-200 dark:bg-white/5 rounded-full h-3 overflow-hidden shadow-inner">
            <motion.div 
              className="h-full bg-emerald-500 rounded-full origin-left" 
              initial={{ scaleX: 0 }} 
              animate={{ scaleX: completedCount / totalSessions }} 
              transition={{ duration: 1, ease: 'easeOut' }} 
            />
          </div>
          <p className="text-slate-600 dark:text-white/80 font-bold text-sm">
            {progressPercent}% Complete <span className="text-slate-400 dark:text-white/30 font-normal">({completedCount}/{totalSessions})</span>
          </p>
        </div>

        {/* Workout Details Container */}
        <div className="bg-white/5 dark:bg-white/[0.02] border border-white/5 rounded-[24px] p-5 space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="font-bold text-slate-400 dark:text-white/40 uppercase text-[10px] tracking-wider">Scheduled For</span>
            <span className="font-extrabold text-slate-800 dark:text-white">Week {upcomingSession.week_number}, Day {upcomingSession.session_number}</span>
          </div>
          <div className="h-[1px] bg-slate-100 dark:bg-white/5" />
          <div className="flex justify-between items-center text-sm">
            <span className="font-bold text-slate-400 dark:text-white/40 uppercase text-[10px] tracking-wider">Total Time</span>
            <span className="font-extrabold text-slate-800 dark:text-white">{mins} mins</span>
          </div>
        </div>

        <AnimatePresence>
          <motion.div 
            key={`slide-${prog?.current_week}-${prog?.current_session}`} 
            className="w-full mt-2" 
            exit={{ opacity: 0 }} 
            transition={{ duration: 0.3 }}
          >
            <SlideToStart className="mt-2" onStart={() => handleStartWorkout(upcomingSession, activeProgram)} resetDep={activeTab} />
          </motion.div>
        </AnimatePresence>
      </div>
    );
  };
  const renderPrograms = () => {
    if (viewingProgram) {
      const weeks = Array.from(new Set(programSessions.map(s => s.week_number)));
      return (
        <div className="w-full max-w-md px-4 sm:px-6 safe-area-pt pb-36 space-y-6 mx-auto flex flex-col">
          <button 
            onClick={() => setViewingProgram(null)} 
            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white font-bold mb-2 uppercase tracking-wider self-start"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight leading-tight">{viewingProgram.title}</h1>
            <p className="text-sm text-slate-650 dark:text-white/70 leading-relaxed">{viewingProgram.description}</p>
          </div>
          <div className="flex-1 space-y-6 mt-4">
            {weeks.map(week => (
              <div key={week} className="space-y-3">
                <h3 className="font-extrabold text-slate-400 dark:text-white/40 uppercase tracking-widest text-[10px] pl-1">Week {week}</h3>
                <div className="bg-white/5 dark:bg-white/[0.02] border border-white/5 rounded-[24px] divide-y divide-slate-150 dark:divide-white/5 overflow-hidden">
                  {programSessions.filter(s => s.week_number === week).map(session => {
                    const totalMins = Math.floor(session.interval_data.reduce((a, b) => a + b.duration, 0) / 60);
                    return (
                      <div 
                        key={session.id} 
                        className="p-5 flex flex-col gap-3 cursor-pointer hover:bg-white/[0.04] dark:hover:bg-white/[0.02] active:scale-[0.99] transition-all" 
                        onClick={() => handleStartWorkout(session, viewingProgram)}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Play className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500/20" />
                            <span className="font-bold text-sm text-slate-800 dark:text-white">Workout {session.session_number}</span>
                          </div>
                          <span className="text-slate-500 dark:text-white/50 text-xs font-bold">{totalMins} mins</span>
                        </div>
                        <IntervalPills intervals={session.interval_data} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="pt-4 pb-4">
            <button 
              onClick={() => handleSelectProgram(viewingProgram)} 
              className={cn(
                "w-full py-4 rounded-2xl font-bold text-sm shadow-sm transition-all",
                activeProgramId === viewingProgram.id
                  ? "bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white cursor-default"
                  : "bg-emerald-500 hover:bg-emerald-600 text-white"
              )}
            >
              {activeProgramId === viewingProgram.id ? 'Currently Active Program' : 'Start this Program'}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="w-full max-w-md px-4 sm:px-6 safe-area-pt pb-36 space-y-6 mx-auto flex flex-col">
        <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white mb-4 mt-6 tracking-tight">Programs</h1>
        <div className="flex flex-col gap-4">
          {programs.map(prog => {
            const isActive = activeProgramId === prog.id;
            const progStatus = apiProgress[prog.id];
            const completedCount = apiHistory.filter(h => h.program_id === prog.id).length;
            const progressPercent = Math.round((completedCount / prog.session_count) * 100) || 0;
            return (
              <div 
                key={prog.id} 
                className={cn(
                  "p-6 text-left relative overflow-hidden rounded-[28px] bg-white/5 dark:bg-white/[0.02] border transition-all cursor-pointer hover:bg-white/[0.08] dark:hover:bg-white/[0.04]",
                  isActive ? "border-emerald-500/20 dark:border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.05)]" : "border-white/5"
                )}
                onClick={() => handleViewProgram(prog)}
              >
                {isActive && (
                  <span className="absolute top-4 right-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Active
                  </span>
                )}
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2 pr-12">{prog.title}</h3>
                <p className="text-sm text-slate-650 dark:text-white/70 mb-4 leading-relaxed">{prog.description}</p>
                <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-white/5">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest">{prog.session_count} Sessions</span>
                  <button 
                    onClick={e => { e.stopPropagation(); handleSelectProgram(prog); }} 
                    className={cn(
                      "px-5 py-2 rounded-xl font-bold text-xs shadow-sm transition-all",
                      isActive 
                        ? "bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20"
                        : "bg-emerald-500 hover:bg-emerald-600 text-white"
                    )}
                  >
                    {isActive ? 'Continue' : 'Start'}
                  </button>
                </div>
                {isActive && progStatus && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-white/40 uppercase tracking-wider">
                      <span>Progress</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-white/5 rounded-full h-2 overflow-hidden">
                      <motion.div 
                        className="h-full bg-emerald-500 rounded-full origin-left" 
                        initial={{ scaleX: 0 }} 
                        animate={{ scaleX: completedCount / prog.session_count }} 
                        transition={{ duration: 0.8, ease: 'easeOut' }} 
                      />
                    </div>
                  </div>
                )}
              </div>
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
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    // Find the Monday of the week that was 3 weeks ago (to show 4 weeks total)
    const dayOfWeek = today.getDay();
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    const startDate = new Date(todayMidnight);
    startDate.setDate(todayMidnight.getDate() - daysSinceMonday - 21);
    
    const gridDays: Date[] = [];
    for (let i = 0; i < 28; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      gridDays.push(d);
    }

    const completedDates = new Set<string>();
    apiHistory.forEach(h => {
      completedDates.add(new Date(h.completed_at).toDateString());
    });

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
      <div className="w-full max-w-md px-4 sm:px-6 safe-area-pt pb-36 space-y-8 mx-auto flex flex-col">
        {/* Profile Header */}
        <div className="flex items-center gap-4">
          <label className="relative cursor-pointer group">
            <input type="file" accept="image/*" className="sr-only" onChange={handleAvatarChange} />
            <img
              src={avatarUrl ?? `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(user?.name ?? 'User')}&backgroundColor=1A202C`}
              alt="avatar"
              className="w-16 h-16 rounded-full border-2 border-white/20 shadow-md bg-white/5 object-cover"
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

        {/* Quick Stats Grid - Flat row with dividers */}
        <div className="flex justify-around py-4 border-y border-slate-100 dark:border-white/10">
          <div className="text-center flex-1">
            <span className="block text-2xl font-black text-slate-800 dark:text-white leading-none">{apiHistory.length}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/40 block mt-1.5">Workouts</span>
          </div>
          <div className="w-[1px] bg-slate-100 dark:bg-white/10 self-stretch animate-pulse" />
          <div className="text-center flex-1">
            <span className="block text-2xl font-black text-slate-800 dark:text-white leading-none">{totalRunMinutes}m</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/40 block mt-1.5">Run Time</span>
          </div>
          <div className="w-[1px] bg-slate-100 dark:bg-white/10 self-stretch animate-pulse" />
          <div className="text-center flex-1">
            <span className="block text-2xl font-black text-slate-800 dark:text-white leading-none">{totalActiveMinutes}m</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/40 block mt-1.5">Active</span>
          </div>
        </div>

        {/* Character Selection */}
        <div>
          <h2 className="text-xs font-bold text-slate-400 dark:text-white/40 uppercase tracking-widest mb-3">Your Character</h2>
          <div className="grid grid-cols-3 gap-3 bg-white/5 dark:bg-white/[0.02] p-2 rounded-[24px] border border-white/5">
            {CHARACTERS.map(char => {
              const isSelected = char.id === selectedCharacterId;
              return (
                <button
                  key={char.id}
                  onClick={() => setSelectedCharacter(char.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-2xl transition-all border",
                    isSelected 
                      ? 'bg-white/10 dark:bg-white/10 border-slate-900 dark:border-white/30 shadow-md scale-105' 
                      : 'border-transparent hover:bg-black/5 dark:hover:bg-white/[0.02]'
                  )}
                >
                  <div className="w-12 h-12 rounded-xl bg-white/10 dark:bg-black/20 flex items-center justify-center p-1.5 mb-1">
                    <div className="w-full h-full drop-shadow-md" style={{ filter: char.id === 'running-guy' ? 'brightness(0) invert(1)' : 'none' }}>
                      <DotLottieReact src={char.url} loop autoplay />
                    </div>
                  </div>
                  <span className={cn('text-[9px] font-bold text-center uppercase tracking-wider', isSelected ? 'text-slate-800 dark:text-white' : 'text-slate-500 dark:text-white/40')}>{char.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Consistency Calendar - Flat Widget */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xs font-bold text-slate-400 dark:text-white/40 uppercase tracking-widest">Consistency Calendar</h2>
            {currentStreak > 0 && (
              <span className="text-xs font-bold text-amber-500 dark:text-amber-400 flex items-center gap-1">
                🔥 {currentStreak} Day Streak
              </span>
            )}
          </div>
          
          <div className="bg-white/5 dark:bg-white/[0.02] p-4 sm:p-5 rounded-[24px] border border-white/5">
            {/* Weekday Labels (horizontal headers) */}
            <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-extrabold text-slate-400 dark:text-white/40 uppercase mb-2">
              <span>M</span>
              <span>T</span>
              <span>W</span>
              <span>T</span>
              <span>F</span>
              <span>S</span>
              <span>S</span>
            </div>
            
            {/* 4x7 Horizontal Grid */}
            <div className="grid grid-cols-7 gap-2">
              {gridDays.map((day, idx) => {
                const completed = completedDates.has(day.toDateString());
                const isToday = day.toDateString() === todayMidnight.toDateString();
                const isFuture = day > todayMidnight;
                const dateNum = day.getDate();
                return (
                  <div
                    key={idx}
                    title={`${day.toLocaleDateString('default', { month: 'short', day: 'numeric' })}`}
                    className={cn(
                      "aspect-square w-full rounded-full transition-all duration-300 flex items-center justify-center text-[11px] font-bold",
                      isFuture
                        ? "border border-dashed border-slate-300 dark:border-white/10 text-slate-500/20 dark:text-white/10 opacity-30 cursor-not-allowed"
                        : completed 
                          ? "bg-emerald-500 dark:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-105" 
                          : "bg-slate-200/50 dark:bg-white/5 text-slate-500 dark:text-white/40 hover:bg-slate-350 dark:hover:bg-white/10",
                      isToday && !completed && "border-2 border-indigo-500 dark:border-indigo-400 animate-pulse"
                    )}
                  >
                    {dateNum}
                  </div>
                );
              })}
            </div>

            {/* Stats below the calendar grid - Flat divider styling */}
            <div className="flex justify-around mt-5 pt-4 border-t border-slate-100 dark:border-white/5">
              <div className="text-center flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/40 mb-1">Active Days</span>
                <span className="text-base font-black text-slate-800 dark:text-white">
                  {completedDates.size}{" "}
                  <span className="text-xs font-semibold text-slate-400 dark:text-white/30">/ 28</span>
                </span>
              </div>
              <div className="w-[1px] bg-slate-100 dark:bg-white/5 self-stretch" />
              <div className="text-center flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/40 mb-1">Frequency</span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                  {Math.round((completedDates.size / 28) * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Workout History */}
        <div>
          <h2 className="text-xs font-bold text-slate-400 dark:text-white/40 uppercase tracking-widest mb-3">Workout History</h2>
          {apiHistory.length === 0 ? (
            <div className="py-8 text-center text-slate-500 dark:text-white/50 text-sm">No workouts completed yet. Let's get moving!</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {apiHistory.map(entry => {
                const date = new Date(entry.completed_at).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
                return (
                  <div key={entry.id} className="py-4 flex flex-col gap-2.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-white leading-tight">{entry.program_title}</p>
                        <p className="text-[11px] text-slate-500 dark:text-white/50 font-semibold mt-1">Week {entry.week_number}, Workout {entry.session_number} &bull; {date}</p>
                      </div>
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 text-base shadow-sm">
                        {entry.feedback === 'easy' ? '😌' : entry.feedback === 'perfect' ? '🔥' : '🥵'}
                      </div>
                    </div>
                    {entry.interval_data && entry.interval_data.length > 0 && (
                      <div className="mt-0.5">
                        <IntervalPills intervals={entry.interval_data} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sign Out */}
        <button 
          onClick={() => { logout(); showToast('Signed out.'); }} 
          className="flex items-center justify-center gap-2 w-full py-4 text-red-500 dark:text-red-400 hover:bg-red-500/10 rounded-2xl transition-colors border border-red-500/20 dark:border-red-500/10 bg-red-500/5 font-semibold text-sm mt-4 shadow-sm"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
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
