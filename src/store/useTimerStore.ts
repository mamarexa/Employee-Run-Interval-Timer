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
  timeRemaining: number; // in seconds
  isRunning: boolean;
  isFinished: boolean;
  
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

  loadSession: (session) => set({
    session,
    currentIntervalIndex: 0,
    timeRemaining: session.intervals[0]?.duration || 0,
    isRunning: false,
    isFinished: false
  }),

  start: () => set({ isRunning: true }),
  
  pause: () => set({ isRunning: false }),
  
  tick: () => {
    const { timeRemaining, session, isRunning } = get();
    if (!isRunning || !session) return;

    if (timeRemaining > 0) {
      set({ timeRemaining: timeRemaining - 1 });
    } else {
      get().nextInterval();
    }
  },

  nextInterval: () => {
    const { currentIntervalIndex, session } = get();
    if (!session) return;

    const nextIndex = currentIntervalIndex + 1;
    if (nextIndex < session.intervals.length) {
      set({
        currentIntervalIndex: nextIndex,
        timeRemaining: session.intervals[nextIndex].duration
      });
    } else {
      set({ isRunning: false, isFinished: true });
    }
  },

  endWorkout: () => set({ isRunning: false, isFinished: true }),
  
  reset: () => set({
    session: null,
    currentIntervalIndex: 0,
    timeRemaining: 0,
    isRunning: false,
    isFinished: false
  })
}));
