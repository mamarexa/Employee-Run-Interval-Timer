import { useEffect, useRef, useState } from 'react';
import { useTimerStore } from '../../store/useTimerStore';
import { Play, Pause, Square, SkipForward, Settings, X, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GlassCard } from '../ui/glass-card';
import { cn } from '../../lib/utils';

interface ActiveWorkoutTimerProps {
  onComplete?: (feedback: string) => void;
  onClose?: () => void;
}

export function ActiveWorkoutTimer({ onComplete, onClose }: ActiveWorkoutTimerProps) {
  const { session, currentIntervalIndex, timeRemaining, isRunning, isFinished, start, pause, tick, nextInterval: skipToNext } = useTimerStore();
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 400);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Sound and voice settings
  const [soundMode, setSoundMode] = useState<'both' | 'beeps' | 'voice' | 'mute'>(
    () => (localStorage.getItem('soundMode') as any) || 'both'
  );
  const [soundVolume, setSoundVolume] = useState<number>(
    () => {
      const val = localStorage.getItem('soundVolume');
      return val !== null ? Number(val) : 0.8;
    }
  );
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    localStorage.setItem('soundMode', soundMode);
  }, [soundMode]);

  useEffect(() => {
    localStorage.setItem('soundVolume', String(soundVolume));
  }, [soundVolume]);

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

  // Silent audio keeper — prevents iOS/Android AudioContext suspension by outputting sub-audible noise
  useEffect(() => {
    if (!isRunning || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    
    // Generate a buffer filled with sub-audible noise (amplitude 0.0001)
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const channelData = buf.getChannelData(0);
    for (let i = 0; i < channelData.length; i++) {
      channelData[i] = (Math.random() * 2 - 1) * 0.0001;
    }
    
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(ctx.destination);
    src.start();
    return () => { try { src.stop(); src.disconnect(); } catch { /* ignore */ } };
  }, [isRunning]);

  // Utterance player
  const speakCue = (text: string) => {
    if (soundMode === 'mute' || soundMode === 'beeps') return;
    try {
      window.speechSynthesis.cancel(); // Clears any stuck queues
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.15;
      u.volume = soundVolume;
      window.speechSynthesis.speak(u);
    } catch (e) {
      console.error('Speech synthesis error:', e);
    }
  };

  // Distinct music-piercing beeps
  const playChime = (type: 'run' | 'walk' | 'cooldown' | 'warmup') => {
    if (soundMode === 'mute' || soundMode === 'voice') return;
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    const playBeep = (freq: number, startOffset: number, duration: number, waveType: OscillatorType = 'triangle') => {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = waveType;
        osc.frequency.setValueAtTime(freq, now + startOffset);
        
        // Attack/Hold/Decay Envelope
        gain.gain.setValueAtTime(0.001, now + startOffset);
        gain.gain.linearRampToValueAtTime(soundVolume, now + startOffset + 0.02);
        gain.gain.setValueAtTime(soundVolume, now + startOffset + duration - 0.05);
        gain.gain.linearRampToValueAtTime(0.001, now + startOffset + duration);

        osc.start(now + startOffset);
        osc.stop(now + startOffset + duration);
      } catch (e) {
        console.error(e);
      }
    };

    if (type === 'run') {
      // 3 sharp, energetic chimes
      playBeep(880, 0, 0.15, 'triangle');
      playBeep(880, 0.2, 0.15, 'triangle');
      playBeep(1200, 0.4, 0.25, 'triangle');
    } else if (type === 'walk') {
      // 2 mellower, distinct chimes
      playBeep(554, 0, 0.2, 'triangle');
      playBeep(440, 0.25, 0.3, 'triangle');
    } else if (type === 'cooldown') {
      // Descending scale
      playBeep(660, 0, 0.15, 'triangle');
      playBeep(523, 0.2, 0.15, 'triangle');
      playBeep(440, 0.4, 0.4, 'triangle');
    } else if (type === 'warmup') {
      // Ascending scale
      playBeep(440, 0, 0.15, 'triangle');
      playBeep(523, 0.2, 0.15, 'triangle');
      playBeep(660, 0.4, 0.4, 'triangle');
    }
  };

  const handleTestAudio = () => {
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch { /* ignore */ }
    }
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    
    // Play test audio beeps
    if (soundMode === 'both' || soundMode === 'beeps') {
      const ctx = audioCtxRef.current!;
      const now = ctx.currentTime;
      const playBeep = (freq: number, startOffset: number, duration: number) => {
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + startOffset);
          gain.gain.setValueAtTime(0.001, now + startOffset);
          gain.gain.linearRampToValueAtTime(soundVolume, now + startOffset + 0.02);
          gain.gain.setValueAtTime(soundVolume, now + startOffset + duration - 0.05);
          gain.gain.linearRampToValueAtTime(0.001, now + startOffset + duration);
          osc.start(now + startOffset);
          osc.stop(now + startOffset + duration);
        } catch {}
      };
      playBeep(660, 0, 0.15);
      playBeep(880, 0.2, 0.25);
    }
    
    // Play test audio voice (delay slightly so it plays after the chimes)
    if (soundMode === 'both' || soundMode === 'voice') {
      setTimeout(() => {
        try {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance("Audio test successful");
          u.rate = 1.1;
          u.volume = soundVolume;
          window.speechSynthesis.speak(u);
        } catch {}
      }, soundMode === 'both' ? 550 : 0);
    }
  };

  // Audio & Haptics Cues Trigger
  useEffect(() => {
    if (!session || !isRunning || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const interval = session.intervals[currentIntervalIndex];
    if (!interval) return;

    // Play chimes
    playChime(interval.type);

    // Speak voice cues and trigger vibrations
    if (interval.type === 'run') {
      navigator.vibrate?.([200, 100, 200]);
      speakCue('Run!');
    } else if (interval.type === 'walk') {
      navigator.vibrate?.([100]);
      speakCue('Walk');
    } else if (interval.type === 'cooldown') {
      navigator.vibrate?.([50, 50, 50]);
      speakCue('Cool down');
    } else {
      navigator.vibrate?.([50, 50, 50]);
      speakCue('Warm up');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIntervalIndex]);

  if (!session) {
    return <div className="flex items-center justify-center h-full text-slate-500 font-medium">No session loaded</div>;
  }

  if (isFinished) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-8 p-6">
        <GlassCard className="w-full max-w-md p-8 text-center space-y-8 bg-white/40 dark:bg-black/20 border border-white/20 dark:border-white/5 shadow-xl">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Workout Complete!</h2>
            <p className="text-slate-600 dark:text-white/70 font-medium">How did that feel?</p>
          </div>
          <div className="flex justify-center gap-4">
            <button 
              onClick={() => onComplete?.('easy')}
              className="flex flex-col items-center p-4 bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/5 rounded-[24px] hover:bg-white/60 dark:hover:bg-white/10 transition-colors w-24"
            >
              <span className="text-4xl">😌</span>
              <span className="text-slate-700 dark:text-slate-200 mt-2 font-semibold">Easy</span>
            </button>
            <button 
              onClick={() => onComplete?.('perfect')}
              className="flex flex-col items-center p-4 bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/5 rounded-[24px] hover:bg-white/60 dark:hover:bg-white/10 transition-colors w-24"
            >
              <span className="text-4xl">🔥</span>
              <span className="text-slate-700 dark:text-slate-200 mt-2 font-semibold">Perfect</span>
            </button>
            <button 
              onClick={() => onComplete?.('hard')}
              className="flex flex-col items-center p-4 bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/5 rounded-[24px] hover:bg-white/60 dark:hover:bg-white/10 transition-colors w-24"
            >
              <span className="text-4xl">🥵</span>
              <span className="text-slate-700 dark:text-slate-200 mt-2 font-semibold">Hard</span>
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
      <div className="flex flex-col items-center space-y-4 mt-8 w-full relative">
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

      {/* Settings Button */}
      <button 
        onClick={() => setShowSettings(true)}
        className="absolute top-6 right-6 p-3 rounded-full bg-white/30 dark:bg-black/30 hover:bg-white/50 dark:hover:bg-black/50 text-slate-800 dark:text-white backdrop-blur-md transition-all z-40 shadow-sm border border-white/20"
        title="Audio Settings"
      >
        <Settings className="w-5 h-5" />
      </button>

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
            {isRunning ? "Pause" : "Start"}
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

      {/* Audio Settings Panel Overlay */}
      <AnimatePresence>
        {showSettings && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="fixed inset-0 bg-black/60 z-[150] backdrop-blur-sm"
            />
            {/* Slide-up Panel */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-50 dark:bg-slate-900 rounded-t-[32px] p-6 pb-12 z-[200] shadow-2xl border-t border-white/20 dark:border-white/5 text-slate-800 dark:text-white"
            >
              {/* Drag handle decoration */}
              <div className="w-12 h-1.5 bg-slate-300 dark:bg-white/20 rounded-full mx-auto mb-6" />

              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold tracking-tight">Audio Settings</h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-350 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Mode Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-white/40">Sound Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['both', 'beeps', 'voice', 'mute'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setSoundMode(mode)}
                        className={cn(
                          "py-3 px-4 rounded-xl border text-xs font-bold uppercase tracking-wide transition-all",
                          soundMode === mode
                            ? "bg-slate-900 dark:bg-white border-slate-900 dark:border-white text-white dark:text-slate-900 shadow-md"
                            : "border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-slate-600 dark:text-slate-305"
                        )}
                      >
                        {mode === 'both' ? 'Voice + Beeps' :
                         mode === 'beeps' ? 'Beeps Only' :
                         mode === 'voice' ? 'Voice Only' : 'Muted'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Volume Slider */}
                {soundMode !== 'mute' && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-white/40">Volume</label>
                      <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{Math.round(soundVolume * 100)}%</span>
                    </div>
                    <div className="flex items-center gap-3 bg-white/40 dark:bg-black/10 p-3 rounded-2xl border border-white/20 dark:border-white/5">
                      {soundVolume === 0 ? <VolumeX className="w-5 h-5 text-slate-500" /> : <Volume2 className="w-5 h-5 text-slate-500" />}
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={soundVolume}
                        onChange={(e) => setSoundVolume(Number(e.target.value))}
                        className="flex-1 accent-slate-800 dark:accent-white h-1.5 bg-slate-250 dark:bg-white/15 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                {/* Test Audio Button */}
                <div className="pt-2">
                  <button
                    onClick={handleTestAudio}
                    className="w-full py-4 rounded-full border border-slate-300 dark:border-white/10 bg-white/40 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-slate-800 dark:text-white font-bold text-sm transition-all shadow-sm"
                  >
                    🔊 Test Audio Cues
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
