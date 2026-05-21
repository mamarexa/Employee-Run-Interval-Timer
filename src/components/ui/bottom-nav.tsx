import { Activity, Home, User } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

interface BottomNavProps {
  currentTab: 'home' | 'programs' | 'profile';
  onChange: (tab: 'home' | 'programs' | 'profile') => void;
}

export function BottomNav({ currentTab, onChange }: BottomNavProps) {
  const tabs = [
    { id: 'programs', icon: Activity, label: 'Programs' },
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'profile', icon: User, label: 'Profile' },
  ] as const;

  return (
    <div className="fixed bottom-0 left-0 right-0 flex justify-center z-50" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>
      <div className="flex justify-around items-center h-16 px-2 w-[94%] max-w-md bg-white/70 dark:bg-black/60 backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-full shadow-[0_8px_32px_rgba(31,38,135,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                "flex items-center justify-center w-auto px-2.5 sm:px-4 h-12 rounded-full transition-all relative flex-1 gap-1 sm:gap-2",
                isActive ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-white/50"
              )}
            >
              {isActive && (
                <motion.div 
                  layoutId="bottom-nav-bg"
                  className="absolute inset-0 bg-white/60 dark:bg-white/10 rounded-full shadow-sm" 
                  initial={false}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon className="w-5 h-5 relative z-10" strokeWidth={isActive ? 2.5 : 2} />
              {isActive && (
                <span className="text-[11px] font-bold uppercase tracking-wider relative z-10">{tab.label}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
