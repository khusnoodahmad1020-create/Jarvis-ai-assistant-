import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Zap, Shield, Flame } from 'lucide-react';
import { starkAudio } from '../utils/sound';

interface ArcReactorProps {
  isListening: boolean;
  isProcessing: boolean;
  isSurging?: boolean;
  status: string;
  themeColor: 'arc' | 'gold' | 'hotrod' | 'stealth';
  onToggleListen?: () => void;
  onClick?: () => void;
  language: string;
}

export const ArcReactor: React.FC<ArcReactorProps> = ({
  isListening,
  isProcessing,
  isSurging = false,
  status,
  themeColor,
  onToggleListen,
  onClick,
  language
}) => {
  // Theme color maps for Arc Reactor
  const themeGlows = {
    arc: {
      ring: 'border-cyan-400',
      fill: 'bg-cyan-500',
      glow: 'shadow-[0_0_60px_rgba(6,182,212,0.6)]',
      text: 'text-cyan-400',
      accentBorder: 'border-cyan-500/40',
      outerGlow: 'from-cyan-500/20 via-sky-500/10 to-transparent',
      coil: 'bg-amber-400/90',
      rgba: '6, 182, 212'
    },
    gold: {
      ring: 'border-amber-400',
      fill: 'bg-amber-500',
      glow: 'shadow-[0_0_60px_rgba(245,158,11,0.6)]',
      text: 'text-amber-400',
      accentBorder: 'border-amber-500/40',
      outerGlow: 'from-amber-500/20 via-yellow-500/10 to-transparent',
      coil: 'bg-amber-300',
      rgba: '245, 158, 11'
    },
    hotrod: {
      ring: 'border-red-500',
      fill: 'bg-red-500',
      glow: 'shadow-[0_0_60px_rgba(239,68,68,0.6)]',
      text: 'text-red-400',
      accentBorder: 'border-red-500/40',
      outerGlow: 'from-red-500/20 via-rose-500/10 to-transparent',
      coil: 'bg-amber-400',
      rgba: '239, 68, 68'
    },
    stealth: {
      ring: 'border-emerald-400',
      fill: 'bg-emerald-500',
      glow: 'shadow-[0_0_60px_rgba(16,185,129,0.6)]',
      text: 'text-emerald-400',
      accentBorder: 'border-emerald-500/40',
      outerGlow: 'from-emerald-500/20 via-teal-500/10 to-transparent',
      coil: 'bg-emerald-300',
      rgba: '16, 185, 129'
    }
  };

  const currentTheme = themeGlows[themeColor];
  const isDenied = status.includes('Denied') || status.includes('अनुमति');
  const isIdle = !isListening && !isProcessing && !isSurging && !isDenied;

  const handleClick = () => {
    starkAudio.playRepulsorCharge();
    if (typeof onClick === 'function') {
      onClick();
    } else if (typeof onToggleListen === 'function') {
      onToggleListen();
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center my-6 select-none">
      {/* Background Photon Halo with organic breathing glow */}
      <motion.div 
        animate={
          isIdle
            ? {
                scale: [1, 1.12, 1],
                opacity: [0.45, 0.8, 0.45]
              }
            : isSurging || isListening
            ? { scale: 1.25, opacity: 1 }
            : { scale: 1, opacity: 0.6 }
        }
        transition={
          isIdle
            ? {
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }
            : { duration: 0.7 }
        }
        className={`absolute w-72 h-72 rounded-full bg-gradient-radial ${currentTheme.outerGlow} blur-2xl pointer-events-none`} 
      />

      {/* Outer Tactical Reticle Markers */}
      <div className="absolute w-64 h-64 pointer-events-none">
        <svg className="w-full h-full animate-[spin_60s_linear_infinite]" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="95" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 6" className={`${currentTheme.text} opacity-30`} />
          <circle cx="100" cy="100" r="88" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="16 30" className={`${currentTheme.text} opacity-50`} />
          {/* Compass / Degree notches */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line
              key={deg}
              x1="100"
              y1="6"
              x2="100"
              y2="12"
              transform={`rotate(${deg} 100 100)`}
              stroke="currentColor"
              strokeWidth="1.5"
              className={currentTheme.text}
            />
          ))}
        </svg>
      </div>

      {/* Counter-rotating Outer Mechanical Ring */}
      <motion.div
        animate={{ rotate: isProcessing ? -360 : 360 }}
        transition={{ duration: isProcessing ? 6 : 24, repeat: Infinity, ease: "linear" }}
        className="absolute w-56 h-56 rounded-full border border-dashed border-white/10 pointer-events-none"
      >
        {/* 10 Segmented Arc Reactor Coils */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none"
            style={{ transform: `rotate(${i * 36}deg)` }}
          >
            <div className="w-3 h-2 mx-auto mt-0.5 rounded-[1px] bg-amber-500/80 shadow-[0_0_8px_rgba(245,158,11,0.8)] border border-amber-300" />
          </div>
        ))}
      </motion.div>

      {/* Pulsing Acoustic Rings when listening */}
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0.8 }}
            animate={{ scale: 1.35, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
            className={`absolute w-52 h-52 rounded-full border-2 ${currentTheme.ring} ${currentTheme.glow} pointer-events-none`}
          />
        )}
      </AnimatePresence>

      {/* Idle Subtle Breathing Aura Ring */}
      <AnimatePresence>
        {isIdle && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{
              scale: [0.97, 1.05, 0.97],
              opacity: [0.25, 0.6, 0.25]
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute w-52 h-52 rounded-full border border-dashed pointer-events-none"
            style={{
              borderColor: `rgba(${currentTheme.rgba}, 0.35)`,
              boxShadow: `0 0 25px rgba(${currentTheme.rgba}, 0.2)`
            }}
          />
        )}
      </AnimatePresence>

      {/* The Core Arc Reactor Interactive Button */}
      <motion.button
        id="arc-reactor-core-btn"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={handleClick}
        animate={
          isIdle
            ? {
                scale: [1, 1.025, 1],
                boxShadow: [
                  `0 0 20px rgba(${currentTheme.rgba}, 0.2)`,
                  `0 0 45px rgba(${currentTheme.rgba}, 0.5)`,
                  `0 0 20px rgba(${currentTheme.rgba}, 0.2)`
                ]
              }
            : {}
        }
        transition={
          isIdle
            ? {
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }
            : { duration: 0.4 }
        }
        aria-label={isListening ? "Listening - Tap to stop" : "Iron Man Arc Reactor - Tap to initiate voice link"}
        className={`relative z-10 w-44 h-44 rounded-full flex flex-col items-center justify-center cursor-pointer transition-all duration-500 backdrop-blur-xl border-2 shadow-2xl outline-none focus-visible:ring-4 focus-visible:ring-cyan-400/50 ${
          isListening
            ? `bg-black/90 ${currentTheme.ring} ${currentTheme.glow}`
            : isProcessing
            ? 'bg-black/95 border-cyan-300 shadow-[0_0_50px_rgba(6,182,212,0.8)]'
            : isSurging
            ? 'bg-white/10 border-white shadow-[0_0_70px_rgba(255,255,255,0.9)]'
            : 'bg-zinc-950/90 border-cyan-500/30 hover:border-cyan-400/80'
        }`}
      >
        {/* Inner Reactor Metallic Texture */}
        <div className="absolute inset-2 rounded-full border border-white/10 bg-radial from-transparent to-black/80 pointer-events-none" />

        {/* High-Tech Triangular / Circular Core Matrix */}
        <div className="relative flex flex-col items-center justify-center">
          {isProcessing ? (
            <motion.div
              animate={{ rotate: 360, scale: [1, 1.15, 1] }}
              transition={{ rotate: { duration: 2, repeat: Infinity, ease: "linear" }, scale: { duration: 1, repeat: Infinity } }}
              className="relative"
            >
              <div className={`w-14 h-14 rounded-full border-2 border-t-transparent ${currentTheme.ring} flex items-center justify-center`}>
                <Zap className={`w-7 h-7 ${currentTheme.text} animate-pulse`} />
              </div>
            </motion.div>
          ) : isListening ? (
            <motion.div
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              className="flex flex-col items-center justify-center"
            >
              <div className={`w-14 h-14 rounded-full bg-cyan-500/20 border-2 ${currentTheme.ring} flex items-center justify-center shadow-[0_0_25px_rgba(6,182,212,0.8)]`}>
                <Mic className={`w-7 h-7 ${currentTheme.text}`} />
              </div>
            </motion.div>
          ) : isDenied ? (
            <div className="w-14 h-14 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center">
              <MicOff className="w-7 h-7 text-red-400" />
            </div>
          ) : (
            /* Idle Arc Core with living breathing pulse */
            <motion.div 
              className="relative group"
              animate={isIdle ? { scale: [1, 1.06, 1] } : undefined}
              transition={isIdle ? { duration: 4, repeat: Infinity, ease: "easeInOut" } : undefined}
            >
              <motion.div 
                className="w-14 h-14 rounded-full border flex items-center justify-center transition-all duration-300 group-hover:border-cyan-400 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.7)]"
                animate={isIdle ? {
                  borderColor: [
                    'rgba(255, 255, 255, 0.2)',
                    `rgba(${currentTheme.rgba}, 0.65)`,
                    'rgba(255, 255, 255, 0.2)'
                  ],
                  boxShadow: [
                    `0 0 10px rgba(${currentTheme.rgba}, 0.15)`,
                    `0 0 25px rgba(${currentTheme.rgba}, 0.5)`,
                    `0 0 10px rgba(${currentTheme.rgba}, 0.15)`
                  ]
                } : undefined}
                transition={isIdle ? {
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                } : undefined}
              >
                <motion.div 
                  className={`w-7 h-7 rounded-full ${currentTheme.fill} blur-xs transition-opacity group-hover:opacity-100`}
                  animate={isIdle ? {
                    opacity: [0.65, 0.95, 0.65],
                    scale: [0.92, 1.15, 0.92]
                  } : undefined}
                  transition={isIdle ? {
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                  } : undefined}
                />
                <motion.div
                  className="absolute"
                  animate={isIdle ? {
                    opacity: [0.85, 1, 0.85],
                    scale: [0.95, 1.05, 0.95]
                  } : undefined}
                  transition={isIdle ? {
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                  } : undefined}
                >
                  <Zap className="w-5 h-5 text-white" />
                </motion.div>
              </motion.div>
            </motion.div>
          )}

          {/* Reactor Text Status */}
          <div className="mt-3 flex flex-col items-center">
            <span className={`text-[11px] font-mono tracking-[0.2em] font-bold uppercase transition-colors duration-300 ${
              isListening ? currentTheme.text : 'text-zinc-300'
            }`}>
              {isListening 
                ? (language === 'hi-IN' ? 'सुन रहा हूँ' : 'LISTENING')
                : isProcessing 
                ? (language === 'hi-IN' ? 'प्रोसेसिंग...' : 'COMPUTING')
                : isDenied 
                ? (language === 'hi-IN' ? 'अनुमति अस्वीकृत' : 'MIC DENIED')
                : 'J.A.R.V.I.S.'}
            </span>
            <span className="text-[8px] font-mono tracking-widest text-zinc-500 uppercase mt-0.5">
              ARC REACTOR: 100%
            </span>
          </div>
        </div>
      </motion.button>

      {/* Telemetry labels underneath Arc Reactor */}
      <div className="mt-3 flex items-center gap-4 text-[9px] font-mono uppercase tracking-widest text-zinc-500">
        <span className="flex items-center gap-1">
          <Shield className="w-3 h-3 text-cyan-400" />
          <span>MARK LXXXV</span>
        </span>
        <span className="text-zinc-700">•</span>
        <span className="flex items-center gap-1">
          <Flame className="w-3 h-3 text-amber-400" />
          <span>3.2 GJ/s</span>
        </span>
      </div>
    </div>
  );
};
