import React from 'react';
import { motion } from 'motion/react';
import { Sun, Cloud, CloudRain, CloudSnow, CloudLightning, Wind, Droplets, MapPin, X, RefreshCw } from 'lucide-react';
import { WeatherReport, ForecastDay } from '../types';

interface WeatherCardProps {
  weather?: WeatherReport;
  report?: WeatherReport;
  onClose: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const WeatherCard: React.FC<WeatherCardProps> = ({
  weather: weatherProp,
  report: reportProp,
  onClose,
  onRefresh,
  isRefreshing = false
}) => {
  const weather = weatherProp || reportProp;
  if (!weather) return null;

  const renderWeatherIcon = (iconType: ForecastDay['icon'], className = "w-5 h-5") => {
    switch (iconType) {
      case 'sun':
        return <Sun className={`${className} text-amber-400`} />;
      case 'rain':
        return <CloudRain className={`${className} text-cyan-400`} />;
      case 'storm':
        return <CloudLightning className={`${className} text-purple-400`} />;
      case 'snow':
        return <CloudSnow className={`${className} text-sky-200`} />;
      case 'cloud':
      default:
        return <Cloud className={`${className} text-zinc-300`} />;
    }
  };

  return (
    <motion.div
      id="stark-weather-forecast-card"
      initial={{ opacity: 0, y: 15, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.97 }}
      className="w-full mt-3 rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-zinc-950/90 to-black/95 p-4 md:p-5 backdrop-blur-2xl shadow-[0_0_30px_rgba(6,182,212,0.15)] relative overflow-hidden"
    >
      {/* Decorative HUD Corner Notches */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400" />

      {/* Header with City and Controls */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-white">
                {weather.location}
              </h3>
              <span className="text-[8px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold">
                STARK WEATHER RADAR
              </span>
            </div>
            <p className="text-[9px] font-mono text-zinc-400 capitalize">
              {weather.condition} • Feels like {weather.feelsLike}°C
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh atmospheric telemetry"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-cyan-400 hover:bg-white/5 transition-colors"
            title="Refresh atmospheric telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
          <button
            onClick={onClose}
            aria-label="Close weather forecast card"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Dismiss forecast card"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Current Readings Strip */}
      <div className="grid grid-cols-3 gap-2 mb-3 bg-white/[0.02] border border-white/5 rounded-xl p-2.5">
        <div className="flex flex-col">
          <span className="text-[8px] font-mono uppercase tracking-widest text-zinc-500">Current Temp</span>
          <span className="text-lg font-mono font-bold text-cyan-400">{weather.currentTemp}°C</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[8px] font-mono uppercase tracking-widest text-zinc-500 flex items-center gap-1">
            <Droplets className="w-2.5 h-2.5 text-cyan-400" /> Humidity
          </span>
          <span className="text-xs font-mono font-semibold text-zinc-200 mt-1">{weather.humidity}%</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[8px] font-mono uppercase tracking-widest text-zinc-500 flex items-center gap-1">
            <Wind className="w-2.5 h-2.5 text-cyan-400" /> Wind Speed
          </span>
          <span className="text-xs font-mono font-semibold text-zinc-200 mt-1">{weather.windSpeed} km/h</span>
        </div>
      </div>

      {/* 3-Day Forecast Section */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[8px] font-mono uppercase tracking-widest text-zinc-500 px-1">
          <span>3-Day Atmospheric Forecast</span>
          <span>Stark Predictive Matrix</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(weather.forecast || []).slice(0, 3).map((day, idx) => (
            <div
              key={idx}
              className={`flex flex-col items-center justify-between p-2.5 rounded-xl border transition-all ${
                idx === 0
                  ? 'bg-cyan-500/10 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                  : 'bg-zinc-900/60 border-white/5 hover:border-white/10'
              }`}
            >
              <div className="text-center">
                <span className={`text-[10px] font-mono font-bold uppercase tracking-wider block ${idx === 0 ? 'text-cyan-300' : 'text-zinc-300'}`}>
                  {day.dayName}
                </span>
                <span className="text-[8px] font-mono text-zinc-500 block">
                  {day.dateStr}
                </span>
              </div>

              <div className="my-2 p-1.5 rounded-full bg-white/5">
                {renderWeatherIcon(day.icon, "w-6 h-6")}
              </div>

              <div className="text-center w-full">
                <div className="flex items-baseline justify-center gap-1 font-mono">
                  <span className="text-xs font-bold text-white">{day.tempMax}°</span>
                  <span className="text-[9px] text-zinc-500">{day.tempMin}°</span>
                </div>
                <p className="text-[8px] font-mono text-zinc-400 truncate mt-0.5 max-w-[85px] mx-auto capitalize" title={day.condition}>
                  {day.condition}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
