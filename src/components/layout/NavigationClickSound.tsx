import { useEffect, useRef } from "react";

export function NavigationClickSound() {
  const audioRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    const navigationLink = (target: EventTarget | null) => {
      const link = target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.hasAttribute("download") || link.target === "_blank" || new URL(link.href, window.location.href).origin !== window.location.origin) return null;
      return link;
    };
    const contextForGesture = () => {
      const Constructor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Constructor) return null;
      if (!audioRef.current || audioRef.current.state === "closed") audioRef.current = new Constructor();
      return audioRef.current;
    };
    const unlock = (event: PointerEvent) => {
      if (!navigationLink(event.target)) return;
      try { const context = contextForGesture(); if (context?.state === "suspended") void context.resume().catch(() => {}); }
      catch { /* El navegador o el dispositivo puede bloquear audio; la navegación debe continuar. */ }
    };
    const play = async (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !navigationLink(event.target)) return;
      try {
        const context = contextForGesture();
        if (!context) return;
        if (context.state === "suspended") await context.resume();
        if (context.state !== "running") return;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const now = context.currentTime;
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(760, now);
        oscillator.frequency.exponentialRampToValueAtTime(510, now + 0.055);
        gain.gain.setValueAtTime(0.055, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(now); oscillator.stop(now + 0.07);
      } catch { /* Sin audio permitido, el enlace conserva su funcionamiento. */ }
    };
    document.addEventListener("pointerdown", unlock, { passive: true });
    document.addEventListener("click", play);
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("click", play);
      const context = audioRef.current;
      audioRef.current = null;
      if (context && context.state !== "closed") void context.close().catch(() => {});
    };
  }, []);
  return null;
}
