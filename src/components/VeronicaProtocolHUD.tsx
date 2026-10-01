import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Zap, Flame, Radio, X, RotateCcw, Crosshair, Cpu, AlertTriangle, Layers } from 'lucide-react';
import { starkAudio } from '../utils/sound';

interface VeronicaProtocolHUDProps {
  isOpen: boolean;
  onClose: () => void;
  language?: string;
  onReplay?: () => void;
}

export const VeronicaProtocolHUD: React.FC<VeronicaProtocolHUDProps> = ({
  isOpen,
  onClose,
  language = 'en-US',
  onReplay,
}) => {
  const [stage, setStage] = useState<'descending' | 'unlocking' | 'deployed'>('descending');
  const [altitude, setAltitude] = useState(120);
  const [animationKey, setAnimationKey] = useState(0);

  // Run the deployment sequence when opened or replayed
  useEffect(() => {
    if (!isOpen) return;

    setStage('descending');
    setAltitude(120);

    // Audio cue: Thruster burn
    starkAudio.playThrusterBurn();

    // Altitude countdown simulation
    const altInterval = setInterval(() => {
      setAltitude((prev) => {
        if (prev <= 10) {
          clearInterval(altInterval);
          return 0;
        }
        return Math.max(0, prev - 15);
      });
    }, 150);

    // After descent (1.5s), trigger hydraulic release and unlock doors
    const unlockTimer = setTimeout(() => {
      setStage('unlocking');
      starkAudio.playHydraulicRelease();
    }, 1600);

    // Fully deployed after doors complete opening (3.4s)
    const deployedTimer = setTimeout(() => {
      setStage('deployed');
      starkAudio.playSuitClank();
    }, 3400);

    return () => {
      clearInterval(altInterval);
      clearTimeout(unlockTimer);
      clearTimeout(deployedTimer);
    };
  }, [isOpen, animationKey]);

  if (!isOpen) return null;

  const handleRestart = () => {
    setAnimationKey((prev) => prev + 1);
    if (onReplay) onReplay();
  };

  const isHindi = language === 'hi-IN';

  return (
    <AnimatePresence>
      <motion.div
        key="veronica-hud-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1200] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-hidden select-none"
      >
        {/* Background Tactical Grid & Orbital Rings */}
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:24px_24px]" />
        
        {/* Radar concentric reticles */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-25">
          <div className="w-[500px] h-[500px] rounded-full border border-amber-500/40 animate-ping [animation-duration:4s]" />
          <div className="absolute w-[360px] h-[360px] rounded-full border border-dashed border-amber-400/30 animate-[spin_60s_linear_infinite]" />
        </div>

        {/* Main HUD Window */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-lg bg-zinc-950/95 border-2 border-amber-500/50 rounded-2xl shadow-[0_0_80px_rgba(245,158,11,0.3)] overflow-hidden flex flex-col"
        >
          {/* Top HUD Header Banner */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-950/60 via-amber-900/30 to-black border-b border-amber-500/40">
            <div className="flex items-center gap-2">
              <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 border border-amber-400 text-amber-400">
                <Shield className="w-3.5 h-3.5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold tracking-[0.25em] text-amber-300 uppercase">
                    VERONICA PROTOCOL
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[8px] font-mono font-bold tracking-widest border border-amber-500/30 animate-pulse">
                    ORBITAL LINK ACTIVE
                  </span>
                </div>
                <p className="text-[8px] font-mono text-zinc-400 tracking-wider">
                  MARK XLIV HULKBUSTER • RAPID REINFORCEMENT MODULE
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleRestart}
                title="Re-run Deployment Animation"
                className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onClose}
                title="Disengage HUD"
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-300 border border-zinc-700 hover:border-red-500/40 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Tactical Telemetry Strip */}
          <div className="grid grid-cols-4 border-b border-amber-500/20 bg-black/60 px-3 py-2 text-[8px] font-mono tracking-wider text-zinc-400">
            <div>
              <span className="text-zinc-500 block">ALTITUDE:</span>
              <span className="text-amber-300 font-bold">{altitude} KM</span>
            </div>
            <div>
              <span className="text-zinc-500 block">ENTRY VELOCITY:</span>
              <span className="text-amber-300 font-bold">{stage === 'descending' ? 'MACH 7.4' : '0.0 M/S'}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">LOCK STATE:</span>
              <span className={`font-bold ${stage === 'deployed' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {stage === 'descending' ? 'DESCENT' : stage === 'unlocking' ? 'DISENGAGING' : 'UNLOCKED'}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block">COORDINATES:</span>
              <span className="text-amber-300 font-bold">LAT 40.7° / LON -74.0°</span>
            </div>
          </div>

          {/* MAIN CONTAINER ANIMATION CHAMBER */}
          <div key={animationKey} className="relative h-72 sm:h-80 w-full bg-gradient-to-b from-zinc-950 via-black to-zinc-950 overflow-hidden flex items-center justify-center">
            {/* Atmospheric Re-entry Flare / Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,rgba(245,158,11,0.05)_50%,transparent_100%)] pointer-events-none" />
            
            {/* Shockwave Rings emitting from landing pad */}
            <div className="absolute bottom-6 w-48 h-8 rounded-[100%] border border-amber-500/30 animate-veronica-shockwave pointer-events-none" />
            <div className="absolute bottom-6 w-32 h-6 rounded-[100%] border border-amber-400/50 animate-veronica-shockwave pointer-events-none" style={{ animationDelay: '0.4s' }} />

            {/* Tactical Targeting Grid Lines */}
            <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-[1px] bg-amber-500/20 pointer-events-none" />
            <div className="absolute inset-y-8 left-1/2 -translate-x-1/2 w-[1px] bg-amber-500/20 pointer-events-none" />
            
            {/* Crosshair Bracket Overlays */}
            <div className="absolute top-4 left-6 text-amber-500/40 text-[9px] font-mono">
              ┌ ORBITAL TRAJECTORY 88-V
            </div>
            <div className="absolute bottom-4 right-6 text-amber-500/40 text-[9px] font-mono">
              TARGET LOCKED ┘
            </div>

            {/* ==============================================================
                THE LOWERING & UNLOCKING VERONICA CONTAINER (CSS ANIMATED)
                ============================================================== */}
            <div className="relative w-60 sm:w-64 flex flex-col items-center animate-veronica-descent">
              
              {/* Top Atmospheric Heat Shield & Docking Clamp */}
              <div className="relative w-48 h-5 rounded-t-lg bg-gradient-to-r from-zinc-800 via-amber-600 to-zinc-800 border-t-2 border-x-2 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)] flex items-center justify-center">
                <span className="text-[7px] font-mono font-extrabold tracking-[0.3em] text-black">
                  STARK ORBITAL POD
                </span>
                {/* Top Clamp Latches (Unlocks by moving upward) */}
                <div className="absolute -top-2 left-6 w-5 h-2 bg-amber-400 rounded-xs animate-veronica-clamp-top border border-black" />
                <div className="absolute -top-2 right-6 w-5 h-2 bg-amber-400 rounded-xs animate-veronica-clamp-top border border-black" />
              </div>

              {/* Central Capsule Body */}
              <div className="relative w-56 sm:w-60 h-44 sm:h-48 bg-zinc-950 border-2 border-amber-500/60 rounded-sm shadow-[0_0_30px_rgba(245,158,11,0.25)] overflow-hidden flex items-center justify-center">
                
                {/* Laser Diagnostic Scanner Beam */}
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_rgba(245,158,11,0.9)] animate-veronica-scan pointer-events-none z-20" />

                {/* Steam Vent Emitters */}
                <div className="absolute top-2 left-3 w-4 h-4 rounded-full bg-white/30 animate-veronica-steam pointer-events-none" />
                <div className="absolute top-2 right-3 w-4 h-4 rounded-full bg-white/30 animate-veronica-steam pointer-events-none" style={{ animationDelay: '0.3s' }} />

                {/* ==========================================================
                    INTERIOR REVEALED: MARK XLIV HULKBUSTER HEAVY POWER CORE
                    ========================================================== */}
                <div className="absolute inset-0 flex flex-col items-center justify-center p-3 bg-gradient-to-b from-amber-950/40 via-black to-zinc-950 z-0 animate-veronica-core">
                  {/* Hulkbuster Chest Armor Frame */}
                  <div className="relative w-28 h-28 rounded-full border-2 border-amber-400/80 bg-black/80 flex items-center justify-center shadow-[0_0_35px_rgba(245,158,11,0.6)]">
                    {/* Outer Arc Rings */}
                    <div className="absolute inset-1 rounded-full border border-dashed border-amber-300 animate-[spin_8s_linear_infinite]" />
                    <div className="absolute inset-3 rounded-full border-2 border-t-transparent border-amber-500 animate-[spin_4s_linear_infinite_reverse]" />

                    {/* Central Hulkbuster Arc Reactor */}
                    <div className="w-12 h-12 rounded-full bg-amber-500/30 border-2 border-amber-300 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.9)]">
                      <Zap className="w-6 h-6 text-amber-300 fill-amber-300 animate-pulse" />
                    </div>

                    {/* Armor Segment Brackets */}
                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-3 h-10 bg-gradient-to-r from-red-600 to-amber-600 border border-amber-400 rounded-l" />
                    <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-3 h-10 bg-gradient-to-l from-red-600 to-amber-600 border border-amber-400 rounded-r" />
                  </div>

                  <div className="mt-2 text-center">
                    <span className="text-[9px] font-mono font-bold tracking-[0.2em] text-amber-300 uppercase block">
                      HULKBUSTER MARK XLIV
                    </span>
                    <span className="text-[7px] font-mono tracking-widest text-emerald-400 uppercase">
                      HEAVY CORE READY FOR ATTACHMENT
                    </span>
                  </div>
                </div>

                {/* ==========================================================
                    BALLISTIC BLAST DOORS (CSS UNLOCKING SLIDE ANIMATION)
                    ========================================================== */}
                {/* Left Blast Door */}
                <div className="absolute top-0 bottom-0 left-0 w-1/2 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 border-r border-amber-400/80 z-10 animate-veronica-door-left flex flex-col justify-between p-2 shadow-2xl">
                  <div className="flex items-center justify-between text-[7px] font-mono text-amber-400">
                    <span>POD-L</span>
                    <span>LOCK-01</span>
                  </div>
                  {/* Heavy Mechanical Door Plating */}
                  <div className="space-y-1.5 opacity-70">
                    <div className="h-1 bg-amber-500/40 rounded" />
                    <div className="h-1 bg-amber-500/40 rounded w-3/4" />
                    <div className="h-1 bg-amber-500/40 rounded w-1/2" />
                  </div>
                  <div className="text-[6px] font-mono text-zinc-500 tracking-tighter uppercase">
                    TITANIUM-GOLD ALLOY
                  </div>
                </div>

                {/* Right Blast Door */}
                <div className="absolute top-0 bottom-0 right-0 w-1/2 bg-gradient-to-l from-zinc-900 via-zinc-800 to-zinc-900 border-l border-amber-400/80 z-10 animate-veronica-door-right flex flex-col justify-between p-2 shadow-2xl">
                  <div className="flex items-center justify-between text-[7px] font-mono text-amber-400">
                    <span>LOCK-02</span>
                    <span>POD-R</span>
                  </div>
                  {/* Heavy Mechanical Door Plating */}
                  <div className="space-y-1.5 opacity-70 flex flex-col items-end">
                    <div className="h-1 bg-amber-500/40 rounded w-full" />
                    <div className="h-1 bg-amber-500/40 rounded w-3/4" />
                    <div className="h-1 bg-amber-500/40 rounded w-1/2" />
                  </div>
                  <div className="text-[6px] font-mono text-zinc-500 tracking-tighter uppercase text-right">
                    KINETIC REINFORCED
                  </div>
                </div>

                {/* Hydraulic Lock Release Clamp (Bottom) */}
                <div className="absolute -bottom-2 left-8 right-8 h-3 bg-amber-500/90 border border-black rounded-xs z-30 animate-veronica-clamp-bottom flex items-center justify-center">
                  <span className="text-[6px] font-mono text-black font-extrabold tracking-widest">
                    HYDRAULIC SEAL RELEASE
                  </span>
                </div>
              </div>

              {/* Retro-Thruster Exhaust Plumes (Pulsing beneath the container) */}
              <div className="relative w-48 flex justify-around">
                {/* Left Thruster Plume */}
                <div className="flex flex-col items-center">
                  <div className="w-6 h-2 bg-zinc-800 border-x border-b border-amber-400 rounded-b" />
                  <div className="w-4 bg-gradient-to-b from-amber-300 via-amber-500 to-transparent rounded-b-full animate-veronica-thruster" />
                </div>
                {/* Center Main Thruster Plume */}
                <div className="flex flex-col items-center">
                  <div className="w-8 h-2.5 bg-zinc-800 border-x border-b border-amber-400 rounded-b" />
                  <div className="w-6 bg-gradient-to-b from-white via-amber-400 to-transparent rounded-b-full animate-veronica-thruster shadow-[0_0_20px_rgba(245,158,11,1)]" />
                </div>
                {/* Right Thruster Plume */}
                <div className="flex flex-col items-center">
                  <div className="w-6 h-2 bg-zinc-800 border-x border-b border-amber-400 rounded-b" />
                  <div className="w-4 bg-gradient-to-b from-amber-300 via-amber-500 to-transparent rounded-b-full animate-veronica-thruster" />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Status & Diagnostic Action Bar */}
          <div className="p-3 bg-zinc-950 border-t border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-left">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <div>
                <span className="text-[10px] font-mono font-bold text-amber-300 uppercase tracking-wider block">
                  {stage === 'descending'
                    ? (isHindi ? 'ऑर्बिटल अवतरण जारी (वायुमंडलीय प्रवेश)...' : 'ORBITAL DESCENT: ATMOSPHERIC ENTRY...')
                    : stage === 'unlocking'
                    ? (isHindi ? 'हाइड्रोलिक क्लैम्प्स अनलॉक हो रहे हैं...' : 'HYDRAULIC CLAMPS DISENGAGING...')
                    : (isHindi ? 'कंटेनर खुला — हल्कबस्टर कवच तैयार!' : 'CONTAINMENT POD UNLOCKED — HULKBUSTER DEPLOYED')}
                </span>
                <span className="text-[8px] font-mono text-zinc-500">
                  {isHindi
                    ? 'वेरोनिका सैटेलाइट लिंक सक्रिय • सुरक्षा प्रोटोकॉल 100%'
                    : 'VERONICA SATELLITE PLATFORM LINKED • ARMOR READINESS 100%'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleRestart}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] font-mono font-bold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(245,158,11,0.15)]"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Re-Deploy</span>
              </button>
              <button
                onClick={onClose}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-[9px] font-mono font-extrabold uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(245,158,11,0.5)]"
              >
                <span>Acknowledge</span>
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
