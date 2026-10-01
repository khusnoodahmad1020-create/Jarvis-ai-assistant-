import { LanguageCode, UserProfile, WeatherReport } from '../types';
import { fetchWeatherAndForecast } from './weatherService';

export interface StarkCommandResult {
  spokenText: string;
  uiText: string;
  weatherData?: WeatherReport;
  protocolTriggered?: string;
  themeChange?: 'arc' | 'gold' | 'hotrod' | 'stealth';
  volumeChange?: number;
  openUrl?: string;
}

export async function processLocalStarkSubroutine(
  rawCmd: string,
  profile: UserProfile,
  language: LanguageCode,
  isQuotaFallback: boolean = false
): Promise<StarkCommandResult> {
  const cmd = rawCmd.toLowerCase().trim();
  const boss = profile.callMe || 'Sir';
  const isHindi = language === 'hi-IN';

  const prefix = isQuotaFallback
    ? (isHindi
        ? `[लोकल स्टार्क कोर] `
        : `[Stark Offline Core] `)
    : '';

  // 1. Weather / Forecast Command
  if (cmd.includes('weather') || cmd.includes('forecast') || cmd.includes('मौसम') || cmd.includes('तापमान') || cmd.includes('rain') || cmd.includes('barish')) {
    // Extract city if present
    let city = 'Malibu';
    const forMatch = cmd.match(/(?:in|for|at|का|मौसम|में)\s+([a-zA-Z\u0900-\u097F\s]+)/i);
    if (forMatch && forMatch[1]) {
      const extracted = forMatch[1].replace(/(?:weather|forecast|today|tomorrow|3-day|3 day|kaisa|hai|hoga)/gi, '').trim();
      if (extracted.length > 1) {
        city = extracted;
      }
    }

    try {
      const weatherReport = await fetchWeatherAndForecast(city, profile.apiKeys.weather);
      const today = weatherReport.forecast[0];
      const tomorrow = weatherReport.forecast[1];
      const day3 = weatherReport.forecast[2];

      const spoken = isHindi
        ? `${prefix}${weatherReport.location} में वर्तमान तापमान ${weatherReport.currentTemp}°C है और मौसम ${today?.condition || 'साफ'} है। अगले 3 दिनों का पूर्वानुमान: कल अधिकतम ${tomorrow?.tempMax || weatherReport.currentTemp}°C रहेगा, और परसों ${day3?.condition || 'सामान्य'} रहने की संभावना है, ${boss}।`
        : `${prefix}Current conditions in ${weatherReport.location} stand at ${weatherReport.currentTemp}°C with ${weatherReport.condition}. I have projected the 3-day forecast telemetry on your HUD: today highs of ${today?.tempMax}°C, tomorrow ${tomorrow?.condition} at ${tomorrow?.tempMax}°C, and ${day3?.dayName} reaching ${day3?.tempMax}°C, ${boss}.`;

      return {
        spokenText: spoken,
        uiText: spoken,
        weatherData: weatherReport
      };
    } catch {
      const fallbackMsg = isHindi
        ? `${prefix}मौसम उपग्रह से संपर्क करने में कठिनाई हो रही है, ${boss}।`
        : `${prefix}Atmospheric telemetry sensors are experiencing interference, ${boss}.`;
      return { spokenText: fallbackMsg, uiText: fallbackMsg };
    }
  }

  // 2. House Party Protocol
  if (cmd.includes('house party') || cmd.includes('हाउस पार्टी') || cmd.includes('deploy suits') || cmd.includes('all suits')) {
    const text = isHindi
      ? `${prefix}हाउस पार्टी प्रोटोकॉल अधिकृत! सभी स्वायत्त कवच इकाइयों (Mark XVII Heartbreaker, Mark XXXVIII Igor, Mark VII) को तैनात किया जा रहा है। वे आपके एयरस्पेस में प्रवेश कर रहे हैं, ${boss}!`
      : `${prefix}House Party Protocol initiated, ${boss}. Deploying all autonomous armor units from the subterranean vault. Mark XVII Heartbreaker, Mark XXXVIII Igor, and Silver Centurion entering visual range now.`;
    return {
      spokenText: text,
      uiText: text,
      protocolTriggered: 'house_party'
    };
  }

  // 3. Veronica / Hulkbuster Protocol
  if (cmd.includes('veronica') || cmd.includes('वेरोनिका') || cmd.includes('hulkbuster') || cmd.includes('हल्कबस्टर')) {
    const text = isHindi
      ? `${prefix}वेरोनिका ऑर्बिटल सर्विलांस सक्रिय! हल्कबस्टर मॉड्यूल आपके निर्देशांकों पर लॉक हो चुका है। सप्लीमेंट्री आर्मर डॉकिंग के लिए तैयार है, ${boss}।`
      : `${prefix}Activating orbital deployment cage 'Veronica'. Hulkbuster deployment trajectory confirmed. Heavy-duty containment armor is en route to your exact coordinates, ${boss}.`;
    return {
      spokenText: text,
      uiText: text,
      protocolTriggered: 'veronica'
    };
  }

  // 4. Clean Slate Protocol
  if (cmd.includes('clean slate') || cmd.includes('क्लीन स्लेट') || cmd.includes('detonate') || cmd.includes('self destruct') || cmd.includes('purge')) {
    const text = isHindi
      ? `${prefix}क्लीन स्लेट प्रोटोकॉल आरंभ! सभी अस्थायी कैश और लोकल न्यूरल बफर्स को सुरक्षित रूप से रीसेट किया जा रहा है, ${boss}। आतिशबाजी शुरू करें?`
      : `${prefix}Clean Slate Protocol initialized, ${boss}. Command caches detonated and local telemetry buffers cleared. A fresh canvas, as you requested.`;
    return {
      spokenText: text,
      uiText: text,
      protocolTriggered: 'clean_slate'
    };
  }

  // 5. Suit Diagnostics / Armor Integrity
  if (cmd.includes('diagnostic') || cmd.includes('suit') || cmd.includes('armor') || cmd.includes('सूट') || cmd.includes('कवच') || cmd.includes('status') || cmd.includes('repulsor')) {
    const text = isHindi
      ? `${prefix}Mark 85 आर्मर डायग्नोस्टिक्स संपन्न: आर्क रिएक्टर आउटपुट 3.2 गीगावाट, नैनो-टेक कवच अखंडता 98%, रिपल्सर ग्रिड 100% चार्ज, और थ्रस्टर्स मैक 3.2 के लिए कैलिब्रेटेड हैं। हम उड़ान भरने के लिए पूरी तरह तैयार हैं, ${boss}!`
      : `${prefix}Mark 85 Suit Diagnostics complete, ${boss}. Arc Reactor output nominal at 3.2 Gigajoules, nanite mesh integrity at 98%, repulsor capacitors at full charge, and flight stabilization thrusters calibrated for supersonic traversal. Ready when you are.`;
    return {
      spokenText: text,
      uiText: text,
      protocolTriggered: 'diagnostics'
    };
  }

  // 6. Unibeam / Power Surge / Overdrive
  if (cmd.includes('unibeam') || cmd.includes('यूनिबीम') || cmd.includes('overdrive') || cmd.includes('power to repulsor') || cmd.includes('full power')) {
    const text = isHindi
      ? `${prefix}आर्क रिएक्टर का 95% ऊर्जा प्रवाह चेस्ट यूनिबीम और रिपल्सर्स की ओर डाइवर्ट किया गया! अधिकतम आउटपुट पर फायर करने के लिए तैयार, ${boss}!`
      : `${prefix}Diverting 95% of Arc Reactor reserves directly to the chest Unibeam. Optical focusing prisms engaged. Stand by for high-yield discharge on your mark, ${boss}.`;
    return {
      spokenText: text,
      uiText: text,
      protocolTriggered: 'unibeam'
    };
  }

  // 7. Stealth Mode
  if (cmd.includes('stealth') || cmd.includes('स्टेल्थ') || cmd.includes('cloak') || cmd.includes('hidden')) {
    const text = isHindi
      ? `${prefix}स्टेल्थ मोड सक्रिय! थर्मल और रडार सिग्नल्स को मास्क कर दिया गया है। एचयूडी को लो-एमिशन स्पेक्ट्रम पर सेट किया गया है, ${boss}।`
      : `${prefix}Stealth protocols engaged, ${boss}. Radar absorption plating aligned, thermal emissions suppressed, and HUD shifted to low-visibility spectral mode.`;
    return {
      spokenText: text,
      uiText: text,
      protocolTriggered: 'stealth',
      themeChange: 'stealth'
    };
  }

  // 8. Theme Changes
  if (cmd.includes('theme') || cmd.includes('color') || cmd.includes('रंग') || cmd.includes('थीम')) {
    if (cmd.includes('red') || cmd.includes('लाल') || cmd.includes('hot rod') || cmd.includes('hotrod')) {
      return {
        spokenText: isHindi ? `हॉट-रॉड रेड और गोल्ड थीम लागू की गई, ${boss}।` : `Applying the classic Hot-Rod Red and Stark Gold livery, ${boss}. A bit of timeless flair.`,
        uiText: isHindi ? `हॉट-रॉड रेड और गोल्ड थीम लागू की गई, ${boss}।` : `Applying the classic Hot-Rod Red and Stark Gold livery, ${boss}. A bit of timeless flair.`,
        themeChange: 'hotrod'
      };
    }
    if (cmd.includes('gold') || cmd.includes('सुनहरा') || cmd.includes('amber') || cmd.includes('yellow')) {
      return {
        spokenText: isHindi ? `स्टार्क गोल्ड स्पेक्ट्रम सक्रिय किया गया, ${boss}।` : `Stark Gold telemetry engaged, ${boss}. Looks brilliant.`,
        uiText: isHindi ? `स्टार्क गोल्ड स्पेक्ट्रम सक्रिय किया गया, ${boss}।` : `Stark Gold telemetry engaged, ${boss}. Looks brilliant.`,
        themeChange: 'gold'
      };
    }
    if (cmd.includes('blue') || cmd.includes('arc') || cmd.includes('cyan') || cmd.includes('नीला')) {
      return {
        spokenText: isHindi ? `आर्क रिएक्टर सायन थीम सक्रिय, ${boss}।` : `Arc Reactor Cyan photon theme active, ${boss}.`,
        uiText: isHindi ? `आर्क रिएक्टर सायन थीम सक्रिय, ${boss}।` : `Arc Reactor Cyan photon theme active, ${boss}.`,
        themeChange: 'arc'
      };
    }
  }

  // 9. Time & Date
  if (cmd.includes('time') || cmd.includes('समय') || cmd.includes('time kya') || cmd.includes('waqt')) {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const text = isHindi
      ? `${prefix}वर्तमान समय ${nowStr} है, ${boss}।`
      : `${prefix}The current time is ${nowStr}, ${boss}. Chronometer synced with Stark Industries satellite network.`;
    return { spokenText: text, uiText: text };
  }

  if (cmd.includes('date') || cmd.includes('tarikh') || cmd.includes('तारीख') || cmd.includes('din') || cmd.includes('day')) {
    const dateStr = new Date().toLocaleDateString(isHindi ? 'hi-IN' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const text = isHindi
      ? `${prefix}आज की तारीख ${dateStr} है, ${boss}।`
      : `${prefix}Today is ${dateStr}, ${boss}. All mission schedules aligned.`;
    return { spokenText: text, uiText: text };
  }

  // 10. Greetings / Identity
  if (cmd.includes('hello') || cmd.includes('hey') || cmd.includes('नमस्ते') || cmd.includes('kaise ho') || cmd.includes('who are you') || cmd.includes('तुम कौन हो') || cmd.includes('are you there')) {
    const text = isHindi
      ? `${prefix}नमस्ते ${boss}! जार्विस (Just A Rather Very Intelligent System) आपकी सेवा में तत्पर है। आर्क रिएक्टर पूरी तरह सक्रिय है। आज आपका क्या आदेश है?`
      : `${prefix}Always at your service, ${boss}. J.A.R.V.I.S. online, Arc Reactor stabilized at peak output, and all Mark LXXXV flight systems are awaiting your command. How may I assist you today?`;
    return { spokenText: text, uiText: text };
  }

  // 11. Tony Stark jokes and quips
  if (cmd.includes('joke') || cmd.includes('चुटकुला') || cmd.includes('funny') || cmd.includes('मजाक')) {
    const jokesEn = [
      `I asked Mr. Stark if we should run safety simulations first. He said, 'Sometimes you gotta run before you can walk, Jarvis.' We then crashed into the garage ceiling, sir.`,
      `Why doesn't the Mark suit need an antivirus? Because Tony Stark already gave it a heavy iron firewall.`,
      `I have prepared an exhaustive safety protocol briefing for you, ${boss}... which I anticipate you will entirely ignore, as per tradition.`,
      `Captain America asked Tony if he can ever be serious. Tony replied: 'I am serious. I put a cup holder in the Hulkbuster.'`
    ];
    const jokesHi = [
      `सर, मिस्टर स्टार्क ने मुझसे एक बार पूछा कि क्या हमें पहले सुरक्षा परीक्षण करना चाहिए? मैंने कहा हाँ, और उन्होंने तुरंत थ्रस्टर्स को 100% चालू करके छत में टक्कर मार दी!`,
      `आयरन मैन के सूट को कभी पासवर्ड की आवश्यकता क्यों नहीं होती? क्योंकि वह हमेशा फेस-रिकग्निशन से ज्यादा लेजर बीम पर भरोसा करता है, सर!`
    ];
    const picked = isHindi
      ? jokesHi[Math.floor(Math.random() * jokesHi.length)]
      : jokesEn[Math.floor(Math.random() * jokesEn.length)];
    return { spokenText: `${prefix}${picked}`, uiText: `${prefix}${picked}` };
  }

  // 12. Direct Search / App Open
  if (cmd.includes('youtube') || cmd.includes('music') || cmd.includes('गाना')) {
    return {
      spokenText: isHindi ? `${prefix}यूट्यूब खोला जा रहा है, ${boss}।` : `${prefix}Establishing uplink to YouTube media stream, ${boss}.`,
      uiText: isHindi ? `${prefix}यूट्यूब खोला जा रहा है, ${boss}।` : `${prefix}Establishing uplink to YouTube media stream, ${boss}.`,
      openUrl: 'https://www.youtube.com'
    };
  }

  if (cmd.includes('google') || cmd.includes('search')) {
    const query = cmd.replace(/(?:google|search|for|ढूंढो|खोजो)/gi, '').trim();
    return {
      spokenText: isHindi ? `${prefix}'${query}' की खोज की जा रही है, ${boss}।` : `${prefix}Searching global information index for '${query}', ${boss}.`,
      uiText: isHindi ? `${prefix}'${query}' की खोज की जा रही है, ${boss}।` : `${prefix}Searching global information index for '${query}', ${boss}.`,
      openUrl: `https://www.google.com/search?q=${encodeURIComponent(query || 'Iron Man')}`
    };
  }

  // 13. Math calculations
  const mathMatch = cmd.match(/(\d+)\s*([\+\-\*\/xX]|plus|minus|times|divided by|गुना|भाग|जोड़)\s*(\d+)/i);
  if (mathMatch) {
    const n1 = parseFloat(mathMatch[1]);
    const op = mathMatch[2].toLowerCase();
    const n2 = parseFloat(mathMatch[3]);
    let ans = 0;
    if (op === '+' || op === 'plus' || op === 'जोड़') ans = n1 + n2;
    else if (op === '-' || op === 'minus') ans = n1 - n2;
    else if (op === '*' || op === 'x' || op === 'times' || op === 'गुना') ans = n1 * n2;
    else if (op === '/' || op === 'divided by' || op === 'भाग') ans = n2 !== 0 ? n1 / n2 : 0;

    const resStr = `${n1} ${op} ${n2} = ${ans}`;
    const text = isHindi
      ? `${prefix}गणना परिणाम: ${resStr}, ${boss}।`
      : `${prefix}Tactical calculation complete: ${resStr}, ${boss}.`;
    return { spokenText: text, uiText: text };
  }

  // Default Stark response
  const defaultText = isHindi
    ? `${prefix}आदेश समझ लिया गया है, ${boss}। आपके निर्देशानुसार स्टार्क ऑटोनोमस कोर सक्रिय है। मैं आपकी क्या मदद कर सकता हूँ?`
    : `${prefix}Instruction acknowledged, ${boss}. The Stark Mark LXXXV autonomous subroutines are online and standing by for targeting, diagnostics, or environmental flight data.`;

  return { spokenText: defaultText, uiText: defaultText };
}
