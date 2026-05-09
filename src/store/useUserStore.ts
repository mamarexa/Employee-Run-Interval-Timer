import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface WorkoutHistoryEntry {
  id: string;
  date: string;
  programId: string;
  week: number;
  session: number;
  feedback: string;
}

export interface Character {
  id: string;
  name: string;
  url: string;
}

export const CHARACTERS: Character[] = [
  { id: 'running-guy', name: 'Running Guy', url: 'https://lottie.host/1b2bf910-f5ba-44b4-89dc-9ee3029fd928/6fP85inKZ3.lottie' },
  { id: 'coffee-time', name: 'Coffee Time', url: 'https://lottie.host/687ae43c-9b29-413e-975d-def4a091690a/snVCbevoXT.lottie' },
  { id: 'mochi-running', name: 'Mochi', url: 'https://lottie.host/bdbd3fe3-eb9b-49af-a3fb-c7dc32414bb5/87ApMhtqev.lottie' },
  { id: 'baby-camel', name: 'Baby Camel', url: 'https://lottie.host/85e16e74-cba6-4930-ace9-0af279acd8d0/06UJFnVbc7.lottie' },
  { id: 'french-fries', name: 'French Fries', url: 'https://lottie.host/cab27d31-9c83-45aa-ab87-5e66d6cdd951/LIleWbDRsZ.lottie' }
];

interface UserState {
  activeProgramId: string | null;
  // Tracks the next session to do in a program. E.g. progress['starter'] = { week: 1, session: 1 }
  progress: Record<string, { week: number; session: number }>;
  history: WorkoutHistoryEntry[];
  selectedCharacterId: string;
  
  setActiveProgram: (id: string) => void;
  completeSession: (programId: string, week: number, session: number, feedback: string) => void;
  advanceProgress: (programId: string, nextWeek: number, nextSession: number) => void;
  resetProgress: (programId: string) => void;
  clearHistory: () => void;
  setSelectedCharacter: (id: string) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      activeProgramId: null,
      progress: {},
      history: [],
      selectedCharacterId: 'running-guy',

      setActiveProgram: (id) => set((state) => {
        // If the program hasn't been started, initialize it at week 1, session 1
        const newProgress = { ...state.progress };
        if (!newProgress[id]) {
          newProgress[id] = { week: 1, session: 1 };
        }
        return { activeProgramId: id, progress: newProgress };
      }),

      completeSession: (programId, week, session, feedback) => set((state) => {
        const newHistoryEntry: WorkoutHistoryEntry = {
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          programId,
          week,
          session,
          feedback,
        };

        return {
          history: [newHistoryEntry, ...state.history],
        };
      }),

      advanceProgress: (programId, nextWeek, nextSession) => set((state) => {
        const newProgress = { ...state.progress };
        newProgress[programId] = { week: nextWeek, session: nextSession };
        return { progress: newProgress };
      }),

      resetProgress: (programId) => set((state) => {
        const newProgress = { ...state.progress };
        newProgress[programId] = { week: 1, session: 1 };
        return { progress: newProgress };
      }),
      
      clearHistory: () => set({ history: [] }),
      
      setSelectedCharacter: (id: string) => set({ selectedCharacterId: id })
    }),
    {
      name: 'wellness-user-storage',
    }
  )
);
