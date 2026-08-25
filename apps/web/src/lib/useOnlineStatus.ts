/**
 * Connection status for the header indicator (§8).
 *
 * `navigator.onLine` is famously optimistic — it reports "online" for a captive portal or a dead
 * uplink. It is enough for M0's quiet indicator; M5 replaces it with the outbox drain result,
 * which is the only signal that actually proves the API is reachable.
 */

import { useEffect, useState } from 'react';

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
