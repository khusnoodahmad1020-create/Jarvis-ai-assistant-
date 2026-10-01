export type Persona = 'jarvis' | 'alfred' | 'buddy' | 'friday';
export type ThemeColor = 'arc' | 'gold' | 'hotrod' | 'stealth';
export type LanguageCode = 'en-US' | 'en-IN' | 'hi-IN';

export interface UserProfile {
  fullName: string;
  callMe: string;
  preferences: string;
  voiceGender: 'male' | 'female';
  persona: Persona;
  themeColor: ThemeColor;
  suitModel: 'MK-85' | 'MK-50' | 'MK-44' | 'MK-7';
  apiKeys: {
    weather?: string;
  };
  vocal: {
    volume: number;
    rate: number;
    pitch: number;
    selectedVoiceURI: string;
  };
}

export interface ForecastDay {
  dayName: string;
  dateStr: string;
  tempMax: number;
  tempMin: number;
  tempCurrent?: number;
  condition: string;
  icon: 'sun' | 'cloud' | 'rain' | 'snow' | 'storm';
  humidity: number;
  windSpeed: number;
}

export interface WeatherReport {
  location: string;
  currentTemp: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  feelsLike: number;
  forecast: ForecastDay[];
  timestamp: number;
}

export interface SuitTelemetry {
  armorIntegrity: number;
  arcReactorOutput: number; // Gigajoules
  repulsorCharge: number; // Percentage
  thrusterPower: number; // Mach or %
  unibeamCharge: number;
  defenseMatrix: boolean;
  activeProtocol: string | null;
}

export interface SystemLog {
  message: string;
  type: 'info' | 'warn' | 'success' | 'error';
  timestamp: number;
}

export interface NotificationItem {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration: number;
}

export interface HistoryItem {
  command: string;
  response: string;
  timestamp: number;
}
