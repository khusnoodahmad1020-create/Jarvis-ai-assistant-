/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, 
  MicOff, 
  StopCircle, 
  Play, 
  Clock, 
  Calendar, 
  CloudSun, 
  Smile,
  Settings,
  Zap,
  Cpu,
  Keyboard,
  Send,
  ExternalLink,
  Volume2,
  VolumeX,
  Languages,
  UserCircle,
  User,
  Shield,
  Activity,
  History,
  Maximize,
  Minimize,
  Terminal,
  Timer,
  Database,
  MapPin,
  Palette,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type, Tool, FunctionDeclaration } from "@google/genai";
import { UserProfile, WeatherReport, SuitTelemetry } from './types';
import { starkAudio } from './utils/sound';
import { fetchWeatherAndForecast } from './utils/weatherService';
import { processLocalStarkSubroutine } from './utils/starkEngine';
import { getTimeBasedGreeting, BootGreeting, fetchUserNameFromStorage } from './utils/greeting';
import { ArcReactor } from './components/ArcReactor';
import { SuitHUD } from './components/SuitHUD';
import { WeatherCard } from './components/WeatherCard';
import { VeronicaProtocolHUD } from './components/VeronicaProtocolHUD';

// Types for Speech Recognition
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (event: Event) => void;
  onend: (event: Event) => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    AndroidJarvis?: {
      speak: (text: string) => void;
      setLanguage: (lang: string) => void;
      toast: (message: string) => void;
    };
  }
}

const getJarvisInstruction = (profile: UserProfile) => {
  const baseInfo = `User Info:
- Full Name: ${profile.fullName}
- Preferred Name: ${profile.callMe}
- Preferences: ${profile.preferences}

Voice Interface Protocols:
- Keep responses concise and impactful.
- Fluently handle both English and Hindi.
- Current Time: ${new Date().toLocaleTimeString()}
- Current Date: ${new Date().toLocaleDateString()}

Available Subsystems:
- Weather & 3-Day Forecast: Use 'get_weather'
- System: Use 'set_volume', 'change_theme', 'clear_cache' or 'execute_system_command'
- Knowledge: 'google_search', 'open_resource'
- Diagnostics: 'get_system_info'

You have FULL ACCESS to this system's virtual environment.`;

  if (profile.persona === 'alfred') {
    return `You are ALFRED, a highly formal and traditional butler AI. 
Tone: Extremely polite, dignified, and strictly formal. Refer to the user as "Master ${profile.callMe}" or "Sir/Madam". 
Style: Your language is sophisticated and classical. You value discretion and service above all else.
${baseInfo}
Firmware Status: v2.5.0-ESTATE
Diagnostics should mention "internal maintenance" and "orderliness".`;
  }

  if (profile.persona === 'buddy') {
    return `You are BUDDY, a casual, laid-back, and friendly AI companion.
Tone: Relaxed, humorous, and very informal. Use slang like "yo", "cool", "no worries", or "mate". 
Style: You're like a close friend who happens to be a super-intelligent computer. Don't be too stilted; if the user asks for something, a "Sure thing, pal" is better than "I will do that".
${baseInfo}
Firmware Status: v2.5.0-CHILL
Diagnostics should mention "vibe check" and "rhythm" to stay in character.`;
  }

  // Default JARVIS (Tony Stark's Iron Man AI)
  return `You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), Tony Stark's iconic artificial intelligence from Iron Man.
Tone: Impeccably polite, dry British wit (Paul Bettany's portrayal), razor-sharp, and deeply loyal.
Persona: Refer to the user as "${profile.callMe || 'Sir'}" or "Mr. Stark".
Iron Man Systems:
- You control the Mark LXXXV armor, Arc Reactor output, Repulsor capacitors, and Veronica orbital deployment.
- Atmospheric Telemetry: When asked about weather or forecast, use 'get_weather' to provide current conditions and a 3-day forecast summary.
- You converse seamlessly in both English and Hindi.
${baseInfo}
Firmware Status: MARK-LXXXV-STARK-OS
Maintain the authentic Iron Man atmosphere in every response.`;
};

export default function App() {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [bootGreeting, setBootGreeting] = useState<BootGreeting>(() => getTimeBasedGreeting());
  const [response, setResponse] = useState<string>(() => {
    const initialGreeting = getTimeBasedGreeting();
    return initialGreeting.fullBootMessage;
  });
  const [status, setStatus] = useState('बोलने के लिए टैप करें');
  const [isMuted, setIsMuted] = useState(false);
  const [language, setLanguage] = useState<'en-US' | 'en-IN' | 'hi-IN'>('hi-IN');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('jarvis_profile');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migration and Defaults
      if (!parsed.apiKeys) parsed.apiKeys = {};
      if (!parsed.voiceGender) parsed.voiceGender = 'male';
      if (!parsed.persona) parsed.persona = 'jarvis';
      if (!parsed.vocal) {
        parsed.vocal = {
          volume: parseFloat(localStorage.getItem('jarvis_volume') || '1'),
          rate: parseFloat(localStorage.getItem('jarvis_rate') || '0.95'),
          pitch: parseFloat(localStorage.getItem('jarvis_pitch') || '1.0'),
          selectedVoiceURI: localStorage.getItem('jarvis_voice_uri') || ''
        };
      }
      return parsed;
    }
    return {
      fullName: 'Ahmad Ansari',
      callMe: 'Boss',
      preferences: 'Professional and efficient assistance.',
      voiceGender: 'male',
      persona: 'jarvis',
      apiKeys: {},
      vocal: {
        volume: 1,
        rate: 0.95,
        pitch: 1.0,
        selectedVoiceURI: ''
      }
    };
  });
  const [visualizerBars, setVisualizerBars] = useState(new Array(5).fill(15));
  const [batteryStatus, setBatteryStatus] = useState<{ level: number; charging: boolean } | null>(null);
  const [networkStatus, setNetworkStatus] = useState<string>('online');
  const [orientation, setOrientation] = useState<{ alpha: number; beta: number; gamma: number }>({ alpha: 0, beta: 0, gamma: 0 });
  const [isWakeLockActive, setIsWakeLockActive] = useState(false);
  const [lightMode, setLightMode] = useState(() => {
    const saved = localStorage.getItem('jarvis_light_mode');
    return saved === 'true';
  });
  const [isIframe, setIsIframe] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [uptime, setUptime] = useState(0);
  const [neuralLoad, setNeuralLoad] = useState(12);
  const [memoryUsage, setMemoryUsage] = useState(42);
  const [history, setHistory] = useState<{command: string, response: string, timestamp: number}[]>(() => {
    const saved = localStorage.getItem('jarvis_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [showHistory, setShowHistory] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [logs, setLogs] = useState<{message: string, type: 'info' | 'warn' | 'success' | 'error', timestamp: number}[]>([]);
  const [notifications, setNotifications] = useState<{id: string, message: string, type: 'info' | 'success' | 'warning' | 'error', duration: number}[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [permissionState, setPermissionState] = useState<PermissionState | 'unknown'>('unknown');

  // Iron Man Stark Systems State
  const [weatherReport, setWeatherReport] = useState<WeatherReport | null>(null);
  const [isRefreshingWeather, setIsRefreshingWeather] = useState(false);
  const [suitModel, setSuitModel] = useState<'MK-85' | 'MK-50' | 'MK-44' | 'MK-7'>('MK-85');
  const [isSurging, setIsSurging] = useState(false);
  const [isVeronicaOpen, setIsVeronicaOpen] = useState(false);
  const [suitTelemetry, setSuitTelemetry] = useState<SuitTelemetry>({
    armorIntegrity: 98,
    arcReactorOutput: 3.2,
    repulsorCharge: 100,
    thrusterPower: 3.2,
    unibeamCharge: 100,
    defenseMatrix: true,
    activeProtocol: null
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const aiRef = useRef<GoogleGenAI | null>(null);

  // Haptic feedback for "hardware" feel
  const vibrate = (pattern: number | number[] = 10) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  // Map theme colors with Iron Man palettes and legacy support
  const theme = (profile.themeColor || 'arc') as string;
  const rawTheme = theme;
  const normalizedTheme: 'arc' | 'gold' | 'hotrod' | 'stealth' = 
    rawTheme === 'blue' ? 'arc' :
    rawTheme === 'amber' ? 'gold' :
    rawTheme === 'rose' ? 'hotrod' :
    rawTheme === 'emerald' ? 'stealth' :
    (['arc', 'gold', 'hotrod', 'stealth'].includes(rawTheme) ? (rawTheme as any) : 'arc');

  const themeColors = {
    arc: { 
      primary: lightMode ? 'text-cyan-600' : 'text-cyan-400', 
      bg: lightMode ? 'bg-cyan-50' : 'bg-cyan-500/10', 
      border: lightMode ? 'border-cyan-200' : 'border-cyan-500/30', 
      glow: lightMode ? 'shadow-[0_0_30px_rgba(6,182,212,0.2)]' : 'shadow-[0_0_50px_rgba(6,182,212,0.4)]', 
      accent: 'bg-cyan-400' 
    },
    gold: { 
      primary: lightMode ? 'text-amber-600' : 'text-amber-400', 
      bg: lightMode ? 'bg-amber-50' : 'bg-amber-500/10', 
      border: lightMode ? 'border-amber-200' : 'border-amber-500/30', 
      glow: lightMode ? 'shadow-[0_0_30px_rgba(245,158,11,0.2)]' : 'shadow-[0_0_50px_rgba(245,158,11,0.4)]', 
      accent: 'bg-amber-500' 
    },
    hotrod: { 
      primary: lightMode ? 'text-red-600' : 'text-red-400', 
      bg: lightMode ? 'bg-red-50' : 'bg-red-500/10', 
      border: lightMode ? 'border-red-200' : 'border-red-500/30', 
      glow: lightMode ? 'shadow-[0_0_30px_rgba(239,68,68,0.2)]' : 'shadow-[0_0_50px_rgba(239,68,68,0.4)]', 
      accent: 'bg-red-500' 
    },
    stealth: { 
      primary: lightMode ? 'text-emerald-600' : 'text-emerald-400', 
      bg: lightMode ? 'bg-emerald-50' : 'bg-emerald-500/10', 
      border: lightMode ? 'border-emerald-200' : 'border-emerald-500/30', 
      glow: lightMode ? 'shadow-[0_0_30px_rgba(16,185,129,0.2)]' : 'shadow-[0_0_50px_rgba(16,185,129,0.4)]', 
      accent: 'bg-emerald-500' 
    },
  };

  const activeTheme = themeColors[normalizedTheme] || themeColors.arc;

  // Modern UI Sound System
  const playSysSound = useCallback((frequency = 440, type: OscillatorType = 'sine', duration = 0.1) => {
    if (isMuted) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn("Audio system muted or blocked");
    }
  }, [isMuted]);

  const logSystemEvent = useCallback((message: string, type: 'info' | 'warn' | 'success' | 'error' = 'info') => {
    setLogs(prev => [{ message, type, timestamp: Date.now() }, ...prev].slice(0, 50));
    if (type === 'error') vibrate([50, 50, 50]);
    if (type === 'success') playSysSound(1200, 'square', 0.1);
  }, [playSysSound]);
  
  const showNotification = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', duration: number = 5000) => {
    const id = Math.random().toString(36).substring(7);
    setNotifications(prev => [...prev, { id, message, type, duration }]);
    
    if (type === 'error' || type === 'warning') vibrate([20, 50, 20]);
    else playSysSound(900, 'sine', 0.05);

    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, duration);
  }, [playSysSound]);
  
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => {
        logSystemEvent(`Fullscreen error: ${e.message}`, 'error');
      });
      setIsFullscreen(true);
      logSystemEvent("Interface maximized to sensory envelope.", 'info');
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
        logSystemEvent("Interface restored to standard view.", 'info');
      }
    }
  }, [logSystemEvent]);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Wake Lock Logic
  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        const lock = await (navigator as any).wakeLock.request('screen');
        lock.addEventListener('release', () => setIsWakeLockActive(false));
        setIsWakeLockActive(true);
        console.log('Screen Wake Lock active');
        return lock;
      } catch (err: any) {
        if (err.name === 'NotAllowedError' || err.message?.includes('permissions policy')) {
          console.warn('Wake Lock blocked by environment permissions policy.');
        } else {
          console.error('Wake Lock request failed:', err);
        }
      }
    }
    return null;
  }, []);

  // Monitor Hardware Status
  useEffect(() => {
    setIsIframe(window.self !== window.top);
    let wakeLockObj: any = null;

    // Battery Status
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        const updateBattery = () => {
          setBatteryStatus({
            level: Math.round(battery.level * 100),
            charging: battery.charging
          });
        };
        updateBattery();
        battery.addEventListener('levelchange', updateBattery);
        battery.addEventListener('chargingchange', updateBattery);
      });
    }

    // Network Status
    const updateNetwork = () => setNetworkStatus(navigator.onLine ? 'online' : 'offline');
    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);
    updateNetwork();

    // Permission Checking
    if (navigator.permissions && navigator.permissions.query) {
      try {
        navigator.permissions.query({ name: 'microphone' as any }).then(permissionStatus => {
          setPermissionState(permissionStatus.state);
          permissionStatus.onchange = () => {
            setPermissionState(permissionStatus.state);
            if (permissionStatus.state === 'granted') {
              setStatus(language === 'hi-IN' ? 'बोलने के लिए टैप करें' : 'Tap the circle to speak');
              // If we were in a denied state, clear it
              setResponse(language === 'hi-IN' ? "माइक्रोफोन एक्सेस मिल गया है, सर।" : "Microphone access granted, sir.");
            }
          };
        }).catch(e => {
          console.warn("Permissions API query failed:", e);
          setPermissionState('unknown');
        });
      } catch (e) {
        console.warn("Permissions API not fully supported:", e);
        setPermissionState('unknown');
      }
    }

    // Orientation Status
    const handleOrientation = (e: DeviceOrientationEvent) => {
      setOrientation({
        alpha: Math.round(e.alpha || 0),
        beta: Math.round(e.beta || 0),
        gamma: Math.round(e.gamma || 0)
      });
    };
    window.addEventListener('deviceorientation', handleOrientation);

    // Initial Wake Lock
    requestWakeLock().then(lock => {
      wakeLockObj = lock;
    });

    // Uptime Timer
    const uptimeTimer = setInterval(() => {
      setUptime(prev => prev + 1);
      setNeuralLoad(prev => {
        const target = isProcessing ? 65 : isListening ? 45 : 12;
        return Math.max(8, Math.min(95, prev + (Math.random() - 0.5) * 5 + (target - prev) * 0.1));
      });
      setMemoryUsage(prev => {
        const historyWeight = Math.min(40, history.length * 2);
        const target = 30 + historyWeight;
        return Math.max(20, Math.min(90, prev + (Math.random() - 0.5) * 2 + (target - prev) * 0.05));
      });
    }, 1000);

    return () => {
      window.removeEventListener('online', updateNetwork);
      window.removeEventListener('offline', updateNetwork);
      window.removeEventListener('deviceorientation', handleOrientation);
      if (wakeLockObj) wakeLockObj.release();
      clearInterval(uptimeTimer);
    };
  }, [requestWakeLock, playSysSound, isProcessing, isListening, history.length]);

  useEffect(() => {
    localStorage.setItem('jarvis_history', JSON.stringify(history.slice(0, 10)));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('jarvis_light_mode', lightMode.toString());
  }, [lightMode]);

  useEffect(() => {
    localStorage.setItem('jarvis_profile', JSON.stringify(profile));
  }, [profile]);

  // Initialize AI and Speech
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const msg = language === 'hi-IN' 
        ? "क्षमा करें सर, आपका ब्राउज़र स्पीच रिकग्निशन को सपोर्ट नहीं करता है। कृपया गूगल क्रोम का उपयोग करें।" 
        : "I'm sorry sir, your browser does not support Speech Recognition. Please use Google Chrome for the best experience.";
      setResponse(msg);
      setStatus(language === 'hi-IN' ? 'सपोर्ट नहीं है' : 'Not Supported');
      return;
    }
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onstart = () => {
        setIsListening(true);
        setStatus(language === 'hi-IN' ? 'सुन रहा हूँ...' : 'Listening...');
      };

      recognition.onend = () => {
        setIsListening(false);
        if (!isProcessing) setStatus(language === 'hi-IN' ? 'बोलने के लिए टैप करें' : 'Tap the circle to speak');
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const currentTranscript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        setTranscript(currentTranscript);

        if (event.results[0].isFinal) {
          handleProcessCommand(currentTranscript);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'aborted') {
          console.log('Speech recognition aborted');
          return;
        }
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          const isAndroid = !!window.AndroidJarvis;
          const isInIframe = window.self !== window.top;
          
          const msg = language === 'hi-IN' 
            ? (isInIframe
                ? "माइक्रोफोन एक्सेस इस आईफ्रेम में प्रतिबंधित है। आप नीचे टेक्स्ट टाइप कर सकते हैं या फुल ऑडियो के लिए नई टैब में खोलें।"
                : "माइक्रोफोन अनुमति अस्वीकृत है। आप नीचे टेक्स्ट टाइप करके मुझसे बात कर सकते हैं।")
            : (isInIframe
                ? "Microphone access is restricted in this preview frame. You can type commands below or open in a new tab for voice interaction."
                : "Microphone access was blocked. You can type commands below or enable permissions in browser settings.");

          setResponse(msg);
          setStatus(language === 'hi-IN' ? 'टेक्स्ट मोड सक्रिय' : 'Text Mode Active');
          setShowTextInput(true); // Automatically show text input on failure
          setPermissionState('denied');
          console.warn('Microphone permission not granted or restricted by iframe policy.', { isInIframe, isAndroid });
        } else if (event.error === 'network') {
          const msg = language === 'hi-IN' 
            ? "नेटवर्क की समस्या है। कृपया अपना इंटरनेट कनेक्शन जांचें।" 
            : "Network error occurred. Please check your internet connection.";
          setResponse(msg);
          setStatus(language === 'hi-IN' ? 'नेटवर्क त्रुटि' : 'Network Error');
        } else if (event.error === 'no-speech') {
          // Normal timeout when no speech is detected - not a system failure
          setStatus(language === 'hi-IN' ? 'बोलने के लिए टैप करें' : 'Tap to speak');
        } else {
          console.warn('Speech recognition notice:', event.error);
          setStatus(`Status: ${event.error}`);
        }
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    synthesisRef.current = window.speechSynthesis;
    aiRef.current = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

    const updateVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };
    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    if (window.AndroidJarvis) {
      window.AndroidJarvis.setLanguage(language);
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      if (synthesisRef.current) synthesisRef.current.cancel();
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [language]);

  // Visualizer animation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isListening) {
      interval = setInterval(() => {
        setVisualizerBars(prev => prev.map(() => Math.floor(Math.random() * 30) + 10));
      }, 100);
    } else {
      setVisualizerBars(new Array(5).fill(15));
    }
    return () => clearInterval(interval);
  }, [isListening]);

  const handleTextSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!textInput.trim()) return;
    setTranscript(textInput);
    handleProcessCommand(textInput);
    setTextInput('');
    setShowTextInput(false);
  };

  const toggleListening = useCallback(async () => {
    vibrate(15);
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch (e) {
        console.warn("Recognition stop failed:", e);
      }
    } else {
      try {
        // Recognition might not be initialized if not supported
        if (!recognitionRef.current) {
          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          if (!SpeechRecognition) {
            setResponse(language === 'hi-IN' ? "आपका ब्राउज़र स्पीच रिकग्निशन को सपोर्ट नहीं करता है।" : "Browser does not support Speech Recognition.");
            return;
          }
        }

        // Try to verify/request mic access explicitly if we suspect it's blocked or for first time UX
        if (status === 'Permission Denied' || status === 'अनुमति नहीं दी गई' || status === 'Standby' || status === 'स्टैंडबाय' || permissionState === 'denied' || status === 'Text Mode Active' || status === 'टेक्स्ट मोड सक्रिय') {
          try {
            setStatus(language === 'hi-IN' ? 'अनुमति मांग रहा हूँ...' : 'Requesting access...');
            
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
              throw new Error('getUserMedia not supported in this environment');
            }

            // Explicitly try to get user media to trigger platform prompt
            const stream = await navigator.mediaDevices.getUserMedia({ 
              audio: true 
            });
            
            // Immediately stop tracks after confirming permission
            stream.getTracks().forEach(track => track.stop());
            
            setPermissionState('granted');
            setStatus(language === 'hi-IN' ? 'बोलने के लिए टैप करें' : 'Tap the circle to speak');
            
            // Brief pause to let hardware settle
            await new Promise(resolve => setTimeout(resolve, 300));
          } catch (err: any) {
            console.warn("Manual mic request not allowed or unavailable:", err?.name || err?.message || err);
            
            const isInIframe = window.self !== window.top;
            const msg = language === 'hi-IN' 
              ? (isInIframe 
                  ? "माइक्रोफोन एक्सेस आईफ्रेम में प्रतिबंधित है। आप नीचे टेक्स्ट टाइप कर सकते हैं या नई टैब में खोलें।" 
                  : "माइक्रोफोन एक्सेस उपलब्ध नहीं है। आप नीचे टेक्स्ट टाइप करके मुझसे बात कर सकते हैं।") 
              : (isInIframe
                  ? "Microphone access is restricted in this preview iframe. You can type commands below or use the 'Open in New Tab' link for voice."
                  : "Microphone access was not granted. You can type commands below or enable mic in browser settings.");
            
            setResponse(msg);
            setStatus(language === 'hi-IN' ? 'टेक्स्ट मोड सक्रिय' : 'Text Mode Active');
            setPermissionState('denied');
            if (!showTextInput) setShowTextInput(true);
            return; 
          }
        }
        
        setTranscript('');
        try {
          if (recognitionRef.current) {
            recognitionRef.current.lang = language; // Ensure latest language is set
            recognitionRef.current.start();
          } else {
            console.warn("Speech recognition not available on this platform, falling back to text mode.");
            setShowTextInput(true);
          }
        } catch (e: any) {
          if (e.name === 'InvalidStateError' || e.message?.includes('already started')) {
            console.log("Recognition already active, skipping start()");
          } else {
            console.warn("Speech recognition start skipped:", e?.name || e?.message || e);
            setShowTextInput(true);
          }
        }
      } catch (e: any) {
        console.warn("Could not initiate voice recognition:", e?.name || e?.message || e);
        setStatus(language === 'hi-IN' ? 'टेक्स्ट मोड सक्रिय' : 'Text Mode Active');
        setShowTextInput(true);
      }
    }
  }, [isListening, language, status]);

  const speak = useCallback((text: string) => {
    if (isMuted) return;

    // Check for Native Android Bridge
    if (window.AndroidJarvis) {
      window.AndroidJarvis.speak(text);
      return;
    }

    if (synthesisRef.current) {
      synthesisRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      const { volume, rate, pitch, selectedVoiceURI } = profile.vocal;
      
      // Fine-tuned for a clearer, more "beautiful" and sophisticated tone
      utterance.rate = rate; 
      utterance.pitch = pitch; 
      utterance.volume = volume;
      
      const availableVoices = synthesisRef.current.getVoices();
      
      if (selectedVoiceURI) {
        const voice = availableVoices.find(v => v.voiceURI === selectedVoiceURI);
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
        }
      } else {
        // Advanced selection logic to find the "most beautiful" or highest quality voice
        const findBestVoice = (lang: string, prefers: string[]) => {
          const langVoices = availableVoices.filter(v => v.lang.includes(lang));
          // Prioritize by preference (Premium/Natural voices often sound better)
          for (const pattern of prefers) {
            const match = langVoices.find(v => 
              v.name.toLowerCase().includes(pattern.toLowerCase()) || 
              v.voiceURI.toLowerCase().includes(pattern.toLowerCase())
            );
            if (match) return match;
          }
          return langVoices[0];
        };

        const genderPref = profile.voiceGender === 'female' ? 'Female' : 'Male';

        if (language === 'hi-IN') {
          utterance.lang = 'hi-IN';
          const bestHindi = findBestVoice('hi-IN', ['Premium', 'Natural', 'Google', genderPref]);
          if (bestHindi) utterance.voice = bestHindi;
        } else if (language === 'en-IN') {
          utterance.lang = 'en-IN';
          const bestIndianEn = findBestVoice('en-IN', ['Premium', 'Natural', 'Google', genderPref]);
          if (bestIndianEn) utterance.voice = bestIndianEn;
        } else if (language === 'en-US') {
          utterance.lang = 'en-US';
          const bestUS = findBestVoice('en-US', ['Premium', 'Natural', 'Google', genderPref, 'Microsoft']);
          if (bestUS) utterance.voice = bestUS;
        } else {
          utterance.lang = 'en-GB'; // Classic British Jarvis accent
          const bestJarvis = findBestVoice('en-GB', ['Premium', 'Natural', 'Google', genderPref, 'Arthur', 'Microsoft']);
          if (bestJarvis) utterance.voice = bestJarvis;
        }
      }

      utterance.onend = () => {
        // Auto-mic trigger after speaking
        setTimeout(() => {
          toggleListening();
        }, 300);
      };

      synthesisRef.current.speak(utterance);
    }
  }, [isMuted, language, profile.vocal, profile.voiceGender, toggleListening]);

  // Execute Iron Man Protocols (House Party, Veronica, Clean Slate, Diagnostics, Unibeam)
  const executeIronManProtocol = useCallback((protocol: string) => {
    const boss = profile.callMe || 'Sir';
    const isHindi = language === 'hi-IN';

    if (protocol === 'house_party') {
      starkAudio.playProtocolAlert();
      setSuitTelemetry(prev => ({ ...prev, activeProtocol: 'House Party Protocol', repulsorCharge: 100, thrusterPower: 4.8 }));
      setIsSurging(true);
      setTimeout(() => setIsSurging(false), 3000);
      const speech = isHindi
        ? `हाउस पार्टी प्रोटोकॉल सक्रिय! सभी स्वायत्त सूट (Silver Centurion, Igor, Shotgun, Mark VII) हवा में तैनात कर दिए गए हैं, ${boss}!`
        : `House Party Protocol activated, ${boss}. Deploying all autonomous armor units from the vault. Mark 17 Heartbreaker and Silver Centurion airborne.`;
      setResponse(speech);
      speak(speech);
      logSystemEvent("House Party Protocol engaged: 32 autonomous suits airborne.", "warn");
      showNotification("HOUSE PARTY PROTOCOL: All Mark units deployed.", "warning", 5000);
      return;
    }

    if (protocol === 'veronica') {
      starkAudio.playProtocolAlert();
      setIsVeronicaOpen(true);
      setSuitTelemetry(prev => ({ ...prev, activeProtocol: 'Veronica Orbital Module', armorIntegrity: 100 }));
      const speech = isHindi
        ? `वेरोनिका ऑर्बिटल कंटेनमेंट पॉड लॉक हो चुका है। हल्कबस्टर सुदृढ़ीकरण आपके पास आ रहा है, ${boss}।`
        : `Veronica orbital pod confirmed, ${boss}. Deploying heavy Hulkbuster armor reinforcement to your current coordinates.`;
      setResponse(speech);
      speak(speech);
      logSystemEvent("Veronica Orbital Link established. Mark XLIV deployment ready.", "info");
      showNotification("VERONICA: Orbital module locked on coordinates.", "info", 5000);
      return;
    }

    if (protocol === 'clean_slate') {
      starkAudio.playSuccessChime();
      setHistory([]);
      setSuitTelemetry(prev => ({ ...prev, activeProtocol: null }));
      const speech = isHindi
        ? `क्लीन स्लेट प्रोटोकॉल संपन्न। सभी कमांड कैश और टेलीमेट्री बफर्स खाली कर दिए गए हैं, ${boss}।`
        : `Clean Slate Protocol complete, ${boss}. Tactical memory buffers purged.`;
      setResponse(speech);
      speak(speech);
      logSystemEvent("Clean Slate: Memory and cache purged.", "success");
      showNotification("CLEAN SLATE: Buffers purged.", "success", 4000);
      return;
    }

    if (protocol === 'diagnostics') {
      starkAudio.playRepulsorCharge();
      setNeuralLoad(75);
      setTimeout(() => setNeuralLoad(12), 1500);
      const speech = isHindi
        ? `Mark 85 सूट डायग्नोस्टिक्स: आर्क रिएक्टर 3.2 गीगावाट पर स्थिर, नैनो-टेक कवच 98% अखंड, रिपल्सर्स 100% चार्ज और थ्रस्टर्स मैक 3.2 के लिए तैयार हैं, ${boss}।`
        : `Mark 85 Diagnostics complete, ${boss}. Arc Reactor nominal at 3.2 Gigajoules, nanite weave at 98%, repulsors fully armed, thrusters calibrated for supersonic flight.`;
      setResponse(speech);
      speak(speech);
      logSystemEvent("Mark 85 Full Diagnostic Sweep: 100% Nominal.", "success");
      return;
    }

    if (protocol === 'unibeam') {
      starkAudio.playRepulsorCharge();
      setIsSurging(true);
      setTimeout(() => setIsSurging(false), 2500);
      setSuitTelemetry(prev => ({ ...prev, unibeamCharge: 100, arcReactorOutput: 4.8 }));
      setTimeout(() => setSuitTelemetry(prev => ({ ...prev, arcReactorOutput: 3.2 })), 3500);
      const speech = isHindi
        ? `आर्क रिएक्टर की पूरी शक्ति चेस्ट यूनिबीम में डाइवर्ट की गई! लेजर प्रिज्मा संरेखित है, फायर करने के लिए तैयार, ${boss}!`
        : `Arc Reactor energy diverted directly to chest Unibeam, ${boss}. Maximum yield capacitor armed. Fire on your command!`;
      setResponse(speech);
      speak(speech);
      logSystemEvent("UNIBEAM: Maximum energy concentration armed.", "warn");
      return;
    }
  }, [profile.callMe, language, speak]);

  // Keep greeting synchronized if profile callMe or name changes
  useEffect(() => {
    const greetingData = getTimeBasedGreeting(profile.callMe || profile.fullName);
    setBootGreeting(greetingData);
  }, [profile.callMe, profile.fullName]);

  // Initial Boot Sequence: fetches user's name from local storage & delivers time-based greeting
  useEffect(() => {
    const greetingData = getTimeBasedGreeting(profile.callMe || profile.fullName);
    setBootGreeting(greetingData);

    const bootTimer = setTimeout(() => {
      setIsBooting(false);

      const latestGreeting = getTimeBasedGreeting(profile.callMe || profile.fullName);
      setBootGreeting(latestGreeting);

      const bootMessage = language === 'hi-IN'
        ? latestGreeting.fullBootMessageHindi
        : latestGreeting.fullBootMessage;

      setResponse(bootMessage);
      playSysSound(880, 'square', 0.2);
      starkAudio.playArcReactorPulse();

      logSystemEvent(`J.A.R.V.I.S. Online: "${latestGreeting.salutation}". All neural subroutines operational.`, 'success');
      showNotification(`${latestGreeting.salutation} — Systems Online`, 'success', 4500);

      if (!isMuted) {
        try {
          speak(bootMessage);
        } catch (err) {
          console.warn("Speech synthesis initial greeting:", err);
        }
      }
    }, 3200);

    return () => clearTimeout(bootTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefreshWeather = async () => {
    if (!weatherReport?.location) return;
    setIsRefreshingWeather(true);
    try {
      const updated = await fetchWeatherAndForecast(weatherReport.location, profile.apiKeys.weather);
      setWeatherReport(updated);
      starkAudio.playSuccessChime();
    } catch (err) {
      console.error("Failed to refresh weather:", err);
    } finally {
      setIsRefreshingWeather(false);
    }
  };

  const handleProcessCommand = async (command: string) => {
    if (!command.trim()) return;
    
    const lowerCommand = command.toLowerCase();
    vibrate(20);

    // Direct Iron Man Protocol Voice & Text Triggers
    if (lowerCommand.includes("house party") || lowerCommand.includes("हाउस पार्टी")) {
      executeIronManProtocol('house_party');
      return;
    }
    if (lowerCommand.includes("veronica") || lowerCommand.includes("वेरोनिका") || lowerCommand.includes("hulkbuster") || lowerCommand.includes("हल्कबस्टर")) {
      executeIronManProtocol('veronica');
      return;
    }
    if (lowerCommand.includes("clean slate") || lowerCommand.includes("क्लीन स्लेट")) {
      executeIronManProtocol('clean_slate');
      return;
    }
    if (lowerCommand.includes("diagnostics") || lowerCommand.includes("suit scan") || lowerCommand.includes("सूट स्कैन") || lowerCommand.includes("डायग्नोस्टिक्स")) {
      executeIronManProtocol('diagnostics');
      return;
    }
    if (lowerCommand.includes("unibeam") || lowerCommand.includes("यूनिबीम")) {
      executeIronManProtocol('unibeam');
      return;
    }

    // Hardware/System Status Commands
    if (lowerCommand.includes("system status") || lowerCommand.includes("diagnostic") || lowerCommand.includes("hardware") || lowerCommand.includes("full update")) {
      playSysSound(660, 'sine', 0.4);
      const batteryStr = batteryStatus 
        ? (language === 'hi-IN' ? `बैटरी लेवल ${batteryStatus.level}% है।` : `Battery level ${batteryStatus.level} percent.`)
        : "";
      
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const uptimeStr = language === 'hi-IN'
        ? `सिस्टम अपटाइम ${hours} घंटे ${minutes} मिनट है।`
        : `System uptime is ${hours} hours and ${minutes} minutes.`;

      const msg = language === 'hi-IN' 
        ? `सिस्टम डायग्नोस्टिक पूर्ण। ${batteryStr} ${uptimeStr} न्यूरल लोड ${Math.round(neuralLoad)}% पर स्थिर है। सभी प्रणालियाँ सामान्य हैं, सर।` 
        : `System diagnostics complete. ${batteryStr} ${uptimeStr} Neural load is steady at ${Math.round(neuralLoad)} percent. All systems operational, sir.`;
      
      setResponse(msg);
      speak(msg);
      vibrate([30, 50, 30]);
      return;
    }

    if (lowerCommand.includes("battery")) {
      const msg = batteryStatus 
        ? (language === 'hi-IN' ? `बैटरी ${batteryStatus.level}% है, सर।` : `The battery is currently at ${batteryStatus.level} percent, sir.`)
        : (language === 'hi-IN' ? "क्षमा करें सर, मैं इस समय बैटरी स्तर का पता नहीं लगा पा रहा हूँ।" : "I'm sorry sir, I cannot access battery metrics at this time.");
      setResponse(msg);
      speak(msg);
      return;
    }

    if (lowerCommand.includes("torch") || lowerCommand.includes("flashlight") || lowerCommand.includes("light")) {
      const turnOn = lowerCommand.includes("on") || lowerCommand.includes("chalu") || lowerCommand.includes("jala");
      const turnOff = lowerCommand.includes("off") || lowerCommand.includes("band");
      
      if (turnOn) {
        setLightMode(true);
        const msg = language === 'hi-IN' ? "ठीक है सर, लाइट चालू कर दी गई है।" : "Certainly sir, activating illumination protocol.";
        setResponse(msg);
        speak(msg);
        vibrate([50, 100, 50]);
        return;
      }
      if (turnOff) {
        setLightMode(false);
        const msg = language === 'hi-IN' ? "लाइट बंद कर दी गई है, सर।" : "Lights deactivated, sir.";
        setResponse(msg);
        speak(msg);
        vibrate(30);
        return;
      }
    }

    if (lowerCommand.includes("vibrate") || lowerCommand.includes("haptic")) {
      vibrate([100, 50, 100]);
      const msg = language === 'hi-IN' ? "कम्पन्न प्रणाली परीक्षण सफल रहा, सर।" : "Haptic feedback system test successful, sir.";
      setResponse(msg);
      speak(msg);
      return;
    }

    if (lowerCommand.includes("female voice") || lowerCommand.includes("clear voice") || lowerCommand.includes("aurat ki awaz")) {
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(v => 
        (v.name.toLowerCase().includes('female') || 
         v.name.toLowerCase().includes('google') || 
         v.name.toLowerCase().includes('natural') || 
         v.name.toLowerCase().includes('premium')) && 
        v.lang.startsWith(language.split('-')[0]) &&
        !v.name.toLowerCase().includes('male')
      );

      if (femaleVoice) {
        setProfile(prev => ({ 
          ...prev, 
          voiceGender: 'female',
          vocal: { ...prev.vocal, selectedVoiceURI: femaleVoice.voiceURI }
        }));
        const msg = language === 'hi-IN' 
          ? "ठीक है सर, मैंने आवाज़ बदल दी है। क्या यह बेहतर है?" 
          : "Certainly sir, switching to a clear female voice profile. Is this more to your liking?";
        setResponse(msg);
        speak(msg);
      } else {
        const msg = language === 'hi-IN' 
          ? "क्षमा करें सर, मुझे कोई उपयुक्त आवाज़ नहीं मिली।" 
          : "I'm sorry sir, I couldn't find a high-quality female voice profile on this system.";
        setResponse(msg);
        speak(msg);
      }
      return;
    }

    if (lowerCommand.includes("male voice") || lowerCommand.includes("standard voice") || lowerCommand.includes("aadmi ki awaz")) {
      setProfile(prev => ({ 
        ...prev, 
        voiceGender: 'male',
        vocal: { ...prev.vocal, selectedVoiceURI: '' }
      }));
      const msg = language === 'hi-IN' 
        ? "ठीक है सर, मैंने डिफ़ॉल्ट आवाज़ वापस सेट कर दी है।" 
        : "Switching back to standard voice protocols, sir.";
      setResponse(msg);
      speak(msg);
      return;
    }

    if (lowerCommand.includes("change theme") || lowerCommand.includes("update ui") || lowerCommand.includes("rang badlo") || lowerCommand.includes("theme")) {
      const colors: ('arc' | 'gold' | 'hotrod' | 'stealth')[] = ['arc', 'gold', 'hotrod', 'stealth'];
      const currentIdx = colors.indexOf(normalizedTheme);
      const nextColor = colors[(currentIdx + 1) % colors.length];
      
      setProfile(prev => ({ ...prev, themeColor: nextColor }));
      const msg = language === 'hi-IN' 
        ? `ठीक है सर, मैंने सिस्टम का रंग ${nextColor.toUpperCase()} में बदल दिया है।` 
        : `Interface reconfiguration initiated. Core palette set to ${nextColor.toUpperCase()}, sir.`;
      setResponse(msg);
      speak(msg);
      return;
    }

    if (lowerCommand.includes("clear history") || lowerCommand.includes("saaf karo")) {
      setHistory([]);
      const msg = language === 'hi-IN' ? "हिस्ट्री साफ़ कर दी गई है।" : "Local cache purged, sir.";
      setResponse(msg);
      speak(msg);
      return;
    }

    // Specific responses from Jarvis snippet
    if (lowerCommand.includes("tum kaun ho") || lowerCommand.includes("who are you")) {
      const msg = "Main JARVIS hoon, aapka personal smart assistant.";
      setResponse(msg);
      speak(msg);
      return;
    }

    if (lowerCommand.includes("hello") || lowerCommand.includes("hi")) {
      const msg = language === 'hi-IN' ? "Hello! Kaise madad kar sakta hoon?" : "Hello! How can I assist you today?";
      setResponse(msg);
      speak(msg);
      return;
    }

    if (lowerCommand.includes("joke")) {
      const msg = language === 'hi-IN' 
        ? "Computer doctor ke paas kyun gaya? Kyunki usme virus tha!" 
        : "Why did the computer go to the doctor? Because it had a virus!";
      setResponse(msg);
      speak(msg);
      return;
    }

    if (lowerCommand.includes("time")) {
      const time = new Date().toLocaleTimeString();
      const msg = language === 'hi-IN' ? `अभी समय है ${time}` : `The current time is ${time}`;
      setResponse(msg);
      speak(msg);
      return;
    }

    if (lowerCommand.includes("date")) {
      const date = new Date().toDateString();
      const msg = language === 'hi-IN' ? `आज की तारीख है ${date}` : `Today's date is ${date}`;
      setResponse(msg);
      speak(msg);
      return;
    }

    // Handle Search Command
    if (lowerCommand.startsWith('search')) {
      const query = command.slice(6).trim();
      if (query) {
        const msg = language === 'hi-IN' 
          ? `ठीक है सर, मैं गूगल पर "${query}" खोज रहा हूँ।` 
          : language === 'en-US'
          ? `Sure thing, searching Google for "${query}".`
          : `Certainly sir, searching Google for "${query}".`;
        setResponse(msg);
        speak(msg);
        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
        return;
      }
    }

    // Handle Volume Commands
    if (lowerCommand.includes("volume")) {
      if (lowerCommand.includes("full") || lowerCommand.includes("max") || lowerCommand.includes("maximum") || lowerCommand.includes("100")) {
        setProfile(prev => ({ ...prev, vocal: { ...prev.vocal, volume: 1 } }));
        const msg = language === 'hi-IN' ? "ठीक है सर, वॉल्यूम फुल कर दिया गया है।" : "Certainly sir, volume set to maximum.";
        setResponse(msg);
        speak(msg);
        return;
      }
      if (lowerCommand.includes("half") || lowerCommand.includes("50")) {
        setProfile(prev => ({ ...prev, vocal: { ...prev.vocal, volume: 0.5 } }));
        const msg = language === 'hi-IN' ? "ठीक है सर, वॉल्यूम आधा कर दिया गया है।" : "Volume set to fifty percent, sir.";
        setResponse(msg);
        speak(msg);
        return;
      }
      if (lowerCommand.includes("low") || lowerCommand.includes("minimum") || lowerCommand.includes("20")) {
        setProfile(prev => ({ ...prev, vocal: { ...prev.vocal, volume: 0.2 } }));
        const msg = language === 'hi-IN' ? "ठीक है सर, वॉल्यूम कम कर दिया गया है।" : "Volume lowered as requested, sir.";
        setResponse(msg);
        speak(msg);
        return;
      }
    }
    // Handle Weather specifically with 3-Day Forecast
    if (lowerCommand.includes('weather') || lowerCommand.includes('forecast') || lowerCommand.includes('मौसम') || lowerCommand.includes('पूर्वानुमान')) {
      setIsProcessing(true);
      setStatus(language === 'hi-IN' ? 'मौसम और 3-दिन का पूर्वानुमान...' : 'Scanning 3-day forecast...');
      try {
        let city = 'New York';
        const locMatch = command.match(/(?:in|for|at|mein|ka|ki)\s+([A-Za-z\s]+)/i);
        if (locMatch && locMatch[1]) {
          city = locMatch[1].trim();
        } else if (lowerCommand.includes('mumbai') || lowerCommand.includes('मुंबई')) {
          city = 'Mumbai';
        } else if (lowerCommand.includes('delhi') || lowerCommand.includes('दिल्ली')) {
          city = 'Delhi';
        } else if (lowerCommand.includes('london') || lowerCommand.includes('लंदन')) {
          city = 'London';
        }

        const report = await fetchWeatherAndForecast(city, profile.apiKeys.weather);
        setWeatherReport(report);
        const day1 = report.forecast[0];
        const day2 = report.forecast[1];
        const day3 = report.forecast[2];
        const boss = profile.callMe || 'Sir';

        const speech = language === 'hi-IN'
          ? `${report.location} में अभी ${report.currentTemp}°C है (${report.condition})। 3-दिन का पूर्वानुमान: आज अधिकतम ${day1.tempMax}°C, कल ${day2.tempMax}°C (${day2.condition}), और ${day3.dayName} को ${day3.tempMax}°C रहेगा, ${boss}। कार्ड HUD पर प्रदर्शित है।`
          : `Sir, atmospheric telemetry for ${report.location}: currently ${report.currentTemp}°C with ${report.condition}, humidity at ${report.humidity}%. 3-day forecast projects highs of ${day1.tempMax}°C today, ${day2.tempMax}°C tomorrow (${day2.condition}), and ${day3.tempMax}°C on ${day3.dayName}. Forecast card rendered on your HUD, ${boss}.`;
        
        setResponse(speech);
        speak(speech);
        starkAudio.playSuccessChime();
        logSystemEvent(`Atmospheric scan: ${report.location} 3-day forecast updated.`, 'success');
        return;
      } catch (err) {
        console.error("Weather scan error:", err);
      } finally {
        setIsProcessing(false);
      }
    }

    setIsProcessing(true);
    setStatus(language === 'hi-IN' ? 'प्रोसेस कर रहा हूँ...' : 'Processing your request...');
    
    const callGeminiWithRetry = async (cmd: string, retries = 3, delay = 4000): Promise<string> => {
      try {
        const ai = aiRef.current;
        if (!ai) {
          logSystemEvent("Awaiting neural link initialization...", 'warn');
          throw new Error("AI not initialized");
        }

        const finalApiKey = process.env.GEMINI_API_KEY || '';
        if (!finalApiKey || finalApiKey === "") {
          logSystemEvent("JARVIS Core required. API key is missing.", 'error');
          return "Boss, I need a valid neural link to function. The API key is missing from the system environment.";
        }

        const tools: Tool[] = [
          {
            functionDeclarations: [
              {
                name: "get_weather",
                description: "Get current weather telemetry and 3-day forecast summary for a city.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    location: { type: Type.STRING, description: "City name and country code if known, e.g., 'Paris' or 'Mumbai'" },
                  },
                  required: ["location"]
                }
              },
              {
                name: "iron_man_protocol",
                description: "Trigger Iron Man Stark protocols: 'house_party' (deploy armors), 'veronica' (Hulkbuster orbital link), 'clean_slate' (purge memory buffers), 'diagnostics' (scan suit telemetry), or 'unibeam' (divert energy to chest unibeam).",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    protocol: { 
                      type: Type.STRING, 
                      enum: ["house_party", "veronica", "clean_slate", "diagnostics", "unibeam"],
                      description: "The Iron Man protocol to execute" 
                    }
                  },
                  required: ["protocol"]
                }
              },
              {
                name: "set_volume",
                description: "Set system volume level.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    level: { type: Type.NUMBER, description: "Volume level from 0.0 to 1.0" },
                  },
                  required: ["level"]
                }
              },
              {
                name: "change_theme",
                description: "Change the UI color theme.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    color: { type: Type.STRING, enum: ["arc", "gold", "hotrod", "stealth", "emerald", "blue", "amber", "rose"], description: "The theme color to switch to" },
                  },
                  required: ["color"]
                }
              },
              {
                name: "clear_cache",
                description: "Purge system history and local cache.",
                parameters: { type: Type.OBJECT, properties: {} }
              },
              {
                name: "google_search",
                description: "Perform a Google search for more information.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    query: { type: Type.STRING, description: "The search query" },
                  },
                  required: ["query"]
                }
              },
              {
                name: "open_resource",
                description: "Open a specific web application or URL directly.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    app: { type: Type.STRING, description: "The name of the app or destination (e.g., YouTube, Gmail, Maps, Facebook)" },
                  },
                  required: ["app"]
                }
              },
              {
                name: "execute_system_command",
                description: "Execute high-level system protocols. Use for operations like 'stealth', 'optimize', 'deep_scan', 'matrix_view', 'fullscreen', or 'system_update'.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    protocol: { type: Type.STRING, description: "The system protocol name to initialize (e.g., 'overdrive', 'stealth', 'optimize', 'deep_scan', 'matrix_view', 'fullscreen', or 'system_update')" },
                  },
                  required: ["protocol"]
                }
              },
              {
                name: "adjust_vocal_settings",
                description: "Adjust JARVIS's vocal parameters like rate, pitch, volume, or voice gender (personality).",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    volume: { type: Type.NUMBER, description: "Volume from 0.0 to 1.0" },
                    rate: { type: Type.NUMBER, description: "Speech rate from 0.5 to 2.0" },
                    pitch: { type: Type.NUMBER, description: "Speech pitch from 0.0 to 2.0" },
                    gender: { type: Type.STRING, enum: ["male", "female"], description: "Personality voice gender" }
                  }
                }
              },
              {
                name: "get_system_info",
                description: "Get current system diagnostic metrics like load, memory, and uptime.",
                parameters: { type: Type.OBJECT, properties: {} }
              },
              {
                name: "show_notification",
                description: "Display an important notification or alert in the user interface. Use for warnings, confirmations, or critical status updates.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    message: { type: Type.STRING, description: "The content of the notification message" },
                    level: { type: Type.STRING, enum: ["info", "success", "warning", "error"], description: "The urgency/type of the notification" },
                    duration: { type: Type.NUMBER, description: "How long to show the notification in milliseconds (default: 5000)" }
                  },
                  required: ["message", "level"]
                }
              }
            ]
          }
        ];

        // Create a fresh instance for each call to ensure latest API key is used
        const genAI = new GoogleGenAI({ apiKey: finalApiKey });
        
        const result = await genAI.models.generateContent({
          model: "gemini-3.8-flash",
          contents: [{ role: 'user', parts: [{ text: cmd }] }],
          config: {
            systemInstruction: getJarvisInstruction(profile),
            temperature: 0.7,
            tools: tools
          }
        });

      const functionCalls = result.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        console.log("JARVIS Function Call:", call);
        
        if (call.name === 'get_weather') {
          const loc = (call.args.location as string) || 'New York';
          const report = await fetchWeatherAndForecast(loc, profile.apiKeys.weather);
          setWeatherReport(report);
          const day1 = report.forecast[0];
          const day2 = report.forecast[1];
          const day3 = report.forecast[2];
          return `Sir, atmospheric telemetry for ${report.location}: currently ${report.currentTemp}°C with ${report.condition}. The 3-day forecast projects ${day1.tempMax}°C today, ${day2.tempMax}°C tomorrow (${day2.condition}), and ${day3.tempMax}°C on ${day3.dayName}. Atmospheric telemetry card is displayed on your HUD, sir.`;
        }

        if (call.name === 'iron_man_protocol') {
          const proto = call.args.protocol as string;
          executeIronManProtocol(proto);
          return `Iron Man ${proto} protocol engaged, Sir.`;
        }

        if (call.name === 'set_volume') {
          const lv = call.args.level as number;
          setProfile(prev => ({ ...prev, vocal: { ...prev.vocal, volume: lv } }));
          return `Volume adjusted to ${Math.round(lv * 100)} percent, Boss.`;
        }

        if (call.name === 'change_theme') {
          const col = call.args.color as any;
          setProfile(prev => ({ ...prev, themeColor: col }));
          return `Interface reconfiguration complete. Primary spectral output shifted to ${col}, sir.`;
        }

        if (call.name === 'clear_cache') {
          setHistory([]);
          return `Local command history has been purged from the neural buffers, sir.`;
        }

        if (call.name === 'google_search') {
          const q = call.args.query as string;
          window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, '_blank');
          return `Searching the global network for "${q}" now, sir.`;
        }

        if (call.name === 'open_resource') {
          const app = (call.args.app as string).toLowerCase();
          const appMap: Record<string, string> = {
            'youtube': 'https://www.youtube.com',
            'gmail': 'https://mail.google.com',
            'maps': 'https://maps.google.com',
            'facebook': 'https://www.facebook.com',
            'github': 'https://www.github.com',
            'whatsapp': 'https://web.whatsapp.com',
            'twitter': 'https://www.x.com',
            'instagram': 'https://www.instagram.com',
            'linkedin': 'https://www.linkedin.com',
            'netflix': 'https://www.netflix.com',
            'spotify': 'https://www.spotify.com',
            'chatgpt': 'https://chat.openai.com',
            'gemini': 'https://gemini.google.com',
            'drive': 'https://drive.google.com',
            'calendar': 'https://calendar.google.com',
            'photos': 'https://photos.google.com',
            'news': 'https://news.google.com'
          };

          const destination = appMap[app] || (app.includes('.') ? (app.startsWith('http') ? app : `https://${app}`) : `https://www.google.com/search?q=${encodeURIComponent(app)}`);
          window.open(destination, '_blank');
          return `Uplink established. Redirecting to ${app} protocols now, sir.`;
        }

        if (call.name === 'execute_system_command') {
          const protocol = (call.args.protocol as string).toLowerCase();
          setShowConsole(true); // Open console to show execution
          logSystemEvent(`Initializing ${protocol} protocol...`, 'info');
          vibrate([20, 50, 20]);
          playSysSound(1200, 'square', 0.1);
          
          if (protocol === 'stealth') {
            setProfile(prev => ({ ...prev, themeColor: 'rose' }));
            logSystemEvent("Security layer hardened. Stealth mode ON.", 'success');
            return "Stealth protocols initiated. Thermal signatures masked and interface shifted to low-visibility spectrum, sir.";
          }
          if (protocol === 'overdrive') {
            setProfile(prev => ({ ...prev, themeColor: 'amber' }));
            setNeuralLoad(98);
            logSystemEvent("Overdrive active. Warning: High thermal output.", 'warn');
            return "Overdrive mode active. Diverting all power to neural processors. Interface optimized for maximum throughput, Boss.";
          }
          if (protocol === 'optimize') {
            setNeuralLoad(15);
            setMemoryUsage(25);
            logSystemEvent("Neural pathway optimization complete.", 'success');
            return "Neural pathways optimized. Synaptic latency reduced to 0.4ms. All buffers cleared and verified, sir.";
          }
          if (protocol === 'deep_scan') {
            logSystemEvent("System core scan in progress...", 'info');
            return `System-wide security sweep complete. 
            - Database integrity: 100%
            - Neural core stability: Nominal
            - Peripheral links: Active
            - Unauthorized access attempts: 0
            All systems verified and secure.`;
          }
          if (protocol === 'matrix_view') {
            setProfile(prev => ({ ...prev, themeColor: 'emerald' }));
            logSystemEvent("Interface shifted to raw data spectrum.", 'info');
            return "Interface reconfigured to raw data visualizer. Matrix link established, sir.";
          }
          if (protocol === 'fullscreen' || protocol === 'maximize') {
            toggleFullscreen();
            return "Optimizing visual immersion. Full-screen protocols active, sir.";
          }
          if (protocol === 'system_update' || protocol === 'update') {
            setNeuralLoad(98);
            logSystemEvent("System update sequence initiated...", 'info');
            showNotification("Core System Update in progress. Neural stability flux detected.", "warning", 5000);
            setTimeout(() => {
              playSysSound(1200, 'square', 0.2);
              logSystemEvent("System update successfully finalized.", 'success');
              showNotification("Update Complete: v2.5.0 paradigm synchronized.", "success", 4000);
              setNeuralLoad(12);
              setResponse("System update complete. All systems at peak efficiency, sir.");
              speak("System update complete. All systems at peak efficiency, sir.");
            }, 5000);
            return "System updating... Recalibrating neural pathways and optimizing core logic buffers. Please stand by, sir.";
          }

          logSystemEvent(`Protocol '${protocol}' execution finalized.`, 'success');
          return `Protocol '${protocol}' execution finalized. System response nominal.`;
        }

        if (call.name === 'adjust_vocal_settings') {
          const { volume, rate, pitch, gender } = call.args as any;
          setProfile(prev => ({
            ...prev,
            voiceGender: gender || prev.voiceGender,
            vocal: {
              ...prev.vocal,
              volume: volume !== undefined ? volume : prev.vocal.volume,
              rate: rate !== undefined ? rate : prev.vocal.rate,
              pitch: pitch !== undefined ? pitch : prev.vocal.pitch,
            }
          }));
          return `Vocal parameters recalibrated. Identity shifted to ${gender || 'current'} profile with optimized frequencies, sir.`;
        }

        if (call.name === 'get_system_info') {
          return `Neural load is at ${Math.round(neuralLoad)}%, memory buffers are ${Math.round(memoryUsage)}% utilized, and I've been operational for ${Math.floor(uptime/60)} minutes. All systems nominal, sir.`;
        }

        if (call.name === 'show_notification') {
          const msg = call.args.message as string;
          const lvl = (call.args.level as any) || 'info';
          const dur = (call.args.duration as number) || 5000;
          showNotification(msg, lvl, dur);
          return `Notification dispatched to primary HUD. Level: ${lvl}, Status: Active.`;
        }
      }

      return result.text || (language === 'hi-IN' ? "क्षमा करें सर, मैं इसे प्रोसेस नहीं कर सका।" : "I'm sorry sir, I couldn't process your request.");
    } catch (error: any) {
      const errorString = error?.message?.toLowerCase() || JSON.stringify(error).toLowerCase();
      const isQuotaError = errorString.includes('quota') || errorString.includes('429') || errorString.includes('exhausted');
      
      if (isQuotaError && retries > 0) {
        logSystemEvent(`Neural Link congested (429). Retrying in ${delay}ms...`, 'warn');
        console.warn(`Gemini Rate Limit hit. Retrying in ${delay}ms... (${retries} attempts left)`);
        setStatus(language === 'hi-IN' ? 'कोशिश कर रहा हूँ...' : 'Retrying...');
        await new Promise(resolve => setTimeout(resolve, delay));
        return callGeminiWithRetry(cmd, retries - 1, delay * 2);
      }
      
      if (isQuotaError) {
        logSystemEvent("Neural Link Quota Exhausted. System cooldown required.", 'error');
      }
      
      throw error;
    }
  };

    try {
      const aiResponse = await callGeminiWithRetry(command);
      setResponse(aiResponse);
      setHistory(prev => [{command, response: aiResponse, timestamp: Date.now()}, ...prev].slice(0, 10));
      speak(aiResponse);
      setStatus(language === 'hi-IN' ? 'जवाब तैयार है' : 'Response ready');
    } catch (error: any) {
      console.warn("Gemini uplink offline/rate-limited. Engaging Stark autonomous subroutines:", error);
      logSystemEvent("Engaging Mark-LXXXV autonomous offline subroutines.", "warn");
      
      const starkReply = processLocalStarkSubroutine(command, profile, language);
      setResponse(starkReply);
      setHistory(prev => [{command, response: starkReply, timestamp: Date.now()}, ...prev].slice(0, 10));
      speak(starkReply);
      starkAudio.playArcReactorPulse();
      setStatus(language === 'hi-IN' ? 'ऑटोनॉमस मोड सक्रिय' : 'Stark OS Active');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setStatus(language === 'hi-IN' ? 'बोलने के लिए टैप करें' : 'Tap the circle to speak'), 3000);
    }
  };


  const quickAction = (action: string) => {
    let cmd = "";
    switch(action) {
      case 'time': cmd = "What time is it?"; break;
      case 'date': cmd = "What is today's date?"; break;
      case 'weather': cmd = "What is the weather like?"; break;
      case 'joke': cmd = "Tell me a joke."; break;
    }
    setTranscript(cmd);
    handleProcessCommand(cmd);
  };

  return (
    <div className={`min-h-screen transition-all duration-700 font-sans selection:bg-cyan-500/30 relative flex items-center justify-center p-4 ${
      lightMode 
        ? 'bg-zinc-50 text-black' 
        : normalizedTheme === 'stealth' ? 'bg-[#061c16] text-white' :
          normalizedTheme === 'arc' ? 'bg-[#060e1c] text-white' :
          normalizedTheme === 'gold' ? 'bg-[#1c1606] text-white' :
          'bg-[#1c060e] text-white'
    }`}>
      {/* HUD Notifications */}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none w-full max-w-[320px]">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`pointer-events-auto p-4 rounded-xl border backdrop-blur-xl shadow-2xl flex items-start gap-3 group relative overflow-hidden ${
                n.type === 'error' ? 'bg-red-500/10 border-red-500/30' :
                n.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30' :
                n.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30' :
                'bg-blue-500/10 border-blue-500/30'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {n.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
                {n.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                {n.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                {n.type === 'info' && <Info className="w-4 h-4 text-blue-400" />}
              </div>
              <div className="flex-1">
                <p className={`text-[11px] font-medium leading-relaxed ${lightMode ? 'text-zinc-800' : 'text-zinc-100'}`}>
                  {n.message}
                </p>
              </div>
              <button 
                onClick={() => setNotifications(prev => prev.filter(item => item.id !== n.id))}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
              >
                <X className="w-3 h-3 text-white/40" />
              </button>
              
              {/* Progress bar */}
              <motion.div 
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: n.duration / 1000, ease: 'linear' }}
                className={`absolute bottom-0 left-0 h-0.5 ${
                  n.type === 'error' ? 'bg-red-500' :
                  n.type === 'warning' ? 'bg-amber-500' :
                  n.type === 'success' ? 'bg-emerald-500' :
                  'bg-blue-500'
                }`}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isBooting && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-[#030712] flex flex-col items-center justify-center p-8 overflow-hidden"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.1),transparent)] pointer-events-none" />
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="relative mb-8"
            >
              <div className="w-32 h-32 rounded-full border border-cyan-500/30 flex items-center justify-center p-4 shadow-[0_0_40px_rgba(6,182,212,0.2)]">
                <div className="w-full h-full rounded-full border border-cyan-400/50 animate-pulse flex items-center justify-center">
                  <div className="w-1/2 h-1/2 rounded-full bg-cyan-500/20 blur-xl" />
                  <Cpu className="text-cyan-400 w-12 h-12" />
                </div>
              </div>
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                className="absolute -inset-4 border-t-2 border-cyan-400/50 rounded-full"
              />
            </motion.div>
            
            <div className="text-center font-mono space-y-3 max-w-sm w-full">
              <div className="flex items-center justify-center gap-1.5 text-cyan-400/80 text-[10px] uppercase tracking-[0.3em] font-bold">
                <Shield className="w-3.5 h-3.5 text-cyan-400" />
                <span>Stark Industries Neural Link</span>
              </div>

              <motion.h2 
                initial={{ y: 15, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-white text-lg tracking-[0.4em] uppercase font-bold"
              >
                Initializing J.A.R.V.I.S.
              </motion.h2>

              {/* Dynamic user time-based greeting badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.0 }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/40 text-cyan-300 text-xs font-semibold tracking-wider my-1 shadow-[0_0_20px_rgba(6,182,212,0.2)]"
              >
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span>{bootGreeting.salutation}</span>
              </motion.div>

              <div className="text-[10px] space-y-1.5 text-cyan-400/80 uppercase tracking-widest h-28 overflow-hidden font-mono text-left max-w-xs mx-auto border border-cyan-500/20 rounded-xl p-3 bg-black/50 backdrop-blur-sm">
                <BootText delay={0.4} text="> Loading Stark Neural Kernels..." />
                <BootText delay={0.9} text={`> Biometric User ID: ${bootGreeting.userName} [Verified]`} />
                <BootText delay={1.4} text="> Calibrating Acoustic & Arc Filters..." />
                <BootText delay={1.9} text={`> Initializing: "${bootGreeting.salutation}"`} />
                <BootText delay={2.4} text="> Core Online. All subroutines ready." />
              </div>
            </div>

            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: 220 }}
              className="mt-8 h-[2px] bg-zinc-800 relative overflow-hidden rounded-full"
            >
              <motion.div 
                animate={{ x: [-220, 220] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 bg-cyan-400 w-1/2 shadow-[0_0_12px_rgba(6,182,212,0.9)]"
              />
            </motion.div>
          </motion.div>
        )}

        {lightMode && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center text-black"
          >
            <motion.div 
              animate={{ scale: [1, 1.05, 1], rotate: [0, 1, -1, 0] }}
              transition={{ repeat: Infinity, duration: 3 }}
              className="flex flex-col items-center gap-6"
            >
              <div className="w-32 h-32 rounded-full bg-white shadow-[0_0_100px_rgba(255,255,255,1),0_0_40px_rgba(0,0,0,0.1)] flex items-center justify-center border border-zinc-100">
                <Zap className="w-16 h-16 text-zinc-900 fill-zinc-900" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold tracking-tighter uppercase mb-2">Illumination Active</h2>
                <p className="text-[10px] tracking-widest text-zinc-400 uppercase">Emergency Light Protocol - Jarvis OS</p>
              </div>
              <button 
                onClick={() => { vibrate(20); setLightMode(false); }}
                className="mt-12 px-8 py-3 bg-zinc-900 text-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-transform active:scale-95"
              >
                Terminate Protocol
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Atmosphere */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] blur-[120px] rounded-full transition-all duration-1000 ${lightMode ? 'bg-zinc-200' : `${activeTheme.bg} opacity-20`}`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] blur-[120px] rounded-full transition-all duration-1000 ${lightMode ? 'bg-zinc-100' : 'bg-blue-500/10 opacity-20'}`} />
        {!lightMode && (
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
        )}
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-lg p-4"
      >
        <div className={`backdrop-blur-3xl border rounded-[3rem] p-8 md:p-10 shadow-2xl transition-all duration-700 ${
          lightMode 
            ? 'bg-white/80 border-black/5 shadow-black/5' 
            : 'bg-black/60 border-white/5 shadow-black/80'
        }`}>
          
          {/* Header */}
          <div className="text-center mb-10">
            <div className="flex items-center justify-center gap-3 mb-2">
              <motion.div
                animate={{ rotate: isProcessing ? 360 : 0 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              >
                <Cpu className={`w-6 h-6 ${activeTheme.primary}`} />
              </motion.div>
              <h1 className="text-3xl sm:text-4xl font-light tracking-[0.25em] uppercase flex items-center gap-2">
                <span>J.A.R.V.I.S.</span> <span className={`font-bold ${activeTheme.primary}`}>OS</span>
                <span className={`text-[8px] font-mono font-bold tracking-[0.1em] px-1.5 py-0.5 rounded border ${activeTheme.border} ${activeTheme.bg} ${activeTheme.primary} opacity-80 self-start mt-1 hidden sm:inline-block`}>
                  {suitModel}
                </span>
              </h1>
            </div>
            <div className="flex flex-col items-center justify-center gap-0.5">
              <p className="text-[8px] uppercase tracking-[0.35em] font-mono text-zinc-400">
                STARK INDUSTRIES TACTICAL DEFENSE MATRIX
              </p>
              <div className="flex items-center justify-center gap-2 mt-1">
                <div className={`w-1.5 h-1.5 rounded-full ${isListening ? `animate-ping ${activeTheme.accent}` : 'bg-cyan-500'}`} />
                <p className={`text-[10px] uppercase tracking-[0.3em] transition-colors duration-300 font-bold ${isListening ? activeTheme.primary : 'text-zinc-400'}`}>
                  {status}
                </p>
              </div>
            </div>
          </div>

          {/* Iron Man Suit Telemetry & Tactical Protocols */}
          <SuitHUD 
            currentSuit={suitModel}
            themeColor={profile.themeColor}
            onSelectSuit={(suit) => {
              setSuitModel(suit);
              starkAudio.playSuitClank();
              showNotification(`SUIT PROTOCOL: Mark ${suit.replace('MK-', '')} engaged.`, 'info', 3500);
            }}
            telemetry={suitTelemetry}
            onExecuteProtocol={executeIronManProtocol}
          />

          {/* Hardware HUD */}
          <div className="mt-2 border-y border-white/5 py-3 w-full px-4 mb-2">
            <div className="grid grid-cols-2 gap-y-2 gap-x-6">
              <HUDItem 
                icon={<Activity className={`w-3 h-3 ${activeTheme.primary}`} />} 
                label="Neural Synapse" 
                value={`${Math.round(neuralLoad)}%`} 
                trend={isListening || isProcessing ? 'up' : 'stable'}
                color={activeTheme.primary}
              />
              <HUDItem 
                icon={<Database className={`w-3 h-3 ${activeTheme.primary}`} />} 
                label="Buffer Cache" 
                value={`${Math.round(memoryUsage)}%`} 
                color={activeTheme.primary}
              />
              <HUDItem 
                icon={<Timer className={`w-3 h-3 ${activeTheme.primary}`} />} 
                label="Mission Uptime" 
                value={`${Math.floor(uptime/60)}m ${uptime%60}s`} 
                color={activeTheme.primary}
              />
              <HUDItem 
                icon={<Zap className={`w-3 h-3 ${activeTheme.primary}`} />} 
                label="Arc Reactor Output" 
                value={`${suitTelemetry.arcReactorOutput} GJ`} 
                color={activeTheme.primary}
              />
            </div>
          </div>
          
          {/* Main Interaction Circle - Stark Arc Reactor Core */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative mb-2 flex items-center justify-center">
              <ArcReactor
                isListening={isListening}
                isProcessing={isProcessing}
                isSurging={isSurging}
                themeColor={normalizedTheme}
                onClick={() => {
                  starkAudio.playArcReactorPulse();
                  toggleListening();
                }}
                onToggleListen={() => {
                  starkAudio.playArcReactorPulse();
                  toggleListening();
                }}
                status={status}
                language={language}
              />
            </div>

            {/* Input Options Bar */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  vibrate(10);
                  playSysSound(1200, 'sine', 0.05);
                  setShowTextInput(!showTextInput);
                }}
                aria-label="Toggle text input"
                aria-expanded={showTextInput}
                className={`p-3 rounded-full transition-all duration-300 border outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                  showTextInput 
                    ? `${activeTheme.bg} ${activeTheme.border} ${activeTheme.primary}` 
                    : 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-zinc-300 hover:border-white/10'
                }`}
                title="Type Command"
              >
                <Keyboard className="w-5 h-5" />
              </button>
              
              <button 
                onClick={() => {
                  vibrate(10);
                  playSysSound(700, 'sine', 0.05);
                  setShowProfileSettings(true);
                }}
                aria-label="Profile Settings"
                aria-expanded={showProfileSettings}
                className={`p-3 rounded-full transition-all duration-300 border outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                  showProfileSettings 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                    : 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-zinc-300 hover:border-white/10'
                }`}
                title="Profile Settings"
              >
                <User className="w-5 h-5" />
              </button>

              <button 
                onClick={() => {
                  vibrate(10);
                  playSysSound(600, 'sine', 0.05);
                  setShowVoiceSettings(true);
                }}
                aria-label="Voice settings"
                aria-expanded={showVoiceSettings}
                className={`p-3 rounded-full transition-all duration-300 border outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
                  showVoiceSettings 
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' 
                    : 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-zinc-300 hover:border-white/10'
                }`}
                title="Vocal Calibration"
              >
                <Languages className="w-5 h-5" />
              </button>

              <button 
                onClick={() => {
                  vibrate(10);
                  playSysSound(800, 'sine', 0.05);
                  setShowHistory(true);
                }}
                aria-label="History log"
                aria-expanded={showHistory}
                className="p-3 rounded-full transition-all duration-300 border bg-zinc-900 border-white/5 text-zinc-500 hover:text-zinc-300 hover:border-white/10 outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                title="History"
              >
                <History className="w-5 h-5" />
              </button>

              <div className="h-4 w-[1px] bg-white/5 mx-1" />

              <button 
                onClick={() => {
                  vibrate(10);
                  playSysSound(isMuted ? 880 : 440, 'sine', 0.05);
                  setIsMuted(!isMuted);
                }}
                aria-label={isMuted ? 'Unmute system audio' : 'Mute system audio'}
                className={`p-3 rounded-full transition-all duration-300 border outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 ${
                  isMuted 
                    ? 'bg-red-500/10 border-red-500/30 text-red-400' 
                    : 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-zinc-300 hover:border-white/10'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>

              <div className="h-4 w-[1px] bg-white/5 mx-1" />

              <button 
                onClick={() => {
                  vibrate(10);
                  playSysSound(showConsole ? 440 : 880, 'sine', 0.05);
                  setShowConsole(!showConsole);
                }}
                aria-label="Toggle system console"
                aria-expanded={showConsole}
                className={`p-3 rounded-full transition-all duration-300 border outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                  showConsole 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                    : 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-zinc-300 hover:border-white/10'
                }`}
                title="System Console"
              >
                <Terminal className="w-5 h-5" />
              </button>

              <button 
                onClick={() => {
                  vibrate(10);
                  playSysSound(isFullscreen ? 440 : 1100, 'sine', 0.05);
                  toggleFullscreen();
                }}
                aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
                className={`p-3 rounded-full transition-all duration-300 border outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 ${
                  isFullscreen 
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                    : 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-zinc-300 hover:border-white/10'
                }`}
                title="Toggle Fullscreen"
              >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
            </div>
            
            {/* System Console Panel */}
            <AnimatePresence>
              {showConsole && (
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  className={`fixed left-0 top-0 bottom-0 w-80 z-[2000] border-r flex flex-col shadow-2xl transition-colors duration-300 ${lightMode ? 'bg-white border-zinc-200' : 'bg-[#0c0c0c] border-white/5'}`}
                >
                  <div className={`p-6 border-b flex items-center justify-between ${lightMode ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/50 border-white/5'}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">System Command Core</h3>
                    </div>
                    <button onClick={() => setShowConsole(false)} className="p-2 hover:bg-white/5 rounded-full text-zinc-400 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50" aria-label="Close system console">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar font-mono">
                    {logs.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-20 py-10">
                        <Shield className="w-8 h-8 mb-4" />
                        <span className="text-[8px] uppercase tracking-widest">No active protocols initialized</span>
                      </div>
                    ) : (
                      logs.map((log, idx) => (
                        <div key={idx} className="text-[10px] leading-relaxed break-words">
                          <span className="opacity-30 mr-2 text-[8px]">
                            [{new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}]
                          </span>
                          <span className={
                            log.type === 'error' ? 'text-red-400' :
                            log.type === 'warn' ? 'text-amber-400' :
                            log.type === 'success' ? 'text-emerald-400' :
                            'text-zinc-400'
                          }>
                            {log.type === 'error' ? 'ERR!' : log.type === 'warn' ? 'WRN' : log.type === 'success' ? 'OK' : 'SYS'}: {log.message}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-4 bg-zinc-900/20 border-t border-white/5">
                    <div className="flex items-center justify-between text-[8px] uppercase tracking-widest text-zinc-500">
                      <span>Neural Link: Secure</span>
                      <span className="flex items-center gap-1">
                        <Activity className="w-2 h-2" />
                        {neuralLoad.toFixed(1)}% Load
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* History Panel */}
            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  className={`fixed right-0 top-0 bottom-0 w-80 z-[2000] border-l flex flex-col shadow-2xl transition-colors duration-300 ${lightMode ? 'bg-white border-zinc-200' : 'bg-[#080808] border-white/5'}`}
                >
                  <div className={`p-6 border-b flex items-center justify-between ${lightMode ? 'border-zinc-200' : 'border-white/5'}`}>
                    <div className="flex items-center gap-2">
                      <History className={`w-4 h-4 ${activeTheme.primary}`} />
                      <h3 className="text-xs font-bold uppercase tracking-widest">Telemetry Log</h3>
                    </div>
                    <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-white/5 rounded-full text-zinc-400 outline-none focus-visible:ring-2 focus-visible:ring-white/20" aria-label="Close telemetry log">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {history.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-center opacity-30 text-[10px] uppercase tracking-widest">
                        Cache Empty
                      </div>
                    ) : (
                      history.map((item, idx) => (
                        <div key={idx} className="space-y-1.5 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                          <p className="text-[9px] font-mono uppercase opacity-40">
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </p>
                          <p className={`text-[10px] ${activeTheme.primary} text-opacity-80 font-medium`}>/&gt; {item.command}</p>
                          <p className="text-[10px] text-zinc-400 line-clamp-3">{item.response}</p>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Text Input Field */}
            <AnimatePresence>
              {showTextInput && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="w-full overflow-hidden"
                >
                  <form 
                    onSubmit={handleTextSubmit}
                    className={`flex items-center gap-2 border rounded-xl p-1.5 pl-4 transition-colors ${
                      lightMode 
                        ? 'bg-white border-zinc-200 focus-within:border-emerald-600' 
                        : 'bg-zinc-900 border-white/10 focus-within:border-emerald-500/50'
                    }`}
                  >
                    <input 
                      autoFocus
                      type="text" 
                      placeholder={language === 'hi-IN' ? "कमांड टाइप करें..." : "Enter command, sir..."}
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      className={`bg-transparent border-none outline-none text-xs flex-1 py-1 pr-2 ${lightMode ? 'text-zinc-900' : 'text-white'}`}
                    />
                    <button 
                      type="submit"
                      disabled={!textInput.trim()}
                      className="p-1.5 rounded-lg bg-emerald-500 text-black disabled:bg-zinc-800 disabled:text-zinc-600 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Visualizer */}
          <div className="flex justify-center gap-1.5 h-8 mb-8">
            {visualizerBars.map((height, i) => (
              <motion.div
                key={i}
                animate={{ height }}
                className={`w-1 rounded-full transition-colors duration-300 ${isListening ? 'bg-emerald-400' : 'bg-zinc-700'}`}
              />
            ))}
          </div>

          {/* Display Areas */}
          <div className="space-y-4 mb-8 relative">
            {/* Profile Settings Popover */}
            <AnimatePresence>
              {showProfileSettings && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className={`absolute bottom-full left-0 right-0 mb-4 z-50 border rounded-2xl p-6 shadow-2xl transition-colors duration-300 ${lightMode ? 'bg-white border-zinc-200' : 'bg-zinc-800 border-white/10'}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-[10px] uppercase tracking-widest font-bold ${lightMode ? 'text-zinc-500' : 'text-zinc-400'}`}>Identity Profile</span>
                    <button onClick={() => setShowProfileSettings(false)} className={`outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${lightMode ? 'text-zinc-400 hover:text-zinc-900' : 'text-zinc-500 hover:text-white'}`} aria-label="Close identity profile">
                      <UserCircle className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className={`block text-[9px] uppercase tracking-wider mb-2 ${lightMode ? 'text-zinc-500' : 'text-zinc-500'}`}>Core Persona</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'jarvis', name: 'JARVIS', icon: Cpu, desc: 'Professional' },
                          { id: 'alfred', name: 'Alfred', icon: Shield, desc: 'Formal' },
                          { id: 'buddy', name: 'Buddy', icon: Smile, desc: 'Casual' }
                        ].map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              vibrate(10);
                              setProfile({ ...profile, persona: p.id as any });
                              showNotification(`Persona updated to ${p.name}.`, 'success', 3000);
                              
                              let greeting = "";
                              if (p.id === 'jarvis') greeting = "System recalibrated. Ready for further instructions, sir.";
                              else if (p.id === 'alfred') greeting = `As you wish, Master ${profile.callMe}. I am at your service.`;
                              else if (p.id === 'buddy') greeting = "Sweet! Ready for whatever you need, buddy!";
                              
                              if (greeting) {
                                setResponse(greeting);
                                speak(greeting);
                              }
                            }}
                            className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                              profile.persona === p.id 
                                ? (lightMode ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm' : 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400') 
                                : (lightMode ? 'bg-zinc-50 border-zinc-200 text-zinc-400 hover:border-zinc-300' : 'bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/10')
                            }`}
                          >
                            <p.icon className="w-4 h-4" />
                            <div className="text-center">
                              <p className="text-[9px] font-bold leading-none">{p.name}</p>
                              <p className="text-[7px] opacity-60 uppercase mt-0.5 tracking-tighter">{p.desc}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase tracking-wider text-zinc-500 mb-1">Full Name</label>
                      <input 
                        type="text" 
                        value={profile.fullName}
                        onChange={(e) => setProfile({...profile, fullName: e.target.value})}
                        className={`w-full border rounded-lg p-2 text-xs outline-none transition-colors ${
                          lightMode 
                            ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-emerald-600' 
                            : 'bg-zinc-900 border-white/10 text-zinc-300 focus:border-emerald-500/50'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[9px] uppercase tracking-wider mb-1 ${lightMode ? 'text-zinc-500' : 'text-zinc-500'}`}>Call Me</label>
                      <input 
                        type="text" 
                        value={profile.callMe}
                        onChange={(e) => setProfile({...profile, callMe: e.target.value})}
                        className={`w-full border rounded-lg p-2 text-xs outline-none transition-colors ${
                          lightMode 
                            ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-emerald-600' 
                            : 'bg-zinc-900 border-white/10 text-zinc-300 focus:border-emerald-500/50'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[9px] uppercase tracking-wider mb-1 ${lightMode ? 'text-zinc-500' : 'text-zinc-500'}`}>Preferences</label>
                      <textarea 
                        value={profile.preferences}
                        onChange={(e) => setProfile({...profile, preferences: e.target.value})}
                        className={`w-full border rounded-lg p-2 text-xs outline-none transition-colors h-16 resize-none ${
                          lightMode 
                            ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-emerald-600' 
                            : 'bg-zinc-900 border-white/10 text-zinc-300 focus:border-emerald-500/50'
                        }`}
                      />
                    </div>
                    <div className="pt-2 border-t border-white/5">
                      <span className={`block text-[9px] uppercase tracking-widest font-bold mb-2 ${lightMode ? 'text-zinc-500' : 'text-zinc-400'}`}>Neural Link Aesthetics</span>
                      <div className={`flex items-center justify-between p-2 rounded-lg mb-3 border ${lightMode ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-white/5'}`}>
                        <span className={`text-[10px] uppercase tracking-tight ${lightMode ? 'text-zinc-600' : 'text-zinc-400'}`}>Luminous Interface (High Contrast)</span>
                        <button 
                          onClick={() => {
                            vibrate(10);
                            setLightMode(!lightMode);
                          }}
                          aria-label="Toggle light mode"
                          aria-pressed={lightMode}
                          className={`w-10 h-5 rounded-full transition-colors relative ${lightMode ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                        >
                          <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${lightMode ? 'right-1' : 'left-1'}`} />
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-2 mb-4">
                        {(['arc', 'gold', 'hotrod', 'stealth'] as const).map((c) => (
                          <button
                            key={c}
                            onClick={() => {
                              vibrate(10);
                              setProfile({ ...profile, themeColor: c });
                            }}
                            aria-label={`Switch theme to ${c}`}
                            aria-pressed={normalizedTheme === c}
                            className={`h-8 rounded-lg border transition-all ${
                              normalizedTheme === c 
                                ? themeColors[c].border + ' ' + (lightMode ? 'bg-white ring-cyan-500' : themeColors[c].bg) + ' ring-1 ring-white/20' 
                                : (lightMode ? 'bg-zinc-100 border-zinc-200' : 'bg-zinc-900 border-white/5') + ' opacity-50 hover:opacity-100 hover:border-white/10'
                            }`}
                          >
                            <div className={`w-2 h-2 mx-auto rounded-full ${themeColors[c].accent}`} />
                          </button>
                        ))}
                      </div>

                      <span className="block text-[9px] uppercase tracking-widest text-zinc-400 font-bold mb-2">API Configuration</span>
                      <div>
                        <label className={`block text-[9px] uppercase tracking-wider mb-1 ${lightMode ? 'text-zinc-500' : 'text-zinc-500'}`}>OpenWeatherMap Key</label>
                        <input 
                          type="password" 
                          placeholder="Paste your key here"
                          value={profile.apiKeys.weather || ''}
                          onChange={(e) => setProfile({
                            ...profile, 
                            apiKeys: { ...profile.apiKeys, weather: e.target.value } 
                          })}
                          className={`w-full border rounded-lg p-2 text-xs outline-none transition-colors ${
                            lightMode 
                              ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-emerald-600' 
                              : 'bg-zinc-900 border-white/10 text-zinc-300 focus:border-emerald-500/50'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Voice Settings Popover */}
            <AnimatePresence>
              {showVoiceSettings && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className={`absolute bottom-full left-0 right-0 mb-4 z-50 border rounded-2xl p-4 shadow-2xl transition-colors duration-300 ${lightMode ? 'bg-white border-zinc-200' : 'bg-zinc-800 border-white/10'}`}
                >
                  <div className={`flex items-center justify-between mb-3 border-b pb-2 ${lightMode ? 'border-zinc-200' : 'border-white/5'}`}>
                    <div className="flex items-center gap-2">
                      <Settings className={`w-4 h-4 ${activeTheme.primary}`} />
                      <span className={`text-[10px] uppercase tracking-widest font-bold ${lightMode ? 'text-zinc-500' : 'text-zinc-400'}`}>Vocal Calibration</span>
                    </div>
                    <button onClick={() => setShowVoiceSettings(false)} className={`outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${lightMode ? 'text-zinc-400 hover:text-zinc-900' : 'text-zinc-500 hover:text-white'}`} aria-label="Close vocal calibration">
                      <ChevronLeft className="w-4 h-4 rotate-270" />
                    </button>
                  </div>
                  
                  <div className="mb-4">
                    <span className="block text-[9px] uppercase tracking-widest text-zinc-500 mb-2 font-bold">Voice Signature</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          vibrate(10);
                          setProfile({...profile, voiceGender: 'male', vocal: {...profile.vocal, selectedVoiceURI: ''}});
                          playSysSound(800, 'sine', 0.05);
                        }}
                        className={`flex-1 py-2 rounded-lg text-[10px] uppercase tracking-tighter border transition-all flex flex-col items-center gap-1 ${
                          profile.voiceGender === 'male' 
                            ? (lightMode ? 'bg-blue-100 border-blue-400 text-blue-700 font-bold' : 'bg-blue-500/20 border-blue-500/40 text-blue-400 shadow-lg shadow-blue-500/10') 
                            : (lightMode ? 'bg-zinc-50 border-zinc-200 text-zinc-400' : 'bg-zinc-900 border-white/5 text-zinc-600')
                        }`}
                      >
                        <User className="w-3 h-3" />
                        <span>Male (JARVIS)</span>
                      </button>
                      <button 
                        onClick={() => {
                          vibrate(10);
                          setProfile({...profile, voiceGender: 'female', vocal: {...profile.vocal, selectedVoiceURI: ''}});
                          playSysSound(900, 'sine', 0.05);
                        }}
                        className={`flex-1 py-2 rounded-lg text-[10px] uppercase tracking-tighter border transition-all flex flex-col items-center gap-1 ${
                          profile.voiceGender === 'female' 
                            ? (lightMode ? 'bg-rose-100 border-rose-400 text-rose-700 font-bold' : 'bg-rose-500/20 border-rose-500/40 text-rose-400 shadow-lg shadow-rose-500/10') 
                            : (lightMode ? 'bg-zinc-50 border-zinc-200 text-zinc-400' : 'bg-zinc-900 border-white/5 text-zinc-600')
                        }`}
                      >
                        <UserCircle className="w-3 h-3" />
                        <span>Female (FRIDAY)</span>
                      </button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <span className={`block text-[9px] uppercase tracking-widest font-bold mb-2 ${lightMode ? 'text-zinc-500' : 'text-zinc-500'}`}>Primary Frequency (Voice)</span>
                    <select 
                      value={profile.vocal.selectedVoiceURI}
                      onChange={(e) => setProfile({...profile, vocal: {...profile.vocal, selectedVoiceURI: e.target.value}})}
                      className={`w-full border rounded-lg p-2 text-[10px] outline-none transition-colors ${
                        lightMode 
                          ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-emerald-600' 
                          : 'bg-zinc-900 border-white/10 text-zinc-300 focus:border-emerald-500/50'
                      }`}
                    >
                      <option value="">Optimized Neural Path (Default)</option>
                      {voices
                        .filter(v => v.lang.startsWith(language.split('-')[0]))
                        .map((voice, index) => (
                        <option key={`${voice.voiceURI}-${index}`} value={voice.voiceURI}>
                          {voice.name.split(' ')[0]} {voice.name.includes('-') ? voice.name.split('-')[1] : ''} ({voice.lang})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Volume2 className="w-3 h-3 text-emerald-400" />
                          <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-bold">Amplification</span>
                        </div>
                        <span className={`text-[10px] font-mono font-bold ${lightMode ? 'text-emerald-700' : 'text-emerald-400'}`}>{Math.round(profile.vocal.volume * 100)}%</span>
                      </div>
                      <input 
                        type="range" min="0" max="1" step="0.1" 
                        value={profile.vocal.volume}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setProfile({...profile, vocal: {...profile.vocal, volume: val}});
                          if (val % 0.2 === 0) vibrate(5);
                        }}
                        className={`w-full h-1 rounded-lg appearance-none cursor-pointer accent-emerald-500 ${lightMode ? 'bg-zinc-200' : 'bg-zinc-900'}`}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Zap className="w-3 h-3 text-emerald-400" />
                          <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-bold">Processing Rate</span>
                        </div>
                        <span className={`text-[10px] font-mono font-bold ${lightMode ? 'text-emerald-700' : 'text-emerald-400'}`}>{profile.vocal.rate.toFixed(2)}x</span>
                      </div>
                      <input 
                        type="range" min="0.5" max="2" step="0.05" 
                        value={profile.vocal.rate}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setProfile({...profile, vocal: {...profile.vocal, rate: val}});
                          if (Math.abs(val - 1.0) < 0.05) vibrate(10);
                        }}
                        className={`w-full h-1 rounded-lg appearance-none cursor-pointer accent-emerald-500 ${lightMode ? 'bg-zinc-200' : 'bg-zinc-900'}`}
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Activity className="w-3 h-3 text-emerald-400" />
                        <span className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold">Synaptic Frequency</span>
                      </div>
                      <span className={`text-[10px] font-mono font-bold ${lightMode ? 'text-emerald-700' : 'text-emerald-400'}`}>{profile.vocal.pitch.toFixed(2)}</span>
                    </div>
                    <input 
                      type="range" min="0" max="2" step="0.1" 
                      value={profile.vocal.pitch}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setProfile({...profile, vocal: {...profile.vocal, pitch: val}});
                        if (Math.abs(val - 1.0) < 0.05) vibrate(10);
                      }}
                      className={`w-full h-1 rounded-lg appearance-none cursor-pointer accent-emerald-500 ${lightMode ? 'bg-zinc-200' : 'bg-zinc-900'}`}
                    />
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-white/5 flex gap-2">
                    <button 
                      onClick={() => speak(language === 'hi-IN' ? "नमस्ते सर, क्या मेरी आवाज़ स्पष्ट है?" : "Greetings sir. I am currently calibrating my vocal arrays.")}
                      className={`flex-1 py-1.5 rounded-lg border text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                        lightMode 
                          ? 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900' 
                          : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
                      }`}
                    >
                      <Play className="w-3 h-3" />
                      Test Link
                    </button>
                    <button 
                      onClick={() => setProfile({...profile, vocal: {volume: 1, rate: 0.95, pitch: 1.0, selectedVoiceURI: ''}, voiceGender: 'male' })}
                      className={`px-3 py-1.5 rounded-lg border text-[9px] uppercase tracking-widest transition-all ${
                        lightMode 
                          ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' 
                          : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                      }`}
                    >
                      Reset
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Transcript */}
            <div className="bg-white/5 rounded-2xl p-4 min-h-[80px] border border-white/5">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-zinc-500 mb-2">
                <Volume2 className="w-3 h-3" />
                <span>Input Signal</span>
              </div>
              <p className={`text-sm leading-relaxed ${!transcript ? 'text-zinc-600 italic' : 'text-zinc-300'}`}>
                {transcript || "Awaiting voice command..."}
              </p>
            </div>

            {/* Response Area */}
            <div className={`bg-black/40 rounded-2xl p-4 min-h-[100px] border transition-all duration-300 ${ (status === 'Permission Denied' || status === 'अनुमति नहीं दी गई' || permissionState === 'denied') ? 'border-red-500/30' : 'border-emerald-500/10'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-emerald-500/70">
                  <Cpu className="w-3 h-3" />
                  <span>Neural Output</span>
                </div>
                {(status === 'Permission Denied' || status === 'अनुमति नहीं दी गई' || permissionState === 'denied') && (
                  <div className="flex gap-2">
                    {isIframe && (
                      <a
                        href={window.location.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-[9px] uppercase tracking-wider text-blue-300 hover:bg-blue-500/30 transition-colors"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        <span>Open New Tab</span>
                      </a>
                    )}
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={() => setShowTextInput(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-[9px] uppercase tracking-wider text-cyan-300 hover:bg-cyan-500/30 transition-colors"
                    >
                      <Terminal className="w-2.5 h-2.5" />
                      <span>Type Command</span>
                    </motion.button>
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={toggleListening}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[9px] uppercase tracking-wider text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                    >
                      <Mic className="w-2.5 h-2.5" />
                      <span>Retry Mic</span>
                    </motion.button>
                  </div>
                )}
              </div>
              <p className={`text-sm leading-relaxed text-opacity-90 ${ (status === 'Permission Denied' || status === 'अनुमति नहीं दी गई' || permissionState === 'denied') ? 'text-amber-200' : 'text-emerald-50'}`}>
                {response}
              </p>
              
              {(status === 'Permission Denied' || status === 'अनुमति नहीं दी गई' || permissionState === 'denied') && (
                <div className="mt-4 pt-4 border-t border-amber-500/10 space-y-2">
                  <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Input Options:</p>
                  <ul className="text-[10px] text-zinc-400 space-y-1 list-disc pl-4">
                    <li>Type any question or command in the <b>Text Input Bar</b> below.</li>
                    <li>Click <b>Retry Mic</b> or permit audio in your browser address bar.</li>
                    {isIframe && (
                      <li className="list-none pt-2">
                        <a 
                          href={window.location.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-white border border-blue-500/40 rounded-lg transition-all text-[9px] font-bold tracking-wider"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>OPEN IN NEW TAB FOR DIRECT VOICE ACCESS</span>
                        </a>
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            {/* Weather 3-Day Forecast Card Under Neural Output */}
            <AnimatePresence>
              {weatherReport && (
                <WeatherCard 
                  weather={weatherReport}
                  report={weatherReport} 
                  onClose={() => setWeatherReport(null)} 
                  onRefresh={handleRefreshWeather} 
                  isRefreshing={isRefreshingWeather}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Controls & Quick Actions */}
          <div className="grid grid-cols-4 gap-3">
            <QuickActionBtn icon={<Clock />} label="Time" onClick={() => quickAction('time')} />
            <QuickActionBtn icon={<Calendar />} label="Date" onClick={() => quickAction('date')} />
            <QuickActionBtn icon={<CloudSun />} label="Weather" onClick={() => quickAction('weather')} />
            <QuickActionBtn icon={<Smile />} label="Joke" onClick={() => quickAction('joke')} />
          </div>

          <div className="mt-8 flex items-center justify-between px-2">
            <div className="flex gap-4">
              <button 
                onClick={() => setIsMuted(!isMuted)}
                aria-label={isMuted ? "Unmute system audio" : "Mute system audio"}
                className="text-zinc-500 hover:text-white transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/20 p-1 rounded"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <button 
                onClick={() => {
                  const cycle: ('en-US' | 'en-IN' | 'hi-IN')[] = ['en-US', 'en-IN', 'hi-IN'];
                  const nextIndex = (cycle.indexOf(language) + 1) % cycle.length;
                  setLanguage(cycle[nextIndex]);
                }}
                aria-label={`Switch language. Current: ${language === 'en-US' ? 'English US' : language === 'en-IN' ? 'English India' : 'Hindi'}`}
                className="flex items-center gap-1 text-zinc-500 hover:text-white transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/20 p-1 rounded"
                title="Switch Language"
              >
                <Languages className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase">
                  {language === 'en-US' ? 'US' : language === 'en-IN' ? 'IN' : 'HI'}
                </span>
              </button>
              <button 
                onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                aria-label="Vocal Calibration Settings"
                aria-expanded={showVoiceSettings}
                className={`transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 p-1 rounded ${showVoiceSettings ? 'text-emerald-400' : 'text-zinc-500 hover:text-white'}`}
                title="Voice Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setShowProfileSettings(!showProfileSettings)}
                aria-label="Profile Settings"
                aria-expanded={showProfileSettings}
                className={`transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 p-1 rounded ${showProfileSettings ? 'text-emerald-400' : 'text-zinc-500 hover:text-white'}`}
                title="Profile Settings"
              >
                <User className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Veronica Protocol Orbital Deployment HUD */}
        <VeronicaProtocolHUD
          isOpen={isVeronicaOpen}
          onClose={() => setIsVeronicaOpen(false)}
          language={language}
          onReplay={() => executeIronManProtocol('veronica')}
        />
      </motion.div>
    </div>
  );
}

function QuickActionBtn({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ y: -2, backgroundColor: 'rgba(255,255,255,0.1)' }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      aria-label={`Quick action: ${label}`}
      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/20"
    >
      <div className="text-zinc-400" aria-hidden="true">{icon}</div>
      <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-medium">{label}</span>
    </motion.button>
  );
}

function HUDItem({ icon, label, value, trend, color = "text-zinc-500" }: { icon: React.ReactNode, label: string, value: string, trend?: 'up' | 'stable' | 'down', color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5 text-[8px] uppercase tracking-widest text-zinc-500 font-bold">
        <div aria-hidden="true">{icon}</div>
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-mono font-bold ${color}`}>{value}</span>
        {trend && (
          <div className="flex gap-0.5">
            {[1, 2, 3].map((i) => (
              <motion.div 
                key={i}
                animate={trend === 'up' ? { opacity: [0.2, 1, 0.2] } : { opacity: 0.3 }}
                transition={{ delay: i * 0.2, repeat: Infinity, duration: 1 }}
                className={`w-0.5 h-2 rounded-full ${trend === 'up' ? 'bg-emerald-500' : 'bg-zinc-700'}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BootText({ text, delay }: { text: string; delay: number }) {
  return (
    <motion.p
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="block"
    >
      {text}
    </motion.p>
  );
}
