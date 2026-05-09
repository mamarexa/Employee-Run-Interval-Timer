import { Interval } from '../store/useTimerStore';

export interface WorkoutSessionDef {
  week: number;
  session: number;
  title: string;
  intervals: Interval[];
}

export interface Program {
  id: string;
  title: string;
  description: string;
  sessions: WorkoutSessionDef[];
}

const runWalk = (runMins: number, walkMins: number, repeats: number): Interval[] => {
  const res: Interval[] = [];
  for (let i = 0; i < repeats; i++) {
    res.push({ type: 'run', duration: runMins * 60 });
    res.push({ type: 'walk', duration: walkMins * 60 });
  }
  return res;
};

const runContinuous = (runMins: number): Interval[] => {
  return [{ type: 'run', duration: runMins * 60 }];
};

const withWarmupCooldown = (core: Interval[], warmupMins = 5, cooldownMins = 5): Interval[] => {
  return [
    { type: 'warmup', duration: warmupMins * 60 },
    ...core,
    { type: 'cooldown', duration: cooldownMins * 60 }
  ];
};

function generateStarterProgram(): Program {
  const sessions: WorkoutSessionDef[] = [];
  
  // Week 1
  sessions.push({ week: 1, session: 1, title: "W1D1", intervals: withWarmupCooldown(runWalk(1, 1, 3)) });
  sessions.push({ week: 1, session: 2, title: "W1D2", intervals: withWarmupCooldown(runWalk(1, 1, 4)) });
  sessions.push({ week: 1, session: 3, title: "W1D3", intervals: withWarmupCooldown(runWalk(1, 1, 5)) });
  sessions.push({ week: 1, session: 4, title: "W1D4", intervals: withWarmupCooldown(runWalk(1, 1, 6)) });
  sessions.push({ week: 1, session: 5, title: "W1D5", intervals: withWarmupCooldown(runWalk(1, 1, 7)) });

  // Week 2
  sessions.push({ week: 2, session: 1, title: "W2D1", intervals: withWarmupCooldown(runWalk(1, 1, 8)) });
  sessions.push({ week: 2, session: 2, title: "W2D2", intervals: withWarmupCooldown(runWalk(1, 1, 9)) });
  sessions.push({ week: 2, session: 3, title: "W2D3", intervals: withWarmupCooldown(runWalk(1, 1, 10)) });
  sessions.push({ week: 2, session: 4, title: "W2D4", intervals: withWarmupCooldown(runWalk(1, 1, 11)) });
  sessions.push({ week: 2, session: 5, title: "W2D5", intervals: withWarmupCooldown(runWalk(1, 1, 12)) });

  // Week 3
  sessions.push({ week: 3, session: 1, title: "W3D1", intervals: withWarmupCooldown(runWalk(1, 1, 13)) });
  sessions.push({ week: 3, session: 2, title: "W3D2", intervals: withWarmupCooldown(runWalk(1, 1, 14)) });
  sessions.push({ week: 3, session: 3, title: "W3D3", intervals: withWarmupCooldown(runWalk(1, 1, 15)) });
  sessions.push({ week: 3, session: 4, title: "W3D4", intervals: withWarmupCooldown(runWalk(2, 1, 3)) });
  sessions.push({ week: 3, session: 5, title: "W3D5", intervals: withWarmupCooldown(runWalk(2, 1, 4)) });

  // Week 4
  sessions.push({ week: 4, session: 1, title: "W4D1", intervals: withWarmupCooldown(runWalk(2, 1, 5)) });
  sessions.push({ week: 4, session: 2, title: "W4D2", intervals: withWarmupCooldown(runWalk(2, 1, 6)) });
  sessions.push({ week: 4, session: 3, title: "W4D3", intervals: withWarmupCooldown(runWalk(2, 1, 7)) });
  sessions.push({ week: 4, session: 4, title: "W4D4", intervals: withWarmupCooldown(runWalk(2, 1, 8)) });
  sessions.push({ week: 4, session: 5, title: "W4D5", intervals: withWarmupCooldown(runWalk(2, 1, 9)) });

  // Week 5
  sessions.push({ week: 5, session: 1, title: "W5D1", intervals: withWarmupCooldown(runWalk(2, 1, 10)) });
  sessions.push({ week: 5, session: 2, title: "W5D2", intervals: withWarmupCooldown(runWalk(3, 1, 3)) });
  sessions.push({ week: 5, session: 3, title: "W5D3", intervals: withWarmupCooldown(runWalk(3, 1, 4)) });
  sessions.push({ week: 5, session: 4, title: "W5D4", intervals: withWarmupCooldown(runWalk(3, 1, 5)) });
  sessions.push({ week: 5, session: 5, title: "W5D5", intervals: withWarmupCooldown(runWalk(3, 1, 6)) });

  // Week 6
  sessions.push({ week: 6, session: 1, title: "W6D1", intervals: withWarmupCooldown(runWalk(3, 1, 7)) });
  sessions.push({ week: 6, session: 2, title: "W6D2", intervals: withWarmupCooldown(runWalk(3, 1, 8)) });
  sessions.push({ week: 6, session: 3, title: "W6D3", intervals: withWarmupCooldown(runWalk(4, 1, 2)) });
  sessions.push({ week: 6, session: 4, title: "W6D4", intervals: withWarmupCooldown(runWalk(4, 1, 3)) });
  sessions.push({ week: 6, session: 5, title: "W6D5", intervals: withWarmupCooldown(runWalk(4, 1, 4)) });

  // Week 7
  sessions.push({ week: 7, session: 1, title: "W7D1", intervals: withWarmupCooldown(runWalk(4, 1, 5)) });
  sessions.push({ week: 7, session: 2, title: "W7D2", intervals: withWarmupCooldown(runWalk(4, 1, 6)) });
  sessions.push({ week: 7, session: 3, title: "W7D3", intervals: withWarmupCooldown(runWalk(9, 1, 1)) });
  sessions.push({ week: 7, session: 4, title: "W7D4", intervals: withWarmupCooldown(runWalk(9, 1, 2)) });
  sessions.push({ week: 7, session: 5, title: "W7D5", intervals: withWarmupCooldown(runWalk(9, 1, 3)) });

  // Week 8
  sessions.push({ week: 8, session: 1, title: "W8D1", intervals: withWarmupCooldown(runWalk(14, 1, 1)) });
  sessions.push({ week: 8, session: 2, title: "W8D2", intervals: withWarmupCooldown(runWalk(14, 1, 2)) });
  sessions.push({ week: 8, session: 3, title: "W8D3", intervals: withWarmupCooldown(runContinuous(20)) });
  sessions.push({ week: 8, session: 4, title: "W8D4", intervals: withWarmupCooldown(runContinuous(25)) });
  sessions.push({ week: 8, session: 5, title: "W8D5", intervals: withWarmupCooldown(runContinuous(30)) });

  return {
    id: 'starter',
    title: '8-Week Starter Program',
    description: 'Perfect for complete beginners. Slowly build up your running tolerance with frequent short sessions (5x a week).',
    sessions
  };
}

function generate5KProgram(): Program {
  const sessions: WorkoutSessionDef[] = [];
  
  sessions.push({ week: 1, session: 1, title: "W1D1", intervals: withWarmupCooldown(runWalk(2, 2, 6)) });
  sessions.push({ week: 1, session: 2, title: "W1D2", intervals: withWarmupCooldown(runWalk(2, 2, 6)) });
  sessions.push({ week: 1, session: 3, title: "W1D3", intervals: withWarmupCooldown(runWalk(3, 2, 5)) });

  sessions.push({ week: 2, session: 1, title: "W2D1", intervals: withWarmupCooldown(runWalk(3, 2, 5)) });
  sessions.push({ week: 2, session: 2, title: "W2D2", intervals: withWarmupCooldown(runWalk(4, 2, 4)) });
  sessions.push({ week: 2, session: 3, title: "W2D3", intervals: withWarmupCooldown(runWalk(4, 2, 5)) });

  sessions.push({ week: 3, session: 1, title: "W3D1", intervals: withWarmupCooldown(runWalk(5, 2, 4)) });
  sessions.push({ week: 3, session: 2, title: "W3D2", intervals: withWarmupCooldown(runWalk(5, 2, 4)) });
  sessions.push({ week: 3, session: 3, title: "W3D3", intervals: withWarmupCooldown(runWalk(8, 2, 3)) });

  sessions.push({ week: 4, session: 1, title: "W4D1", intervals: withWarmupCooldown(runWalk(8, 2, 3)) });
  sessions.push({ week: 4, session: 2, title: "W4D2", intervals: withWarmupCooldown(runWalk(10, 2, 2)) });
  sessions.push({ week: 4, session: 3, title: "W4D3", intervals: withWarmupCooldown(runWalk(10, 2, 3)) });

  sessions.push({ week: 5, session: 1, title: "W5D1", intervals: withWarmupCooldown(runWalk(12, 2, 2)) });
  sessions.push({ week: 5, session: 2, title: "W5D2", intervals: withWarmupCooldown(runWalk(15, 2, 2)) });
  sessions.push({ week: 5, session: 3, title: "W5D3", intervals: withWarmupCooldown(runContinuous(20)) });

  sessions.push({ week: 6, session: 1, title: "W6D1", intervals: withWarmupCooldown(runContinuous(20)) });
  sessions.push({ week: 6, session: 2, title: "W6D2", intervals: withWarmupCooldown(runWalk(10, 1, 3)) });
  sessions.push({ week: 6, session: 3, title: "W6D3", intervals: withWarmupCooldown(runContinuous(25)) });

  sessions.push({ week: 7, session: 1, title: "W7D1", intervals: withWarmupCooldown(runContinuous(25)) });
  sessions.push({ week: 7, session: 2, title: "W7D2", intervals: withWarmupCooldown(runWalk(15, 1, 2)) });
  sessions.push({ week: 7, session: 3, title: "W7D3", intervals: withWarmupCooldown(runContinuous(28)) });

  sessions.push({ week: 8, session: 1, title: "W8D1", intervals: withWarmupCooldown(runContinuous(30)) });
  sessions.push({ week: 8, session: 2, title: "W8D2", intervals: withWarmupCooldown(runContinuous(20)) });
  sessions.push({ week: 8, session: 3, title: "W8D3 - 5K Day!", intervals: withWarmupCooldown(runContinuous(35)) });

  return {
    id: 'road-to-5k',
    title: 'Road to 5K (3x/week)',
    description: 'Transition from run/walk to running a continuous 5K. Requires 3 running days a week.',
    sessions
  };
}

function generate10KProgram(): Program {
  const sessions: WorkoutSessionDef[] = [];
  
  sessions.push({ week: 1, session: 1, title: "W1D1", intervals: withWarmupCooldown(runContinuous(20)) });
  sessions.push({ week: 1, session: 2, title: "W1D2", intervals: withWarmupCooldown(runContinuous(25)) });
  sessions.push({ week: 1, session: 3, title: "W1D3", intervals: withWarmupCooldown(runContinuous(35)) });

  sessions.push({ week: 2, session: 1, title: "W2D1", intervals: withWarmupCooldown(runContinuous(25)) });
  sessions.push({ week: 2, session: 2, title: "W2D2", intervals: withWarmupCooldown(runContinuous(30)) });
  sessions.push({ week: 2, session: 3, title: "W2D3", intervals: withWarmupCooldown(runContinuous(40)) });

  sessions.push({ week: 3, session: 1, title: "W3D1", intervals: withWarmupCooldown(runWalk(5, 1, 5)) });
  sessions.push({ week: 3, session: 2, title: "W3D2", intervals: withWarmupCooldown(runWalk(10, 1, 3)) });
  sessions.push({ week: 3, session: 3, title: "W3D3", intervals: withWarmupCooldown(runContinuous(45)) });

  sessions.push({ week: 4, session: 1, title: "W4D1", intervals: withWarmupCooldown(runContinuous(30)) });
  sessions.push({ week: 4, session: 2, title: "W4D2", intervals: withWarmupCooldown(runWalk(15, 1, 2)) });
  sessions.push({ week: 4, session: 3, title: "W4D3", intervals: withWarmupCooldown(runContinuous(50)) });

  sessions.push({ week: 5, session: 1, title: "W5D1", intervals: withWarmupCooldown(runContinuous(30)) });
  sessions.push({ week: 5, session: 2, title: "W5D2", intervals: withWarmupCooldown(runContinuous(40)) });
  sessions.push({ week: 5, session: 3, title: "W5D3", intervals: withWarmupCooldown(runContinuous(55)) });

  sessions.push({ week: 6, session: 1, title: "W6D1", intervals: withWarmupCooldown(runContinuous(35)) });
  sessions.push({ week: 6, session: 2, title: "W6D2", intervals: withWarmupCooldown(runContinuous(30)) });
  sessions.push({ week: 6, session: 3, title: "W6D3", intervals: withWarmupCooldown(runContinuous(60)) });

  sessions.push({ week: 7, session: 1, title: "W7D1", intervals: withWarmupCooldown(runWalk(15, 1, 3)) });
  sessions.push({ week: 7, session: 2, title: "W7D2", intervals: withWarmupCooldown(runContinuous(40)) });
  sessions.push({ week: 7, session: 3, title: "W7D3", intervals: withWarmupCooldown(runContinuous(65)) });

  sessions.push({ week: 8, session: 1, title: "W8D1", intervals: withWarmupCooldown(runContinuous(30)) });
  sessions.push({ week: 8, session: 2, title: "W8D2", intervals: withWarmupCooldown(runContinuous(20)) });
  sessions.push({ week: 8, session: 3, title: "W8D3 - 10K Day!", intervals: withWarmupCooldown(runContinuous(70)) });

  return {
    id: 'road-to-10k',
    title: 'Road to 10K (3x/week)',
    description: 'Build your endurance from 5K to 10K with longer intervals and sustained runs.',
    sessions
  };
}

export const PROGRAMS: Program[] = [
  generateStarterProgram(),
  generate5KProgram(),
  generate10KProgram()
];

export function getProgram(id: string): Program | undefined {
  return PROGRAMS.find(p => p.id === id);
}
