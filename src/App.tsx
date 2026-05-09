import { useState, useMemo, useEffect, useCallback } from 'react';
import { Routes, Route, useSearchParams, useNavigate } from 'react-router-dom';
import { ActiveWorkoutTimer } from './components/timer/ActiveWorkoutTimer';
import { useTimerStore, WorkoutSession } from './store/useTimerStore';
import { useUserStore } from './store/useUserStore';
import { useAuthStore } from './store/useAuthStore';
import { api, verifyPass, silentRefresh } from './lib/api';
import { GlassCard } from './components/ui/glass-card';
import { BottomNav } from './components/ui/bottom-nav';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Settings, LogOut, ChevronLeft } from 'lucide-react';
import { SlideToStart } from './components/ui/slide-to-start';
import { CHARACTERS } from './store/useUserStore';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { cn } from './lib/utils';
import AuthVerify from './pages/AuthVerify';
import AdminLogin from './pages/AdminLogin';
import Admin from './pages/Admin';

// â”€â”€â”€ Types mirroring API responses â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface ApiProgram {
  id: number;
  slug: string;
  title: string;
  description: string;
  session_count: number;
}

interface IntervalData {
  type: 'run' | 'walk' | 'warmup' | 'cooldown';
  duration: number; // seconds
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
  program_id: number;
  week_number: number;
  session_number: number;
  completed_at: string;
  feedback: string;
  program_title: string;
}

// â”€â”€â”€ Interval grouping (Phase 8b) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface GroupedInterval {
  type: IntervalData['type'];
  totalDuration: number;
  count: number;
}

function groupIntervals(intervals: IntervalData[]): GroupedInterval[] {
  const groups: GroupedInterval[] = [];
  for (const inv of intervals) {
    const last = groups[groups.length - 1];
    if (last && last.type === inv.type) {
      last.totalDuration += inv.duration;
      last.count += 1;
    } else {
      groups.push({ type: inv.type, totalDuration: inv.duration, count: 1 });
    }
  }
  return groups;
}

function IntervalPills({ intervals }: { intervals: IntervalData[] }) {
  const groups = groupIntervals(intervals);
  return (
    <div className="flex gap-1.5 flex-wrap">
      {groups.map((g, idx) => (
        <span key={idx} className={cn(
          'text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md',
          g.type === 'run' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' :
          g.type === 'walk' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' :
          'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300'
        )}>
          {Math.round(g.totalDuration / 60)}m {g.type}
        </span>
      ))}
    </div>
  );
}

// â”€â”€â”€ AuthGate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function AuthGate({ children }: { children: React.ReactNode }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { pass, token, setAuth, setToken } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'ok' | 'locked'>('loading');

  useEffect(() => {
    const urlPass = searchParams.get('pass');
    (async () => {
      // 1. magic link in URL â†’ verify
      if (urlPass) {
        try {
          const data = await verifyPass(urlPass);
          setAuth(urlPass, data.token, data.user);
          navigate('/', { replace: true });
          setStatus('ok');
          return;
        } catch {
          setStatus('locked');
          return;
        }
      }
      // 2. existing JWT valid â†’ proceed
      if (token) {
        try {
          await api.get('/api/auth/me');
          setStatus('ok');
          return;
        } catch { /* fall through to silent refresh */ }
      }
      // 3. stored pass â†’ silent refresh
      if (pass) {
        try {
          const newToken = await silentRefresh(pass);
          setToken(newToken);
          setStatus('ok');
          return;
        } catch { /* fall through */ }
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
  if (status === 'locked') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] p-8 text-center gap-6">
        <GlassCard className="p-8 max-w-sm w-full space-y-4">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Access Required</h1>
          <p className="text-slate-600 dark:text-white/70">Your session has expired. Please use your personal invite link or ask your admin to send a new one.</p>
        </GlassCard>
      </div>
    );
  }
  return <>{children}</>;
}

// â”€â”€â”€ MainApp â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function MainApp() {
  const [activeTab, setActiveTab] = useState<'home' | 'programs' | 'profile'>('home');
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [viewingProgram, setViewingProgram] = useState<ApiProgram | null>(null);
  const [programSessions, setProgramSessions] = useState<ApiSession[]>([]);
  const [activeSessionInfo, setActiveSessionInfo] = useState<{ programId: number; week: number; sessionNum: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [programs, setPrograms] = useState<ApiProgram[]>([]);
  const [apiHistory, setApiHistory] = useState<HistoryEntry[]>([]);
  const [apiProgress, setApiProgress] = useState<Record<number, { current_week: number; current_session: number }>>({});
  const [activeProgramId, setActiveProgramId] = useState<number | null>(null);
  const [upcomingSession, setUpcomingSession] = useState<ApiSession | null>(null);

  const { user, logout } = useAuthStore();
  const { selectedCharacterId, setSelectedCharacter } = useUserStore();

  const loadSession = useTimerStore(s => s.loadSession);
  const resetTimer = useTimerStore(s => s.reset);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // Load programs + user data on mount
  useEffect(() => {
    api.get<ApiProgram[]>('/api/programs').then(setPrograms).catch(console.error);
    api.get<{ active_program_id: number | null }>('/api/auth/me').then(d => {
      if (d.active_program_id) setActiveProgramId(d.active_program_id);
    }).catch(console.error);
    api.get<HistoryEntry[]>('/api/me/history').then(setApiHistory).catch(console.error);
    api.get<{ program_id: number; current_week: number; current_session: number }[]>('/api/me/progress').then(rows => {
      const map: Record<number, { current_week: number; current_session: number }> = {};
      rows.forEach(r => { map[r.program_id] = { current_week: r.current_week, current_session: r.current_session }; });
      setApiProgress(map);
    }).catch(console.error);
  }, []);

  // Load upcoming session whenever activeProgramId or progress changes
  useEffect(() => {
    if (!activeProgramId) { setUpcomingSession(null); return; }
    const prog = apiProgress[activeProgramId];
    const week = prog?.current_week ?? 1;
    const session = prog?.current_session ?? 1;
    api.get<ApiSession[]>(`/api/programs/${activeProgramId}/sessions`).then(sessions => {
      const found = sessions.find(s => s.week_number === week && s.session_number === session);
      setUpcomingSession(found ?? sessions[0] ?? null);
    }).catch(console.error);
  }, [activeProgramId, apiProgress]);

  const handleStartWorkout = (sess: ApiSession, program: ApiProgram) => {
    loadSession({
      id: String(sess.id),
      title: `${program.title} â€“ ${sess.title}`,
      intervals: sess.interval_data.map(i => ({ type: i.type as WorkoutSession['intervals'][number]['type'], duration: i.duration })),
    });
    setActiveSessionInfo({ programId: program.id, week: sess.week_number, sessionNum: sess.session_number });
    setIsTimerActive(true);
  };

  const handleCompleteWorkout = useCallback(async (feedback: string) => {
    if (activeSessionInfo) {
      const { programId, week, sessionNum } = activeSessionInfo;
      try {
        await api.post('/api/me/history', { program_id: programId, week_number: week, session_number: sessionNum, feedback });
        // Advance progress
        const sessions = await api.get<ApiSession[]>(`/api/programs/${programId}/sessions`);
        const curIdx = sessions.findIndex(s => s.week_number === week && s.session_number === sessionNum);
        const next = sessions[curIdx + 1];
        if (next) {
          await api.post('/api/me/progress', { program_id: programId, current_week: next.week_number, current_session: next.session_number });
          setApiProgress(p => ({ ...p, [programId]: { current_week: next.week_number, current_session: next.session_number } }));
        }
        const history = await api.get<HistoryEntry[]>('/api/me/history');
        setApiHistory(history);
      } catch (e) { console.error(e); }
    }
    setActiveSessionInfo(null);
    resetTimer();
    setIsTimerActive(false);
    setToast('Workout complete! ðŸŽ‰');
    setTimeout(() => setToast(null), 3000);
  }, [activeSessionInfo, resetTimer]);

  const handleCloseTimer = () => { setActiveSessionInfo(null); resetTimer(); setIsTimerActive(false); };

  const handleSelectProgram = async (prog: ApiProgram) => {
    await api.patch('/api/me', { active_program_id: prog.id }).catch(console.error);
    setActiveProgramId(prog.id);
    setActiveTab('home');
    setViewingProgram(null);
  };

  const handleViewProgram = async (prog: ApiProgram) => {
    const sessions = await api.get<ApiSession[]>(`/api/programs/${prog.id}/sessions`).catch(() => [] as ApiSession[]);
    setProgramSessions(sessions);
    setViewingProgram(prog);
  };

  // â”€â”€ Home view â”€â”€
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
      <div className="w-full max-w-sm px-6 pt-12 pb-32 space-y-6 flex flex-col mx-auto">
        <GlassCard className="p-8 text-center space-y-8 flex flex-col items-center">
          <div className="space-y-2 w-full">
            <h2 className="text-slate-500 dark:text-white/60 text-xs tracking-widest uppercase font-semibold">Up Next</h2>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight leading-tight mb-4">{activeProgram.title}</h1>
            <div className="w-full bg-white/40 dark:bg-black/20 rounded-full h-3 mb-2 overflow-hidden shadow-inner">
              <motion.div className="h-full bg-slate-900 dark:bg-white rounded-full origin-left" initial={{ scaleX: 0 }} animate={{ scaleX: completedCount / totalSessions }} transition={{ duration: 1, ease: 'easeOut' }} />
            </div>
            <p className="text-slate-600 dark:text-white/80 font-semibold text-sm">{progressPercent}% Complete <span className="text-slate-400 font-normal">({completedCount}/{totalSessions})</span></p>
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

  // â”€â”€ Programs view â”€â”€
  const renderPrograms = () => {
    if (viewingProgram) {
      const weeks = Array.from(new Set(programSessions.map(s => s.week_number)));
      return (
        <div className="w-full max-w-md px-6 pt-12 pb-32 space-y-6 mx-auto overflow-y-auto min-h-[100dvh] no-scrollbar flex flex-col">
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
      <div className="w-full max-w-md px-6 pt-12 pb-32 space-y-6 mx-auto overflow-y-auto min-h-[100dvh] no-scrollbar">
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

  // â”€â”€ Profile view â”€â”€
  const renderProfile = () => (
    <div className="w-full max-w-md px-6 pt-12 pb-32 space-y-6 mx-auto overflow-y-auto min-h-[100dvh] no-scrollbar">
      <div className="flex items-center gap-4 mb-8">
        <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(user?.name ?? 'User')}&backgroundColor=E0F7FA`} alt="avatar" className="w-16 h-16 rounded-full border-2 border-white shadow-md bg-white/50" />
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">{user?.name ?? 'Runner'}</h1>
        </div>
      </div>
      <GlassCard className="p-2 mb-8">
        <button onClick={() => { logout(); showToast('Signed out.'); }} className="flex items-center gap-3 w-full p-4 text-left hover:bg-white/20 rounded-2xl transition-colors text-red-500">
          <LogOut className="w-5 h-5" />
          <span className="font-semibold flex-1">Sign Out</span>
        </button>
        <button onClick={() => showToast('Use the admin panel to manage user data.')} className="flex items-center gap-3 w-full p-4 text-left hover:bg-white/20 rounded-2xl transition-colors text-slate-700 dark:text-white">
          <Settings className="w-5 h-5 text-slate-500" />
          <span className="font-semibold flex-1">Preferences</span>
        </button>
      </GlassCard>

      <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4 tracking-tight">Your Character</h2>
      <GlassCard className="p-4 mb-8">
        <div className="grid grid-cols-3 gap-3">
          {CHARACTERS.map(char => {
            const isSelected = char.id === selectedCharacterId;
            return (
              <button key={char.id} onClick={() => setSelectedCharacter(char.id)} className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all border-2 ${isSelected ? 'bg-slate-900/5 dark:bg-white/10 border-slate-900 dark:border-white' : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}>
                <div className="w-16 h-16 rounded-xl bg-white/40 dark:bg-black/20 flex items-center justify-center p-2 mb-1">
                  <div className="w-full h-full drop-shadow-md" style={{ filter: char.id === 'running-guy' ? 'brightness(0) invert(1)' : 'none' }}>
                    <DotLottieReact src={char.url} loop autoplay />
                  </div>
                </div>
                <span className={`text-[10px] font-bold text-center uppercase tracking-wider ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-white/60'}`}>{char.name}</span>
              </button>
            );
          })}
        </div>
      </GlassCard>

      <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4 tracking-tight">Workout History</h2>
      {apiHistory.length === 0 ? (
        <GlassCard className="p-8 text-center text-slate-600 dark:text-white/70">No workouts completed yet. Let's get moving!</GlassCard>
      ) : (
        <div className="flex flex-col gap-4">
          {apiHistory.map(entry => {
            const date = new Date(entry.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            return (
              <GlassCard key={entry.id} className="p-5 flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-white">{entry.program_title}</p>
                  <p className="text-xs text-slate-500 dark:text-white/60 font-medium">W{entry.week_number} S{entry.session_number} â€¢ {date}</p>
                </div>
                <div className="text-2xl">{entry.feedback === 'easy' ? 'ðŸ˜Œ' : entry.feedback === 'perfect' ? 'ðŸ”¥' : 'ðŸ¥µ'}</div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );

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

// â”€â”€â”€ Root App with Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function App() {
  return (
    <Routes>
      <Route path="/auth/verify" element={<AuthVerify />} />
      <Route path="/admin" element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={<Admin />} />
      <Route path="/*" element={<AuthGate><MainApp /></AuthGate>} />
    </Routes>
  );
}
  
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
export default function App() {
  return (
    <Routes>
      <Route path="/auth/verify" element={<AuthVerify />} />
      <Route path="/admin" element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={<Admin />} />
      <Route path="/*" element={<AuthGate><MainApp /></AuthGate>} />
    </Routes>
  );
}
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
export default function App() {
  return (
    <Routes>
      <Route path="/auth/verify" element={<AuthVerify />} />
      <Route path="/admin" element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={<Admin />} />
      <Route path="/*" element={<AuthGate><MainApp /></AuthGate>} />
    </Routes>
  );
}
