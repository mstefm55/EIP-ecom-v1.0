import { useEffect, useRef } from "react";

const DEFAULT_IDLE_MINUTES = 120;
const CHECK_INTERVAL_MS = 60 * 1000;

export function useIdleLogout({ idleMinutes = DEFAULT_IDLE_MINUTES, enabled = true, onTimeout }) {
  const lastActivityRef = useRef(Date.now());
  const timeoutRef = useRef(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled || !idleMinutes || idleMinutes <= 0) return () => {};

    const idleMs = idleMinutes * 60 * 1000;
    const markActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((eventName) =>
      window.addEventListener(eventName, markActivity, { passive: true })
    );

    timerRef.current = window.setInterval(() => {
      if (timeoutRef.current) return;
      const now = Date.now();
      if (now - lastActivityRef.current >= idleMs) {
        timeoutRef.current = true;
        onTimeout?.();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      events.forEach((eventName) =>
        window.removeEventListener(eventName, markActivity)
      );
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, idleMinutes, onTimeout]);
}
