let audioCtx: AudioContext | null = null;
let warmupDone = false;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export interface NotificationSettings {
  enabled: boolean;
  volume: number;
  desktop: boolean;
}

const SETTINGS_KEY = 'bk-pacs-notification-settings';

export function getNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        enabled: parsed.enabled ?? true,
        volume: typeof parsed.volume === 'number' ? parsed.volume : 0.6,
        desktop: parsed.desktop ?? true,
      };
    }
  } catch {}
  return { enabled: true, volume: 0.6, desktop: true };
}

export function saveNotificationSettings(s: NotificationSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {}
}

/**
 * 在用户首次交互时解锁 AudioContext，绕过浏览器自动播放限制。
 * 在 App 启动时调用一次即可。
 */
export function installAudioUnlock() {
  if (warmupDone || typeof window === 'undefined') return;
  const unlock = () => {
    if (warmupDone) return;
    warmupDone = true;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const buffer = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(0);
    } catch {}
    window.removeEventListener('click', unlock);
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('click', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
}

function playTone(ctx: AudioContext, freq: number, startOffset: number, duration: number, peakGain: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);
  const t0 = ctx.currentTime + startOffset;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peakGain, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** 双音"叮-咚"消息提示，带 ADSR 包络，比纯 sine 更悦耳明显 */
export function playMessageSound() {
  const s = getNotificationSettings();
  if (!s.enabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const v = Math.max(0, Math.min(1, s.volume));
    playTone(ctx, 988, 0, 0.35, v * 0.5);
    playTone(ctx, 1318, 0.13, 0.45, v * 0.45);
  } catch {}
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([60, 40, 60]);
    }
  } catch {}
}

export function playSystemNotification() {
  const s = getNotificationSettings();
  if (!s.enabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const v = Math.max(0, Math.min(1, s.volume));
    playTone(ctx, 660, 0, 0.25, v * 0.5);
  } catch {}
}

/** 请求桌面通知权限，应在用户首次交互后调用以满足 Safari 要求 */
export async function requestDesktopNotificationPermission(): Promise<boolean> {
  try {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const p = await Notification.requestPermission();
    return p === 'granted';
  } catch {
    return false;
  }
}

/** 桌面横幅通知。仅在标签未激活或后台时显示，避免重复打扰 */
export function showDesktopNotification(title: string, body: string, onClick?: () => void) {
  const s = getNotificationSettings();
  if (!s.desktop) return;
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible' && document.hasFocus()) return;
    const n = new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: 'bk-pacs-notification',
      renotify: false,
    } as NotificationOptions);
    if (onClick) {
      n.onclick = () => {
        window.focus();
        try { onClick(); } catch {}
        n.close();
      };
    }
    setTimeout(() => n.close(), 6000);
  } catch {}
}
