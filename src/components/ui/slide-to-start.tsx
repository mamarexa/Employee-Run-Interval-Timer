import { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';
import { cn } from '../../lib/utils';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { useUserStore, CHARACTERS } from '../../store/useUserStore';

export function SlideToStart({ onStart, className, resetDep }: { onStart: () => void, className?: string, resetDep?: any }) {
  const [complete, setComplete] = useState(false);
  const constraintsRef = useRef<HTMLDivElement>(null);
  
  const selectedCharacterId = useUserStore(state => state.selectedCharacterId);
  const currentCharacter = CHARACTERS.find(c => c.id === selectedCharacterId) || CHARACTERS[0];

  const getCharacterStyles = (id: string) => {
    switch (id) {
      case 'running-guy': return "brightness-0 invert";
      case 'coffee-time': return "scale-100 -mt-1 hover:brightness-110";
      case 'baby-camel': return "scale-[0.75] -mt-3 ml-1";
      case 'mochi-running': return "scale-[0.85]";
      default: return "";
    }
  };

  const x = useMotionValue(0);

  useEffect(() => {
    setComplete(false);
    x.set(0);
  }, [resetDep, x]);

  const handleDragEnd = () => {
    if (!constraintsRef.current || complete) return;
    const maxDrag = constraintsRef.current.offsetWidth - 56; 
    
    if (x.get() > maxDrag * 0.65) {
      animate(x, maxDrag, { type: 'spring', stiffness: 300, damping: 25 });
      setComplete(true);
      setTimeout(() => {
        onStart();
        setTimeout(() => {
           setComplete(false);
           x.set(0);
        }, 400); 
      }, 250);
    } else {
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
    }
  };

  const textOpacity = useTransform(x, [0, 80], [1, 0]);

  return (
    <div className={cn(
      "relative w-full h-[72px] rounded-full flex items-center overflow-hidden",
      "bg-white/[0.02] backdrop-blur-[16px]",
      "border-t border-l border-white/[0.1] border-b border-r border-transparent",
      "shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-1px_0_rgba(0,0,0,0.1),0_8px_32px_rgba(0,0,0,0.18),0_2px_8px_rgba(0,0,0,0.05)]",
      className
    )}>
      {/* Inner rim */}
      <div className="absolute inset-[1px] rounded-full border-t-[0.5px] border-l-[0.5px] border-white/[0.05] pointer-events-none" />

      <motion.div 
        className="absolute w-full flex justify-center pointer-events-none z-[1]"
        style={{ opacity: textOpacity }}
      >
        <span className="font-sans font-bold uppercase tracking-[0.28em] text-[11px] text-white/60">
          Slide to start
        </span>
      </motion.div>
      
      <div className="absolute inset-y-0 left-1 right-1 flex items-center pointer-events-none z-[2]" ref={constraintsRef}>
        <motion.div
          drag="x"
          dragConstraints={constraintsRef}
          dragElastic={0.02}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
          style={{ x }}
          className="w-14 h-14 bg-transparent flex items-center justify-center cursor-grab active:cursor-grabbing pointer-events-auto z-10 relative"
        >
          {/* Active Runner Silhouette */}
          <div className={cn(
             "w-[140%] h-[140%] flex items-center justify-center pointer-events-none -ml-2 filter",
             getCharacterStyles(selectedCharacterId)
          )}>
            <DotLottieReact
              src={currentCharacter.url}
              loop
              autoplay
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
