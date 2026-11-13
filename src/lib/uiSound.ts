export type UiSoundKind = "click" | "confirm" | "success" | "error" | "taskComplete";

const SOUND_STORAGE_KEY = "po_ui_sound_enabled";
let sharedAudioContext: AudioContext | null = null;
const listeners = new Set<(enabled: boolean) => void>();

export function isSoundEnabled(): boolean {
  try {
    const raw = localStorage.getItem(SOUND_STORAGE_KEY);
    return raw === null ? true : raw === "true";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    // Ignore storage errors in restricted contexts
  }
  listeners.forEach((listener) => listener(enabled));
}

export function subscribeSoundSetting(listener: (enabled: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new Ctor();
  }
  return sharedAudioContext;
}

export function unlockUiAudio(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    try {
      void ctx.resume();
    } catch {
      // Ignore mobile unlock exceptions
    }
  }
}

function scheduleTone(ctx: AudioContext, freqStart: number, freqEnd: number, duration: number, volume: number, delay = 0, type: OscillatorType = "sine") {
  const now = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freqStart, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.015);
}

export function playUiSound(kind: UiSoundKind = "click"): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    try {
      void ctx.resume();
    } catch {
      return;
    }
  }

  try {
    if (kind === "click") {
      scheduleTone(ctx, 740, 490, 0.05, 0.045, 0, "sine");
    } else if (kind === "confirm") {
      scheduleTone(ctx, 620, 880, 0.075, 0.05, 0, "triangle");
    } else if (kind === "success") {
      scheduleTone(ctx, 587.33, 587.33, 0.08, 0.05, 0, "triangle");
      scheduleTone(ctx, 880, 880, 0.12, 0.055, 0.07, "triangle");
    } else if (kind === "taskComplete") {
      scheduleTone(ctx, 523.25, 523.25, 0.08, 0.05, 0, "triangle");
      scheduleTone(ctx, 659.25, 659.25, 0.08, 0.05, 0.065, "triangle");
      scheduleTone(ctx, 783.99, 1046.5, 0.14, 0.06, 0.13, "triangle");
    } else if (kind === "error") {
      scheduleTone(ctx, 310, 210, 0.14, 0.055, 0, "sawtooth");
    }
  } catch {
    // Ignore audio scheduling errors
  }
}
