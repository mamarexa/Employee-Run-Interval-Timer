import { create } from 'zustand';

export type IntervalType = 'warmup' | 'run' | 'walk' | 'cooldown';

export interface Interval {
  type: IntervalType;
  duration: number; // in seconds
}

export interface WorkoutSession {
  id: string;
  title: string;
  intervals: Interval[];
}

interface TimerState {
  session: WorkoutSession | null;
  currentIntervalIndex: number;
  timeRemaining: number; // display only — recomputed from timestamps
  isRunning: boolean;
  isFinished: boolean;
  /** Wall-clock ms when current interval (re)started — null when paused */
  intervalStartedAt: number | null;
  /** Accumulated ms elapsed before the last pause */
  elapsedBeforePause: number;

  loadSession: (session: WorkoutSession) => void;
  start: () => void;
  pause: () => void;
  tick: () => void;
  nextInterval: () => void;
  endWorkout: () => void;
  reset: () => void;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  session: null,
  currentIntervalIndex: 0,
  timeRemaining: 0,
  isRunning: false,
  isFinished: false,
  intervalStartedAt: null,
  elapsedBeforePause: 0,

  loadSession: (session) => set({
    session,
    currentIntervalIndex: 0,
    timeRemaining: session.intervals[0]?.duration || 0,
    isRunning: false,
    isFinished: false,
    intervalStartedAt: null,
    elapsedBeforePause: 0,
  }),

  // Called on Start tap (user gesture) — records wall-clock start time
  start: () => set({ isRunning: true, intervalStartedAt: Date.now() }),

  // Accumulate elapsed time before pausing
  pause: () => {
    const { intervalStartedAt, elapsedBeforePause } = get();
    const added = intervalStartedAt ? Date.now() - intervalStartedAt : 0;
    set({ isRunning: false, intervalStartedAt: null, elapsedBeforePause: elapsedBeforePause + added });
  },

  // Recomputes timeRemaining from real wall-clock — accurate even if called late
  tick: () => {
    const { isRunning, session, currentIntervalIndex, intervalStartedAt, elapsedBeforePause } = get();
    if (!isRunning || !session || !intervalStartedAt) return;
    const currentInterval = session.intervals[currentIntervalIndex];
    if (!currentInterval) return;
    const totalElapsedSec = Math.floor((elapsedBeforePause + (Date.now() - intervalStartedAt)) / 1000);
    const remaining = currentInterval.duration - totalElapsedSec;
    if (remaining <= 0) {
      get().nextInterval();
    } else {
      set({ timeRemaining: remaining });
    }
  },

  nextInterval: () => {
    const { currentIntervalIndex, session } = get();
    if (!session) return;
    const nextIndex = currentIntervalIndex + 1;
    if (nextIndex < session.intervals.length) {
      set({
        currentIntervalIndex: nextIndex,
        timeRemaining: session.intervals[nextIndex].duration,
        intervalStartedAt: Date.now(),
        elapsedBeforePause: 0,
      });
    } else {
      set({ isRunning: false, isFinished: true, intervalStartedAt: null, elapsedBeforePause: 0 });
    }
  },

  endWorkout: () => set({ isRunning: false, isFinished: true, intervalStartedAt: null }),

  reset: () => set({
    session: null,
    currentIntervalIndex: 0,
    timeRemaining: 0,
    isRunning: false,
    isFinished: false,
    intervalStartedAt: null,
    elapsedBeforePause: 0,
  }),
}));
