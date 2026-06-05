import { useEffect, useRef } from "react";

const DEFAULT_IDLE_MINUTES = 120;
const CHECK_INTERVAL_MS = 60 * 1000;

function defaultActivityPingIntervalMs(idleMs) {
  if (!Number.isFinite(idleMs) || idleMs <= 0) return 60 * 1000;
  return Math.max(30 * 1000, Math.min(60 * 1000, Math.floor(idleMs / 3)));
}

export function useIdleLogout({
  idleMinutes = DEFAULT_IDLE_MINUTES,
  enabled = true,
  onTimeout,
  onActivityPing,
  activityPingIntervalMs
}) {
  const lastActivityRef = useRef(Date.now());
  const lastActivityPingRef = useRef(Date.now());
  const timeoutRef = useRef(false);
  const timerRef = useRef(null);
  const onTimeoutRef = useRef(onTimeout);
  const onActivityPingRef = useRef(onActivityPing);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
    onActivityPingRef.current = onActivityPing;
  }, [onTimeout, onActivityPing]);

  useEffect(() => {
    if (!enabled || !idleMinutes || idleMinutes <= 0) return () => {};

    const idleMs = idleMinutes * 60 * 1000;
    const pingIntervalMs = Number(activityPingIntervalMs) > 0
      ? Number(activityPingIntervalMs)
      : defaultActivityPingIntervalMs(idleMs);
    const markActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;
      if (onActivityPingRef.current && now - lastActivityPingRef.current >= pingIntervalMs) {
        lastActivityPingRef.current = now;
        Promise.resolve(onActivityPingRef.current()).catch(() => {});
      }
    };

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "pointerdown"];
    events.forEach((eventName) =>
      window.addEventListener(eventName, markActivity, { passive: true })
    );

    timerRef.current = window.setInterval(() => {
      if (timeoutRef.current) return;
      const now = Date.now();
      if (now - lastActivityRef.current >= idleMs) {
        timeoutRef.current = true;
        onTimeoutRef.current?.();
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
  }, [enabled, idleMinutes, activityPingIntervalMs]);
}
