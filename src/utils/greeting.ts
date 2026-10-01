/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BootGreeting {
  userName: string;
  timeGreeting: string;
  salutation: string;
  fullBootMessage: string;
  fullBootMessageHindi: string;
}

/**
 * Retrieves the user's name from browser local storage, checking both
 * direct storage keys and the structured jarvis_profile object.
 */
export function fetchUserNameFromStorage(): string {
  try {
    // 1. Check direct keys that might be configured
    const directKey = localStorage.getItem('jarvis_user_name') || 
                      localStorage.getItem('user_name') || 
                      localStorage.getItem('username') ||
                      localStorage.getItem('callMe');
    if (directKey && directKey.trim()) {
      return directKey.trim();
    }

    // 2. Check the structured profile object in localStorage
    const savedProfile = localStorage.getItem('jarvis_profile');
    if (savedProfile) {
      const parsed = JSON.parse(savedProfile);
      if (parsed.callMe && typeof parsed.callMe === 'string' && parsed.callMe.trim()) {
        return parsed.callMe.trim();
      }
      if (parsed.fullName && typeof parsed.fullName === 'string' && parsed.fullName.trim()) {
        return parsed.fullName.trim();
      }
    }
  } catch (err) {
    console.warn('Unable to read user name from storage during boot sequence:', err);
  }

  return 'Boss';
}

/**
 * Generates an authentic time-based greeting (e.g. 'Good morning, Boss')
 * aligned with current local system time and the user's preferred name.
 */
export function getTimeBasedGreeting(customName?: string): BootGreeting {
  const name = (customName && customName.trim()) ? customName.trim() : fetchUserNameFromStorage();
  const hour = new Date().getHours();

  let timeGreeting = 'Good day';
  let timeGreetingHindi = 'शुभ दिन';

  if (hour >= 4 && hour < 12) {
    timeGreeting = 'Good morning';
    timeGreetingHindi = 'शुभ प्रभात';
  } else if (hour >= 12 && hour < 17) {
    timeGreeting = 'Good afternoon';
    timeGreetingHindi = 'शुभ दोपहर';
  } else if (hour >= 17 && hour < 22) {
    timeGreeting = 'Good evening';
    timeGreetingHindi = 'शुभ संध्या';
  } else {
    timeGreeting = 'Good night';
    timeGreetingHindi = 'शुभ रात्रि';
  }

  const salutation = `${timeGreeting}, ${name}`;
  const fullBootMessage = `${salutation}. J.A.R.V.I.S. neural interface initialized. Core arc telemetry online and ready for your command.`;
  const fullBootMessageHindi = `${timeGreetingHindi}, ${name}। जार्विस न्यूरल इंटरफेस सक्रिय हो गया है। सभी प्रणालियां आपकी सेवा में तैयार हैं।`;

  return {
    userName: name,
    timeGreeting,
    salutation,
    fullBootMessage,
    fullBootMessageHindi
  };
}
