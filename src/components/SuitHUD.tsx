import React from 'react';
import { Shield, Zap, Flame, Radio, Crosshair, AlertTriangle } from 'lucide-react';
import { SuitTelemetry } from '../types';
import { starkAudio } from '../utils/sound';

interface SuitHUDProps {
  telemetry: SuitTelemetry;
  suitModel?: 'MK-85' | 'MK-50' | 'MK-44' | 'MK-7';
  currentSuit?: 'MK-85' | 'MK-50' | 'MK-44' | 'MK-7';
  onSelectModel?: (model: 'MK-85' | 'MK-50' | 'MK-44' | 'MK-7') => void;
  onSelectSuit?: (suit: 'MK-85' | 'MK-50' | 'MK-44' | 'MK-7') => void;
  onTriggerProtocol?: (protocol: string) => void;
  onExecuteProtocol?: (protocol: string) => void;
  themeColor?: 'arc' | 'gold' | 'hotrod' | 'stealth';
}

export const SuitHUD: React.FC<SuitHUDProps> = ({
  telemetry,
  suitModel,
  currentSuit,
  onSelectModel,
  onSelectSuit,
  onTriggerProtocol,
  onExecuteProtocol,
  themeColor = 'arc'
}) => {
  const activeSuit = suitModel || currentSuit || 'MK-85';
  const handleSelect = onSelectModel || onSelectSuit || (() => {});
  const handleProtocol = onTriggerProtocol || onExecuteProtocol || (() => {});

  const themeColors = {
    arc: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
    gold: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    hotrod: 'text-red-400 border-red-500/30 bg-red-500/10',
    stealth: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
  };

  const activeColor = themeColors[themeColor] || themeColors.arc;

  const handleProtocolClick = (protocolName: string) => {
    starkAudio.playProtocolAlert();
    handleProtocol(protocolName);
  };

  return (
    <div className="w-full mt-4 border-t border-b border-white/10 py-3.5 px-2 select-none">
      {/* Suit Selector & Online Status */}
      <div className="flex items-center justify-between mb-3 text-[9px] font-mono uppercase tracking-widest text-zinc-400">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-bold text-white tracking-wider">STARK DEFENSE MATRIX</span>
        </div>

        {/* Model Switcher */}
        <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5">
          {(['MK-85', 'MK-50', 'MK-44', 'MK-7'] as const).map((model) => (
            <button
              key={model}
              onClick={() => {
                starkAudio.playHudBeep(700, 0.05);
                handleSelect(model);
              }}
              className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold transition-colors ${
                activeSuit === model
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {model}
            </button>
          ))}
        </div>
      </div>

      {/* Veronica Active Protocol Banner & Orbital Link */}
      {telemetry.activeProtocol === 'Veronica Orbital Module' && (
        <div className="mb-3 p-2 rounded-xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span className="text-[9px] font-mono font-bold text-amber-300 uppercase tracking-widest">
              VERONICA SATELLITE: ORBITAL CAPSULE DEPLOYED
            </span>
          </div>
          <button
            onClick={() => handleProtocolClick('veronica')}
            className="px-2 py-0.5 rounded bg-amber-500/30 hover:bg-amber-500/50 text-amber-200 border border-amber-400/50 text-[8px] font-mono font-bold uppercase tracking-wider transition-colors flex items-center gap-1"
          >
            <Shield className="w-2.5 h-2.5 text-amber-300" />
            <span>View Pod HUD</span>
          </button>
        </div>
      )}

      {/* 4 Telemetry Meters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {/* Armor Integrity */}
        <div className="bg-black/30 border border-white/5 rounded-xl p-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[8px] font-mono uppercase text-zinc-500">
            <span className="flex items-center gap-1">
              <Shield className="w-2.5 h-2.5 text-cyan-400" />
              Armor
            </span>
            <span className="text-cyan-400 font-bold">{telemetry.armorIntegrity}%</span>
          </div>
          <div className="w-full bg-zinc-800 h-1 rounded-full mt-1.5 overflow-hidden">
            <div
              className="bg-cyan-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${telemetry.armorIntegrity}%` }}
            />
          </div>
        </div>

        {/* Arc Reactor */}
        <div className="bg-black/30 border border-white/5 rounded-xl p-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[8px] font-mono uppercase text-zinc-500">
            <span className="flex items-center gap-1">
              <Zap className="w-2.5 h-2.5 text-amber-400" />
              Arc Output
            </span>
            <span className="text-amber-400 font-bold">{telemetry.arcReactorOutput.toFixed(1)} GJ</span>
          </div>
          <div className="w-full bg-zinc-800 h-1 rounded-full mt-1.5 overflow-hidden">
            <div
              className="bg-amber-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (telemetry.arcReactorOutput / 4) * 100)}%` }}
            />
          </div>
        </div>

        {/* Repulsors */}
        <div className="bg-black/30 border border-white/5 rounded-xl p-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[8px] font-mono uppercase text-zinc-500">
            <span className="flex items-center gap-1">
              <Crosshair className="w-2.5 h-2.5 text-red-400" />
              Repulsors
            </span>
            <span className="text-red-400 font-bold">{telemetry.repulsorCharge}%</span>
          </div>
          <div className="w-full bg-zinc-800 h-1 rounded-full mt-1.5 overflow-hidden">
            <div
              className="bg-red-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${telemetry.repulsorCharge}%` }}
            />
          </div>
        </div>

        {/* Thrusters */}
        <div className="bg-black/30 border border-white/5 rounded-xl p-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[8px] font-mono uppercase text-zinc-500">
            <span className="flex items-center gap-1">
              <Flame className="w-2.5 h-2.5 text-sky-400" />
              Thrusters
            </span>
            <span className="text-sky-400 font-bold">Mach {telemetry.thrusterPower}</span>
          </div>
          <div className="w-full bg-zinc-800 h-1 rounded-full mt-1.5 overflow-hidden">
            <div
              className="bg-sky-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (telemetry.thrusterPower / 5) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quick Protocol Triggers */}
      <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
        <button
          onClick={() => handleProtocolClick('house_party')}
          className="flex-1 min-w-[110px] py-1.5 px-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 text-[8px] font-mono font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1"
        >
          <Radio className="w-2.5 h-2.5 text-red-400 animate-pulse" />
          House Party
        </button>

        <button
          onClick={() => handleProtocolClick('veronica')}
          className="flex-1 min-w-[95px] py-1.5 px-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-[8px] font-mono font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1"
        >
          <Shield className="w-2.5 h-2.5 text-amber-400" />
          Veronica
        </button>

        <button
          onClick={() => handleProtocolClick('diagnostics')}
          className="flex-1 min-w-[95px] py-1.5 px-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 text-[8px] font-mono font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1"
        >
          <Zap className="w-2.5 h-2.5 text-cyan-400" />
          Suit Scan
        </button>

        <button
          onClick={() => handleProtocolClick('unibeam')}
          className="flex-1 min-w-[95px] py-1.5 px-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 text-[8px] font-mono font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1"
        >
          <Flame className="w-2.5 h-2.5 text-purple-400" />
          Unibeam
        </button>
      </div>
    </div>
  );
};
