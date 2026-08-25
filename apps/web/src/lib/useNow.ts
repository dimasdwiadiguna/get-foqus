/**
 * A ticking "now", used by anything that renders relative to the current instant.
 *
 * Reads the clock on every tick rather than accumulating — the same rule as the pomodoro timer
 * (D9). A backgrounded tab may skip ticks; it must never drift.
 */

import { useEffect, useState } from 'react';

export function useNow(intervalMs = 30_000): string {
  const [now, setNow] = useState(() => new Date().toISOString());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date().toISOString()), intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') setNow(new Date().toISOString());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);

  return now;
}
