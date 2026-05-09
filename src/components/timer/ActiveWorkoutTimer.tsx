import { useEffect, useRef, useState } from 'react';
import { useTimerStore } from '../../store/useTimerStore';
import { Play, Pause, Square, SkipForward } from 'lucide-react';
import { motion } from 'motion/react';
import { GlassCard } from '../ui/glass-card';
import { cn } from '../../lib/utils';

interface ActiveWorkoutTimerProps {
  onComplete?: (feedback: string) => void;
  onClose?: () => void;
}

export function ActiveWorkoutTimer({ onComplete, onClose }: ActiveWorkoutTimerProps) {
  const { session, currentIntervalIndex, timeRemaining, isRunning, isFinished, start, pause, tick, endWorkout, nextInterval: skipToNext } = useTimerStore();
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 400);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Acquire Wake Lock when running — keeps screen on so JS and audio run at full speed
  useEffect(() => {
    if (!isRunning) {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      return;
    }
    const acquire = async () => {
      try {
        wakeLockRef.current = await navigator.wakeLock?.request('screen');
      } catch { /* not supported or denied */ }
    };
    acquire();
    // Re-acquire after visibility change (iOS releases wake lock on visibility change)
    const reacquire = () => {
      if (document.visibilityState === 'visible' && isRunning) acquire();
    };
    document.addEventListener('visibilitychange', reacquire);
    return () => {
      document.removeEventListener('visibilitychange', reacquire);
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [isRunning]);

  // Create/unlock shared AudioContext on first Start tap (requires user gesture)
  const handleStart = () => {
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch { /* ignore */ }
    }
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    start();
  };

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Timer interval — 250ms so it catches up quickly after screen-off throttling
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRunning) {
      interval = setInterval(() => {
        tick();
      }, 250);
    }
    return () => clearInterval(interval);
  }, [isRunning, tick]);

  // Catch-up: when app returns to foreground, immediately re-sync the timer
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        useTimerStore.getState().tick();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Silent audio keeper — prevents iOS AudioContext suspension
  useEffect(() => {
    if (!isRunning || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(ctx.destination);
    src.start();
    return () => { try { src.stop(); src.disconnect(); } catch { /* ignore */ } };
  }, [isRunning]);

  // Audio & Haptics — fire on interval START using shared AudioContext
  useEffect(() => {
    if (!session || !isRunning || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const interval = session.intervals[currentIntervalIndex];
    if (!interval) return;
    const now = ctx.currentTime;
    const play = (freq: number, startOffset: number, duration: number) => {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + startOffset);
        gain.gain.setValueAtTime(0.7, now + startOffset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
        osc.start(now + startOffset);
        osc.stop(now + startOffset + duration);
      } catch { /* ignore */ }
    };
    if (interval.type === 'run') {
      play(880, 0, 0.15);
      play(880, 0.2, 0.15);
      navigator.vibrate?.([200, 100, 200]);
      try { const u = new SpeechSynthesisUtterance('Run!'); u.rate = 1.2; speechSynthesis.speak(u); } catch { /* ignore */ }
    } else if (interval.type === 'walk') {
      play(440, 0, 0.25);
      navigator.vibrate?.([100]);
      try { const u = new SpeechSynthesisUtterance('Walk'); u.rate = 1.2; speechSynthesis.speak(u); } catch { /* ignore */ }
    } else if (interval.type === 'cooldown') {
      play(660, 0, 0.1);
      play(660, 0.15, 0.1);
      play(660, 0.3, 0.1);
      navigator.vibrate?.([50, 50, 50]);
      try { const u = new SpeechSynthesisUtterance('Cool down'); u.rate = 1.2; speechSynthesis.speak(u); } catch { /* ignore */ }
    } else {
      play(660, 0, 0.1);
      play(660, 0.15, 0.1);
      navigator.vibrate?.([50, 50, 50]);
      try { const u = new SpeechSynthesisUtterance('Warm up'); u.rate = 1.2; speechSynthesis.speak(u); } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIntervalIndex]);

  if (!session) {
    return <div className="flex items-center justify-center h-full text-slate-500 font-medium">No session loaded</div>;
  }

  if (isFinished) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-8 p-6">
        <GlassCard className="w-full max-w-md p-8 text-center space-y-8 bg-white/40">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Workout Complete!</h2>
            <p className="text-slate-600 font-medium">How did that feel?</p>
          </div>
          <div className="flex justify-center gap-4">
            <button 
              onClick={() => onComplete?.('easy')}
              className="flex flex-col items-center p-4 bg-white/40 rounded-[24px] hover:bg-white/60 transition-colors w-24"
            >
              <span className="text-4xl">😌</span>
              <span className="text-slate-700 mt-2 font-semibold">Easy</span>
            </button>
            <button 
              onClick={() => onComplete?.('perfect')}
              className="flex flex-col items-center p-4 bg-white/40 rounded-[24px] hover:bg-white/60 transition-colors w-24"
            >
              <span className="text-4xl">🔥</span>
              <span className="text-slate-700 mt-2 font-semibold">Perfect</span>
            </button>
            <button 
              onClick={() => onComplete?.('hard')}
              className="flex flex-col items-center p-4 bg-white/40 rounded-[24px] hover:bg-white/60 transition-colors w-24"
            >
              <span className="text-4xl">🥵</span>
              <span className="text-slate-700 mt-2 font-semibold">Hard</span>
            </button>
          </div>
        </GlassCard>
      </div>
    );
  }

  const currentInterval = session.intervals[currentIntervalIndex];
  const nextInterval = session.intervals[currentIntervalIndex + 1];

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const ringRadius = Math.min(windowWidth * 0.38, 150);
  const strokeWidth = 6;
  const normalizedRadius = ringRadius - strokeWidth * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (timeRemaining / currentInterval.duration) * circumference;

  const getIntervalColor = (type: string) => {
    switch (type) {
      case 'warmup': return 'text-amber-500 dark:text-amber-300';
      case 'run': return 'text-emerald-500 dark:text-emerald-400';
      case 'walk': return 'text-blue-500 dark:text-blue-300';
      case 'cooldown': return 'text-indigo-500 dark:text-indigo-300';
      default: return 'text-slate-700 dark:text-white';
    }
  };
  
  const getStrokeColor = (type: string) => {
    switch (type) {
      case 'warmup': return '#f59e0b'; // amber-500
      case 'run': return '#10b981'; // emerald-500
      case 'walk': return '#3b82f6'; // blue-500
      case 'cooldown': return '#6366f1'; // indigo-500
      default: return '#1e293b'; // slate-800
    }
  };

  return (
    <div className="flex flex-col items-center justify-between h-full safe-area-pt safe-area-pb px-6 w-full relative">

      {/* Header */}
      <div className="flex flex-col items-center space-y-4 mt-8 w-full">
        <h1 className="text-slate-800 dark:text-white font-medium tracking-[2px] uppercase text-[12px] opacity-80">{session.title}</h1>
        <div className="flex space-x-2 w-full max-w-xs justify-center bg-black/5 dark:bg-white/5 p-2 rounded-full">
          {session.intervals.map((_, i) => (
            <div 
              key={i} 
              className={cn(
                "h-2.5 rounded-full transition-all duration-300",
                i === currentIntervalIndex ? "bg-slate-800 dark:bg-white w-8 shadow-sm" : 
                i < currentIntervalIndex ? "bg-slate-800/80 dark:bg-white/80 w-3" : "bg-slate-300 dark:bg-slate-700 w-3"
              )}
            />
          ))}
        </div>
      </div>

      {/* Timer Circle */}
      <div className="relative flex items-center justify-center my-8 flex-1 w-full max-h-[360px]">
        <svg
          height={ringRadius * 2}
          width={ringRadius * 2}
          className="transform -rotate-90 absolute"
          style={{ filter: "drop-shadow(0px 10px 20px rgba(0,0,0,0.15))" }}
        >
          {/* Background Ring */}
          <circle
            stroke="rgba(0,0,0,0.05)"
            fill="transparent"
            strokeWidth={strokeWidth}
            r={normalizedRadius}
            cx={ringRadius}
            cy={ringRadius}
            className="transition-all duration-300 ease-in-out dark:stroke-white/10"
          />
          {/* Progress Ring */}
          <circle
            stroke={getStrokeColor(currentInterval.type)}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ strokeDashoffset }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={ringRadius}
            cy={ringRadius}
            className={cn(
              "transition-all duration-1000 ease-linear"
            )}
          />
        </svg>

        <div className="absolute flex flex-col items-center justify-center inset-0 pointer-events-none">
          <motion.div
            key={currentInterval.type + currentIntervalIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("text-xl font-medium uppercase tracking-[0.2em] mb-2", getIntervalColor(currentInterval.type))}
          >
            {currentInterval.type}
          </motion.div>
          <motion.div 
            key={timeRemaining}
            initial={{ opacity: 0.8, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="text-[6rem] sm:text-[7rem] leading-none font-light text-slate-800 dark:text-white tracking-tight"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {formatTime(timeRemaining)}
          </motion.div>
        </div>
      </div>

      {/* Next Interval Info */}
      <div className="h-16 flex items-center justify-center mb-8">
        {nextInterval ? (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="flex items-center space-x-2 text-slate-700 dark:text-white/90 bg-white/40 dark:bg-black/20 px-6 py-2 rounded-full backdrop-blur-md border border-white/40 dark:border-white/10 shadow-sm"
          >
            <span className="text-sm font-medium">Next: {formatTime(nextInterval.duration)} {nextInterval.type}</span>
          </motion.div>
        ) : (
          <div className="flex items-center space-x-2 text-slate-700 dark:text-white/90 bg-white/40 dark:bg-black/20 px-6 py-2 rounded-full backdrop-blur-md border border-white/40 dark:border-white/10 shadow-sm">
             <span className="text-sm font-medium">Final Interval</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="pb-12 w-full max-w-sm flex justify-center">
        <GlassCard className="flex items-center justify-between gap-4 px-6 py-4 rounded-[99px] bg-white/40 dark:bg-black/20 border border-white/40 dark:border-white/5 shadow-lg w-full">
          <button 
            title="Cancel Workout"
            onClick={onClose}
            className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors shrink-0"
          >
            <Square className="w-5 h-5 fill-current" />
          </button>
          
          <button 
            onClick={isRunning ? pause : handleStart}
            className="flex-1 py-4 h-14 rounded-full bg-slate-800 dark:bg-white text-white dark:text-slate-900 font-medium tracking-wide text-sm shadow-[0_8px_16px_rgba(0,0,0,0.1)] active:scale-95 transition-transform flex items-center justify-center"
          >
            {isRunning ? (
               "Pause"
            ) : (
               "Start"
            )}
          </button>

          {(currentInterval.type === 'warmup' || currentInterval.type === 'cooldown') ? (
            <button 
              title="Skip"
              onClick={skipToNext}
              className="w-14 h-14 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-slate-700 dark:text-white hover:bg-black/10 dark:hover:bg-white/20 transition-colors shrink-0"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-14 h-14 shrink-0 pointer-events-none" />
          )}
        </GlassCard>
      </div>
    </div>
  );
}
