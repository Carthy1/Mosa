/**
 * Mosa Notification & Sound Alert Service
 * Provides Web Audio API sound chimes, haptics, and browser push notifications.
 */

/**
 * Synthesizes a gentle, modern two-tone social notification chime
 * using the Web Audio API without needing external audio files.
 */
export function playNotificationSound() {
  try {
    if (typeof window === 'undefined') return;
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();

    // In mobile Safari / Chrome, resume audio context if suspended
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Tone 1: Smooth sine wave at 587.33 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.22);

    // Tone 2: Uplifting bright sine wave at 880 Hz (A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.08);
    gain2.gain.setValueAtTime(0, now + 0.08);
    gain2.gain.linearRampToValueAtTime(0.22, now + 0.11);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.45);
  } catch (err) {
    console.warn('[NOTIFICATIONS] Audio alert note:', err);
  }
}

/**
 * Triggers subtle haptic vibration on supported mobile devices.
 */
export function triggerHaptic() {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([35, 50, 35]);
    }
  } catch (err) {}
}

/**
 * Checks whether native browser Web Notifications are supported.
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Returns current browser notification permission status.
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Requests notification permission from user.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      playNotificationSound();
      triggerHaptic();
    }
    return permission;
  } catch (err) {
    console.warn('[NOTIFICATIONS] Permission request error:', err);
    return 'default';
  }
}

/**
 * Registers the Service Worker for background push and notification support.
 */
export async function registerNotificationServiceWorker(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  try {
    await navigator.serviceWorker.register('/sw.js');
    console.log('[NOTIFICATIONS] Service Worker registered for notifications.');
  } catch (err) {
    console.warn('[NOTIFICATIONS] Service Worker registration notice:', err);
  }
}

/**
 * Dispatches a native browser notification (e.g. when app is backgrounded or tab hidden).
 */
export async function sendNativeNotification(
  title: string,
  options?: NotificationOptions & { onClick?: () => void }
): Promise<void> {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;

  try {
    // If Service Worker is active, use showNotification for PWA / background reliability
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        reg.showNotification(title, {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          vibrate: [150, 80, 150],
          ...options,
        } as any);
        return;
      }
    }

    // Fallback: standard Window Notification API
    const n = new Notification(title, {
      icon: '/favicon.ico',
      ...options,
    });

    n.onclick = () => {
      window.focus();
      options?.onClick?.();
      n.close();
    };
  } catch (err) {
    console.warn('[NOTIFICATIONS] Dispatch native notification error:', err);
  }
}
