import { useEffect } from "react";
import { playUiSound, unlockUiAudio } from "@/lib/uiSound";

export function NavigationClickSound() {
  useEffect(() => {
    const handleUnlock = () => {
      unlockUiAudio();
    };

    const handleClick = (event: MouseEvent) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element
        ? event.target.closest("a[href], button:not(:disabled), [role='tab'], [role='menuitem']")
        : null;
      if (!target) return;
      if (target.tagName === "A") {
        const href = target.getAttribute("href");
        if (!href || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      }
      unlockUiAudio();
      playUiSound("click");
    };

    document.addEventListener("pointerdown", handleUnlock, { passive: true });
    document.addEventListener("touchstart", handleUnlock, { passive: true });
    document.addEventListener("keydown", handleUnlock, { passive: true });
    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("pointerdown", handleUnlock);
      document.removeEventListener("touchstart", handleUnlock);
      document.removeEventListener("keydown", handleUnlock);
      document.removeEventListener("click", handleClick);
    };
  }, []);

  return null;
}
