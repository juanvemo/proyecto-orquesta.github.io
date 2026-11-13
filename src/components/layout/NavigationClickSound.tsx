import { useEffect, useRef } from "react";

export function NavigationClickSound() {
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const play = async (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!target || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const href = target.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      const AudioContextClass = window.AudioContext;
      if (!AudioContextClass) return;
      const context = audioRef.current ?? new AudioContextClass();
      audioRef.current = context;
      if (context.state === "suspended") await context.resume();

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(760, now);
      oscillator.frequency.exponentialRampToValueAtTime(510, now + 0.055);
      gain.gain.setValueAtTime(0.055, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.07);
    };

    document.addEventListener("click", play);
    return () => {
      document.removeEventListener("click", play);
      void audioRef.current?.close();
    };
  }, []);

  return null;
}
